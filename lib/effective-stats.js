// ── lib/effective-stats.js ───────────────────────────────────────────────────
// Converts a champion's REAL gear (from the Gestal export) into effective in-battle
// stats. Replaces the gear-tier multiplier guesswork in estimate-stats.js with the
// actual artifact math, so threshold checks run on real numbers.
//
// RAID stat formula:
//   • % gear/set bonuses (HP%, ATK%, DEF%, SPD% from Speed set) apply to the BASE stat.
//   • flat gear/set bonuses add on top.
//     HP/ATK/DEF/SPD : effective = base + round(base * pct/100) + flat
//     CRATE/CDMG/RES/ACC : effective = base + flat            (no % version in gear)
//
// Inputs come straight from the Gestal champion record:
//   { baseStats:{hp,atk,def,spd,crate,cdmg,res,acc}, equippedArtifacts:[{mainStat,
//     mainStatValue, substats:[{stat,value}], set}] }
//
// NOT yet applied (additive, layer in once validated): leader aura (content-scoped),
// masteries, artifact ascension/glyph stats. The Gestal record carries masteryIds and
// per-artifact ascensionStat/glyph — wire those in after the base gear math validates.

// Set bonuses — GAME CONSTANTS. Only sets that grant a base-stat bonus are listed;
// effect-only sets (Lifesteal, Fury, Daze, Frost, Cursed, Shield, Immunity, Relentless,
// Stun, …) grant no flat/percent stat and are intentionally omitted. Keyed by the
// Gestal `set` name. VERIFY against the in-game set screen before shipping.
export const SET_BONUSES = {
  Life:           { pieces: 2, stat: 'hp',    value: 15, pct: true  },
  Offense:        { pieces: 2, stat: 'atk',   value: 15, pct: true  },
  Defense:        { pieces: 2, stat: 'def',   value: 15, pct: true  },
  Speed:          { pieces: 4, stat: 'spd',   value: 12, pct: true  },
  CriticalRate:   { pieces: 2, stat: 'crate', value: 12, pct: false },
  CriticalDamage: { pieces: 2, stat: 'cdmg',  value: 20, pct: false },
  Accuracy:       { pieces: 2, stat: 'acc',   value: 40, pct: false },
  Resistance:     { pieces: 2, stat: 'res',   value: 40, pct: false },
};

/* ── SET-NAME MATCHING (fixed 2026-07-19) ─────────────────────────────────────────────────────
 * Lookup is NORMALISED (case- and separator-insensitive) because the keys above are camelCase while
 * Gestal reports display names with spaces: `CriticalRate` vs **"Critical Rate"**, `CriticalDamage`
 * vs **"Critical Damage"**. Those two keys therefore matched NOTHING, and every crit-set bonus in
 * every roster was silently dropped. Normalising fixes the class, not just the two instances. */
const normSet = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SET_BONUSES_BY_KEY = new Map(Object.entries(SET_BONUSES).map(([k, v]) => [normSet(k), { ...v, name: k }]));

/* Sets that genuinely grant NO base stat — they are effect-only, so contributing nothing is CORRECT.
 * This list exists to separate "known to grant nothing" from "we have never heard of this set",
 * which the code previously conflated: an unrecognised set was labelled 'none (effect set)' and
 * vanished. That is how ~40 real set names — Perception (45 pieces), Divine Speed, Stalwart,
 * Stoneskin, Deflection, and an unmapped `unknown(38)` at 50 pieces — were absorbed in silence while
 * under-counting the stats they grant. Unknown sets are now reported as UNRECOGNISED.
 * ⚠ Anything not in EITHER table is a DATA GAP, not a zero. Do not add stat values here by guess —
 * the in-game set screen is the source (see the file header). */
const EFFECT_ONLY_SETS = new Set([
  'lifesteal', 'fury', 'daze', 'frost', 'cursed', 'shield', 'immunity', 'relentless', 'stun',
  'retaliation', 'avenging', 'destroy', 'reflex', 'phantomtouch', 'immortal', 'regeneration',
  'frostbite', 'cruel', 'savage', 'lethal',
].map(normSet));

const FLAT_KEYS = { HP: 'hp', ATK: 'atk', DEF: 'def', SPD: 'spd', CRATE: 'crate', CDMG: 'cdmg', RES: 'res', ACC: 'acc' };
const PCT_KEYS  = { 'HP%': 'hp', 'ATK%': 'atk', 'DEF%': 'def', 'SPD%': 'spd' };

/**
 * @param {object} champ - Gestal champion record (baseStats + equippedArtifacts)
 * @returns {{ effective:object, breakdown:object }}
 *   effective: { hp, atk, def, spd, crate, cdmg, res, acc }
 *   breakdown: { base, flat, pct, sets } — for inspection/validation
 */
export function effectiveStats(champ) {
  const base = champ?.baseStats ?? {};
  const flat = { hp: 0, atk: 0, def: 0, spd: 0, crate: 0, cdmg: 0, res: 0, acc: 0 };
  const pct  = { hp: 0, atk: 0, def: 0, spd: 0 };

  const addStat = (stat, val) => {
    if (stat == null || val == null) return;
    if (stat in PCT_KEYS) pct[PCT_KEYS[stat]] += val;
    else if (stat in FLAT_KEYS) flat[FLAT_KEYS[stat]] += val;
    // unknown stat label → ignored (kept visible via the breakdown totals)
  };

  // 1. Sum every main + sub stat across equipped artifacts; tally set pieces.
  const setCounts = {};
  for (const a of champ?.equippedArtifacts ?? []) {
    addStat(a.mainStat, a.mainStatValue);
    for (const s of a.substats ?? []) addStat(s.stat, s.value);
    if (a.set) setCounts[a.set] = (setCounts[a.set] ?? 0) + 1;
  }

  // 2. Apply set + mastery (+ blessing/relic/empower/faction) bonuses.
  // Prefer Gestal's pre-resolved bonusesV2 (it already applies 2pc/4pc thresholds
  // AND includes masteries); fall back to recomputing sets from gear if absent.
  const sets = [];
  const applied = [];
  if (champ?.bonusesV2) {
    applyBonusesV2(champ.bonusesV2, base, flat, pct, applied);
  } else {
    for (const [name, n] of Object.entries(setCounts)) {
      const def = SET_BONUSES_BY_KEY.get(normSet(name));
      if (!def) {
        // Known effect-only → contributing nothing is correct. Anything else is a DATA GAP: report
        // it as UNRECOGNISED so a missing set bonus is visible instead of silently under-counting.
        const known = EFFECT_ONLY_SETS.has(normSet(name));
        sets.push({ set: name, pieces: n, bonus: known ? 'none (effect set)' : 'UNRECOGNISED — no bonus applied',
                    ...(known ? {} : { unrecognised: true }) });
        continue;
      }
      const complete = Math.floor(n / def.pieces);
      if (complete <= 0) { sets.push({ set: name, pieces: n, bonus: 'incomplete' }); continue; }
      const total = complete * def.value;
      if (def.pct) pct[def.stat] += total; else flat[def.stat] += total;
      sets.push({ set: name, pieces: n, complete, applied: `${def.pct ? '+' + total + '% ' : '+' + total + ' '}${def.stat}` });
    }
  }

  const num = (k) => Math.round(base[k] ?? 0);
  const withPct = (k) => num(k) + Math.round((base[k] ?? 0) * (pct[k] ?? 0) / 100) + flat[k];
  const effective = {
    hp:    withPct('hp'),
    atk:   withPct('atk'),
    def:   withPct('def'),
    spd:   withPct('spd'),
    crate: num('crate') + flat.crate,
    cdmg:  num('cdmg')  + flat.cdmg,
    res:   num('res')   + flat.res,
    acc:   num('acc')   + flat.acc,
  };

  return { effective, breakdown: { base, flat, pct, sets, applied } };
}

// Gestal's bonusesV2 — pre-resolved bonuses keyed by statKindId. Categories:
// sets, mastery, blessing, relic, empower, factionGuardian. Each entry:
//   { statKindId, isAbsolute, value }
//   • isAbsolute=true  → flat points (e.g. mastery C.DMG +10)
//   • isAbsolute=false → fraction. For HP/ATK/DEF/SPD it's a % of base (0.45 = +45%);
//     for the point-stats CRATE/CDMG/RES/ACC it's points (0.10 = +10), since those
//     stats are already expressed in points.
/* BONUS-space stat-id map (bonusesV2.statKindId). CORRECTED 2026-07-20 — ids 5,6,7,8 were all
 * wrong; the four were shifted (was crate/cdmg/res/acc, is res/acc/crate/cdmg).
 *
 * ⚠ THIS IS A DIFFERENT ENUMERATION FROM `gestal-sync/sync.js` STAT_KIND (the ARTIFACT map).
 * The two id spaces genuinely disagree — bonus id7 is C.RATE while artifact id7 is SPD — so they
 * must never be merged or "reconciled". Treating them as one map is what produced the original bug.
 *
 * GROUND TRUTH — the in-game Perception set tooltip, "2 Set: ACC +40. SPD +5%", decodes Ezio's
 * `bonusesV2.sets` exactly:  {statKindId:4, isAbsolute:false, 0.05} = SPD +5%
 *                            {statKindId:6, isAbsolute:true,  40  } = ACC +40
 * Corroborated by the value SHAPES across all six accounts:
 *   id4 percent-only, sets at 5/8/10/12/17/22%      -> SPD   (Perception 5%, Speed 12%)
 *   id5 absolute-only, always 40                    -> RES   (Resistance set +40)
 *   id6 absolute-only, 20/40/80 + mastery 10        -> ACC   (Perception +40; tooltip-confirmed)
 *   id7 percent, mastery 5% + sets 12%              -> CRATE (Deadly Precision, Critical Rate set)
 *   id8 percent, mastery 10% + sets 15/30%          -> CDMG  (Keen Strike, Critical Damage set)
 *
 * VERIFIED against Ezio's panel: C.RATE 63+5=68 ✔ exact · C.DMG 44+10=54 ✔ exact · RES 56 ✔ exact
 * · SPD 99+5% = 104 vs panel 105 (rounding). Under the OLD map, Perception's +40 ACC was applied
 * as +40 C.DMG — which alone would have put C.DMG at 84 against a panel of 54.
 *
 * This is the bug behind HANDOFF_2026-07-20 §4.1's Narma case: she wears Critical Rate ×3 and the
 * model reported "+12 res", because bonus id7 (CRATE) was being read as RES. */
const STAT_KIND_ID = { 1: 'hp', 2: 'atk', 3: 'def', 4: 'spd', 5: 'res', 6: 'acc', 7: 'crate', 8: 'cdmg' };
const PCT_BASE_STATS = new Set(['hp', 'atk', 'def', 'spd']); // these scale % off base

function applyBonusesV2(b, base, flat, pct, applied) {
  for (const cat of ['sets', 'mastery', 'blessing', 'relic', 'empower', 'factionGuardian']) {
    for (const e of b[cat] ?? []) {
      const stat = STAT_KIND_ID[e.statKindId];
      if (!stat || e.value == null) continue;
      if (e.isAbsolute) {
        flat[stat] = (flat[stat] ?? 0) + e.value;
        applied.push(`${cat}: +${e.value} ${stat}`);
      } else if (PCT_BASE_STATS.has(stat)) {
        const p = e.value * 100;
        pct[stat] = (pct[stat] ?? 0) + p;
        applied.push(`${cat}: +${Math.round(p)}% ${stat}`);
      } else { // CRATE/CDMG/RES/ACC — fraction encodes points
        const v = Math.round(e.value * 100);
        flat[stat] = (flat[stat] ?? 0) + v;
        applied.push(`${cat}: +${v} ${stat}`);
      }
    }
  }
}
