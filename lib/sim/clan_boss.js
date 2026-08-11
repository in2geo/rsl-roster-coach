// lib/sim/clan_boss.js — the Demon Lord's kit and the Clan Boss "fight" for the sim.
//
// Mechanics are quoted from CLAN_BOSS_REVIEW.md (repo root), which CLAUDE.md makes required reading
// before touching this content's model. Verbatim in-game Index (Tier-1) + community factual data.
//
// CB is NOT like the four dungeons: the boss NEVER DIES (objective = TOTAL damage banked in one key →
// chest tier, not a kill), there are NO waves, it is a SINGLE target, and a single KEY is fought in ONE
// affinity (Void, or the day's Force/Magic/Spirit — the switch is between keys, not mid-fight). So this
// module gives the boss a real (huge) HP pool it cannot die through in ~50 turns, models the team's
// damage OUTPUT (the chest metric), and runs to the ~50-turn Gathering-Fury wall (the runner's turnCap).
//
// ⚠⚠ THREE MAGNITUDES ARE NOT IN OUR DATA AND MUST NOT BE INVENTED (v0 brackets them, exactly as
// dragon.js brackets the purple bar):
//   1. BOSS ATK — Flesh Wither / Dark Nova scale off it. Their HP damage to the team is SKIPPED and
//      flagged (the survival bracket). Their DEBUFFS (known values) and Crushing Force's STUN still apply.
//   2. CRUSHING FORCE's %target-HP coefficient — the card says "proportional to [Enemy MAX HP]" with no
//      %. Its damage is SKIPPED; its unresistable 1-turn Stun still lands.
//   3. Per-proc MASTERY cap value + boss DEF — handled by the engine gate (disableMasteryMaxHpVsBoss) and
//      a flagged DEF=0 in the boss build. So the v0's CONFIRMED figure is the DoT (poison/HP-burn CAPS) —
//      EXACT ONLY UNDER the selected survival + turn-order assumptions (reviewer #10); the direct-hit and
//      mastery contributions are reported separately as uncalibrated/excluded, never folded into the chest.

import { flag, applyDebuff, dealDamage, defMitigation, effectiveDef, chooseAllyTarget } from './engine.js';
import { CB_POISON_CAPS, CB_HP_BURN_TICK } from '../cb-damage-model.js';

// ── SURVIVAL / WIPE MODEL (2026-08-06) ────────────────────────────────────────────────────────────
// CB fights ALWAYS end in a team WIPE (Mike, 2026-08-06): the boss never dies, his damage ESCALATES
// (Gathering Fury) until it out-paces your sustain and kills you, and TOTAL banked damage = survival
// duration × per-turn output. So sustain/mitigation is the PRIMARY damage lever (more turns = more DoT),
// and the fight LENGTH must be an OUTPUT of (boss damage vs team sustain), not a fixed turn wall.
//
// The boss's ATK and skill multipliers are unknown, so his effective PRE-MITIGATION per-hit damage is one
// CALIBRATED constant per difficulty (CB_BOSS_HIT), folded (ATK × multiplier). It is reduced by Decrease
// ATK ON THE BOSS (the #1 survival lever — both AoEs scale off his ATK) and by each target's DEF via the
// engine's real mitigation curve, then escalated by Gathering Fury. ⚠ CALIBRATED against the two
// DonaHilvi reality captures (test/golden/clan-boss-donahilvi-hard-ezioxeno-*-2026-08-06.json): Iudex
// Artor team 9.88M / Mausoleum Mage team 8.44M. TWO data points → coarse; widen with more captures.
// Hard = 2460 BASE calibrated (2026-08-06) against a first-party per-hit capture: the FIRST Dark Nova
// (Gathering Fury = 1×) dealt 1,544 to Ninja / 1,480 to Xeno / 1,903 to Ezio on CB Hard (post-DEF, under
// Veil). The per-champ spread tracks DEF exactly (Ezio lowest DEF → highest hit), confirming the ATK-vs-DEF
// mechanic; 2460 reproduces Ninja's 1,544. ⚠ The Gathering-Fury RAMP (GF_RAMP_*) is NOT yet pinned — one
// early data point can't give the slope, and base 2460 + "team always wipes" + the 9.88M total together
// REQUIRE a mid/late Dark Nova value (~turn 20-30) to fix it. Non-Hard = rough scalings, UNCALIBRATED.
// Env-overridable (CB_BOSS_HIT_HARD / CB_GF1 / CB_GF2).
export const CB_BOSS_HIT = { Easy: 1200, Normal: 1900, Hard: Number(process.env.CB_BOSS_HIT_HARD ?? 2460), Brutal: 4900, Nightmare: 8200, 'Ultra Nightmare': 11500 };
// PER-SKILL AoE split (Mike first-party 2026-08-10, hand-calc-calibrated). The two AoEs hit VERY differently
// per hit: t1 Flesh Wither (2 hits) = 789 to Xeno; t2 Dark Nova (1 hit) = 1,289 → Dark Nova ≈ 3.27× Flesh
// Wither PER HIT. The old single CB_BOSS_HIT over-credited Flesh Wither and under-credited Dark Nova (they
// masked each other — see cb-survival-gap memory). Hard calibrated FW 1843 / DN 6022; other difficulties
// inherit the Hard ratio (×0.749 / ×2.448) until captured. ⚠ Re-verify vs t1/t2 with REAL roster stats.
export const FLESH_WITHER_HIT = Object.fromEntries(Object.entries(CB_BOSS_HIT).map(([d, v]) => [d, Math.round(v * 0.749)]));
export const DARK_NOVA_HIT    = Object.fromEntries(Object.entries(CB_BOSS_HIT).map(([d, v]) => [d, Math.round(v * 2.448)]));
// Crushing Force (A1) single-target %MaxHP damage (DEF-independent), set once Ezio's MaxHP is known from the
// turn-3 capture (2,899 damage at gf=1). Env-overridable (CB_CRUSH_PCT).
export const CB_CRUSH_PCT = Number(process.env.CB_CRUSH_PCT ?? 0.113);   // 2,899 / Ezio 25,583 MaxHP (turn-3, gf=1)
// Gathering Fury (reviewer formula, 2026-08-06): an ADDITIVE linear bonus on the boss's pre-Fury attack
// damage, keyed to the DEMON LORD'S OWN TURN number T (his activations, NOT global turns — Mike):
//   T ≤ 9  → 1×;  10 ≤ T ≤ 19 → 1 + 0.75·(T−9);  T ≥ 20 → 1 + 7.5 + (T−19) = 8.5 + (T−19)
// so +75% of base per boss-turn in 10-19, then +100% per boss-turn from 20. F(10)=1.75, F(11)=2.5,
// F(20)=9.5, F(50)=39.5. Applies to RAW damage BEFORE DEF/reductions (we already apply it pre-mitigation).
export function gatheringFury(t) {
  if (t < 10) return 1;
  if (t < 20) return 1 + 0.75 * (t - 9);
  return 8.5 + (t - 19);
}
// Decrease-ATK-on-boss factor: both AoEs scale off his ATK, so Decrease ATK cuts them directly.
function bossAtkFactor(boss) {
  let f = 1;
  for (const d of (boss?.debuffs ?? [])) if (/Decrease (Attack|ATK)/i.test(d.type)) f *= Math.max(0, 1 - (d.value ?? 0) / 100);
  return f;
}

/** The Demon Lord's CC/tempo immunity list (Almighty Immunity + Infernal Resilience + Unfaltering Speed).
 *  Mirrors dungeon-mechanics clan_boss.excluded. */
export const DEMON_LORD_IMMUNE = [
  'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Provoke', 'Fear', 'True Fear',
  'Petrification', 'Sheep', 'Ensnare', 'Seal', 'Master Seal', 'Block Active Skills', 'Block Passive Skills',
  'Berserk', 'Enfeeble', 'Nullify', 'Fatigue', "Hunter's Gaze",
  'Decrease Speed', 'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)',
  'Increase Enemy Cooldowns', 'Block Cooldowns',
];

// Flesh Wither (A2) places the AFFINITY debuff on the whole team (2 turns). Void = a 2.5% team Poison;
// the others are stat debuffs. Values are Tier-2 confirmed (25% DecATK / 25% DecACC / 15% DecSPD).
function affinityDebuffFor(aff) {
  if (/force/i.test(aff))  return { type: 'Decrease Attack', value: 25, turns: 2 };
  if (/magic/i.test(aff))  return { type: 'Decrease Accuracy', value: 25, turns: 2 };
  if (/spirit/i.test(aff)) return { type: 'Decrease Speed', value: 15, turns: 2 };
  return { type: 'Poison', pct: 0.025, turns: 2, stacking: true, maxStacks: 10 };  // Void
}

/**
 * @param {object} o
 *   difficulty — 'Easy'|'Normal'|'Hard'|'Brutal'|'Nightmare'|'Ultra Nightmare' (drives the DoT caps).
 *   boss — the built Demon Lord combatant (real HP so it can't die; affinity = the key's affinity).
 *   bossAtk — the Demon Lord's ATK, or null (null → AoE HP damage bracketed/skipped, flagged).
 */
// Gathering Fury: from the Demon Lord's 50th activation he ignores Block Damage + Unkillable — the practical
// wall. The key is TRUNCATED there (the team may technically survive past it, but banked damage past the wall
// is not the one-key metric). This is the AUTHORITATIVE clock — his activations, NOT global actions. Reviewer #1.
export const DEMON_LORD_WALL_TURNS = 50;

// MEASURED Warmaster/Giant Slayer per-proc value vs the Demon Lord — read off a first-party video (DonaHilvi,
// Ninja A1 Shatterbolt, 2026-08-07): a constant 67,912 RED (non-crit, DEF-independent) proc, repeated across
// turns. ONLY Hard is measured; other difficulties stay null (WM off) until their proc value is read — we don't
// yet know if it's flat or scales with the boss's MaxHP across difficulties. ⚠ Also observed per-HIT (the 2nd
// hit of a skill procced while the 1st didn't), whereas the engine models it once-per-skill — so multi-hit
// champs may still UNDER-count procs (a separate refinement, not folded into this value).
// Hard 67,912 + Normal 70,174 both MEASURED off first-party CB videos (DonaHilvi, Ninja A1/A2 red = non-crit
// Warmaster). Normal read 5× across 2 battles (63,611 / 70,174 / 70,174 / 69,026 / 70,174 → modal 70,174).
// Normal ≈ Hard despite 3× less boss HP → Warmaster is ~FLAT across difficulties, NOT %MaxHP-scaled. Other
// difficulties stay null (WM off) until read. Env-override: SIM_CB_WM_CAP.
const CB_WM_PROC_CAP = { Hard: 67912, Normal: 70174 };

export function makeClanBossContent({ difficulty = 'Hard', boss, bossAtk = null }) {
  const kit = makeDemonLord({ difficulty, aff: boss?.affinity || 'Void', bossAtk });
  return {
    name: 'Clan Boss', difficulty,
    phases: [{ name: 'demon lord', enemies: [boss], actEnemy: kit.actEnemy }],
    // The boss is a SCORING TARGET, not a kill (reviewer #13): it never dies here, and the key ENDS when the
    // Demon Lord completes his DEMON_LORD_WALL_TURNS-th activation (or the team wipes first).
    bossIsScoringTarget: true,
    endBattle: (state) => (state.cbBossTurns ?? 0) >= DEMON_LORD_WALL_TURNS,
    // Grand-total HP dealt to the boss (authoritative delta the engine feeds every tick + ally hit). The TYPED
    // confirmed-DoT split (poison/HP-burn) is accumulated separately in state.cbLedger; direct-hit = total − DoT
    // (uncalibrated, boss DEF=0). The runner reports them separately — the chest uses confirmed DoT ONLY. #2.
    onDamageToBoss(state, amount) { state.cbDamageToBoss = (state.cbDamageToBoss ?? 0) + amount; },
    // ── engine hooks (all gated; default-off elsewhere so Dragon/Spider are byte-identical) ──
    cbPoisonCaps: CB_POISON_CAPS[difficulty] ?? null,                        // Infernal Resilience poison caps { '2.5': x, '5': y }
    cbHpBurnCaps: { rare: CB_HP_BURN_TICK.rare, epicPlus: CB_HP_BURN_TICK.epicPlus },   // HP-burn tick RESOLVED per-tick by placer rarity (reviewer #3)
    cbTrackDoT: true,                                                        // engine inits state.cbLedger (typed confirmed-DoT accumulator)
    disableMasteryMaxHpVsBoss: true,                                         // fallback: exclude %maxHP mastery vs boss ONLY if no cap is set
    // per-proc value for WM/GS vs the Demon Lord = the MEASURED constant (67,912 on Hard, first-party video —
    // see CB_WM_PROC_CAP above). Env-override: SIM_CB_WM_CAP. null on unmeasured difficulties → WM stays off.
    cbMasteryProcCap: process.env.SIM_CB_WM_CAP != null ? Number(process.env.SIM_CB_WM_CAP) : (CB_WM_PROC_CAP[difficulty] ?? null),
  };
}

function makeDemonLord({ difficulty, aff, bossAtk }) {
  const isVoid = /void/i.test(aff);
  // The Demon Lord runs a STRICT 3-turn rotation (Mike first-party, two CB videos 2026-08-07): Dark Nova →
  // Flesh Wither → Crushing Force, repeating — so Crushing Force lands every 3rd turn (t3/6/9/12). Keyed off
  // state.cbBossTurns % 3 below. (Was a cd-decrement rotation that DOUBLE-fired Crushing Force at t3,4,7,8…)
  let flaggedOnce = false;
  // THE FIGHT AS IT ACTUALLY PLAYS: CB always ends in a team WIPE — the boss's damage escalates (Gathering
  // Fury) until it out-paces the team's sustain and kills them, and TOTAL banked damage = survival duration ×
  // per-turn output. So the boss ALWAYS deals his escalating AoE (CB_BOSS_HIT × Gathering Fury ×
  // Decrease-ATK-on-boss × DEF mitigation), and fight LENGTH is an OUTPUT of (boss damage vs team sustain),
  // never a fixed wall. The boss side is calibrated to first-party captures (per-hit matches at turns 1/3/11);
  // the Gathering-Fury ramp slope is still coarse. (The old opt-in SIM_CB_SURVIVE toggle — an 'optimistic'
  // no-damage bracket that let the whole team survive to a turn-50 wall — is REMOVED: a fight that always
  // wipes has no business modelling nobody dying.) DEMON_LORD_WALL_TURNS remains only as a safety truncation.

  return {
    /** One Demon Lord turn. AoE HP damage is escalating+calibrated in 'real' mode; debuffs/stun are real. */
    actEnemy(state, boss) {
      const allies = state.allies.filter(a => a.alive);
      if (!allies.length) return;
      state.cbBossTurns = (state.cbBossTurns ?? 0) + 1;   // the AUTHORITATIVE clock (reviewer #1): the Demon Lord's OWN activations

      // Escalating AoE: `hits` × (CB_BOSS_HIT × Gathering Fury × Decrease-ATK-on-boss), each hit mitigated by
      // the target's DEF via the engine curve, dealt through dealDamage (shields/Block Damage/Ally Protection
      // all honoured). This is what kills the team over time; sustain buys turns = more banked DoT.
      const hitAll = (hits, base) => {
        const perHit = (base ?? CB_BOSS_HIT[difficulty] ?? CB_BOSS_HIT.Hard) * gatheringFury(state.cbBossTurns) * bossAtkFactor(boss);
        for (let h = 0; h < hits; h++)
          for (const a of state.allies.filter(x => x.alive))
            dealDamage(a, perHit * defMitigation(effectiveDef(a), boss.level ?? 100), 'direct', boss, state.allies);
      };

      if (!flaggedOnce) {
        flaggedOnce = true;
        flag(state, `SURVIVAL MODEL: boss AoE HP damage = CB_BOSS_HIT[${difficulty}]=${CB_BOSS_HIT[difficulty]} × Gathering Fury × Decrease-ATK × DEF mitigation; the team is ground down until it WIPES (fight length = boss damage vs sustain). Boss per-hit CALIBRATED to first-party captures — the Gathering-Fury ramp slope is still coarse.`);
        flag(state, 'Crushing Force = %MaxHP damage (CB_CRUSH_PCT=0.113, confirmed turn-3 video) + unresistable 1-turn Stun — DEF-independent, Gathering-Fury-escalated');
        flag(state, 'affinity A2 debuffs applied UNCONDITIONALLY (boss ACC unknown → no ACC-vs-RES roll)');
        flag(state, 'Crushing Force stun target = lowest effective HP (HP + shields), Veil/Taunt-honoured — VERIFIED vs first-party CB video (a [Shield] redirected the t9 stun off Ezio); replaces the highest-MaxHP placeholder');
        flag(state, 'boss DEF ≈ 0 (confirmed via turn-by-turn video hits) — direct-hit lands at ~full; reported separately from the confirmed-DoT chest');
      }

      // Strict 3-turn rotation (cbBossTurns is 1-based): 1 → FLESH WITHER, 2 → DARK NOVA, 0 (t3/6/9) → Crushing
      // Force. CORRECTED 2026-08-10 (Mike first-party: "the boss uses flesh wither turn 1") — was Dark Nova first.
      const rotation = state.cbBossTurns % 3;

      // ── A2 Flesh Wither ('Belittle'): 2-hit AoE (SOFTER per hit) that places the affinity debuff. ──
      if (rotation === 1) {
        const deb = affinityDebuffFor(aff);
        for (const a of allies) {
          applyDebuff(a, { ...deb });
          state.onAllyDebuffed?.(state, a, deb.type);
        }
        hitAll(2, FLESH_WITHER_HIT[difficulty]);
        state.log.push({ turn: state.turn, phase: 'demon lord', event: `Flesh Wither (2-hit) → ${deb.type}${deb.type === 'Poison' ? ' 2.5%' : ' ' + deb.value + '%'}` });
        return;
      }

      // ── A3 Dark Nova ('Crash Through'): 1-hit AoE on Void / 4-hit on affinity keys (HARDER per hit; then self +25% ATK). ──
      if (rotation === 2) {
        const hits = isVoid ? 1 : 4;
        hitAll(hits, DARK_NOVA_HIT[difficulty]);
        state.log.push({ turn: state.turn, phase: 'demon lord', event: `Dark Nova (${hits}-hit${isVoid ? ', Void' : ' + self +25% ATK after'})` });
        return;
      }

      // ── A1 Crushing Force (rotation === 0, every 3rd turn): single-target, unresistable 1-turn Stun + %MaxHP
      //    damage (DEF-independent), GF-escalated. Calibrated: turn-3 hit (gf=1) = 2,899 on Ezio → CB_CRUSH_PCT
      //    × Ezio MaxHP = 2,899. Targeting = LOWEST EFFECTIVE HP (current HP + shieldPool), honouring Veil/Taunt
      //    — the shared easiest-to-kill rule (chooseAllyTarget no-attacker fallback → DEF-independent, right for
      //    a %MaxHP stun). VERIFIED from two first-party CB videos (DonaHilvi, 2026-08-07): stuns Ezio t3/6/9,
      //    then REDIRECTS off Ezio when he is [Shield]ed (t9, Mausoleum run) or when another ally drops below him
      //    in current HP (t12 → Artor, Artor run). Replaces the old highest-MaxHP placeholder. ──
      const target = chooseAllyTarget(allies, null, null);
      if (target) {
        applyDebuff(target, { type: 'Stun', turns: 1 });   // "cannot be resisted"
        dealDamage(target, CB_CRUSH_PCT * gatheringFury(state.cbBossTurns) * (target.maxHp ?? 0), 'direct', boss, state.allies);
      }
      state.log.push({ turn: state.turn, phase: 'demon lord', event: `Crushing Force → Stun + %MaxHP ${target?.name ?? '-'}` });
    },
  };
}
