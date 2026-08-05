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

import { flag, applyDebuff } from './engine.js';
import { CB_POISON_CAPS, CB_HP_BURN_TICK } from '../cb-damage-model.js';

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
    disableMasteryMaxHpVsBoss: true,                                         // per-proc mastery cap unknown → exclude the %maxHP bonus (flagged)
  };
}

function makeDemonLord({ difficulty, aff, bossAtk }) {
  const isVoid = /void/i.test(aff);
  const cd = { darkNova: 0, fleshWither: 0 };   // Dark Nova (Crash Through) ~3-turn CD; Flesh Wither ~2
  let flaggedOnce = false;
  // Survival bracket: the boss's ATK-scaling HP damage is unknown → 'optimistic' (default) skips it (the
  // team survives the AoEs, but still eats the KNOWN debuffs + Void team-poison). 'none' also skips the
  // Void team-poison (a pure damage-output ceiling, zero incoming). Neither fabricates a boss-ATK number.
  const surviveMode = (process.env.SIM_CB_SURVIVE ?? 'optimistic').toLowerCase();

  return {
    /** One Demon Lord turn. Damage magnitudes are bracketed (see file header); debuffs/stun are real. */
    actEnemy(state, boss) {
      const allies = state.allies.filter(a => a.alive);
      if (!allies.length) return;
      state.cbBossTurns = (state.cbBossTurns ?? 0) + 1;   // the AUTHORITATIVE clock (reviewer #1): the Demon Lord's OWN activations

      if (!flaggedOnce) {
        flaggedOnce = true;
        flag(state, `BRACKETED: Demon Lord ATK unknown — Flesh Wither/Dark Nova HP damage SKIPPED (survival bracket, SIM_CB_SURVIVE=${surviveMode}); their debuffs still applied`);
        flag(state, 'BRACKETED: Crushing Force damage coefficient unknown (card tags [ATK] AND [Enemy MAX HP]) — HP damage SKIPPED; only the unresistable Stun lands');
        flag(state, 'BRACKETED: affinity A2 debuffs applied UNCONDITIONALLY (boss ACC unknown → no ACC-vs-RES roll, no boss weak-hit suppression) — NOT precise');
        flag(state, 'BRACKETED: Crushing Force stun target = highest-MaxHP ally (ARBITRARY placeholder; real CB targeting weighs killability / weak-affinity / Steadfast / defensive buffs / HP% / leader — not modelled)');
        flag(state, 'UNCALIBRATED: boss DEF unknown — team direct-hit damage at DEF=0 (upper bound); NOT included in the confirmed-DoT chest figure');
        flag(state, 'EXCLUDED: Warmaster/Giant Slayer %maxHP bonus disabled vs the Demon Lord (per-proc cap value unknown)');
        flag(state, 'BRACKETED: Gathering Fury ramp magnitude unknown — modelled only as the wall at Demon Lord turn ' + DEMON_LORD_WALL_TURNS);
      }

      // ── A3 Dark Nova ('Crash Through'): 1-hit on Void / 4-hit on the affinity keys, then self +25% ATK
      //    (affinity only). HP damage bracketed (needs boss ATK). ──
      if (cd.darkNova <= 0) {
        cd.darkNova = 3;
        // On affinity keys Dark Nova hits 4× then self-applies +25% ATK (AFTER the hits, so it doesn't boost
        // those 4 — reviewer #8). Both the hits and the buff are cosmetic in v0 (AoE HP damage bracketed), so
        // we only log the event rather than fabricate the ATK-scaled damage or a self-buff that does nothing.
        state.log.push({ turn: state.turn, phase: 'demon lord', event: `Dark Nova (${isVoid ? '1-hit, Void' : '4-hit + self +25% ATK after'}) — HP damage bracketed` });
        cd.fleshWither -= 1;
        return;
      }

      // ── A2 Flesh Wither ('Belittle'): 2-hit AoE that places the affinity debuff (real, known values).
      //    HP damage bracketed. ──
      if (cd.fleshWither <= 0) {
        cd.fleshWither = 2;
        const deb = affinityDebuffFor(aff);
        for (const a of allies) {
          if (deb.type === 'Poison') { if (surviveMode !== 'none') { applyDebuff(a, { ...deb }); state.onAllyDebuffed?.(state, a, 'Poison'); } }
          else { applyDebuff(a, { ...deb }); state.onAllyDebuffed?.(state, a, deb.type); }
        }
        state.log.push({ turn: state.turn, phase: 'demon lord', event: `Flesh Wither → ${deb.type}${deb.type === 'Poison' ? ' 2.5%' : ' ' + deb.value + '%'} (HP damage bracketed)` });
        cd.darkNova -= 1;
        return;
      }

      // ── A1 Crushing Force: single-target, unresistable 1-turn Stun (real). HP damage bracketed. Target =
      //    highest-MaxHP living ally (simplified; the real bias toward a favorable-affinity/killable target
      //    is flagged, not modelled). ──
      const target = allies.reduce((m, a) => (a.maxHp > (m?.maxHp ?? -1) ? a : m), null);
      if (target) applyDebuff(target, { type: 'Stun', turns: 1 });   // "cannot be resisted"
      state.log.push({ turn: state.turn, phase: 'demon lord', event: `Crushing Force → Stun ${target?.name ?? '-'} (HP damage bracketed)` });
      cd.darkNova -= 1; cd.fleshWither -= 1;
    },
  };
}
