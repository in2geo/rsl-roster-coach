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
      const def = SET_BONUSES[name];
      if (!def) { sets.push({ set: name, pieces: n, bonus: 'none (effect set)' }); continue; }
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
const STAT_KIND_ID = { 1: 'hp', 2: 'atk', 3: 'def', 4: 'spd', 5: 'crate', 6: 'cdmg', 7: 'res', 8: 'acc' };
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
