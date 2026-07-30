// lib/sim/gear.js — turn a champion's gear_sets list into the GEAR_PROC definitions the engine rolls.
//
// The set→proc CATALOG is data/gear-set-procs.json (Plarium-verbatim, knowledge/RNG_REGISTRY.md #18). This
// module is the CONSUMER-side bridge: it reads a build's `gear_sets` (e.g. "Toxic×4"), keeps only COMPLETE
// chance-proc sets, and returns the procs the sim wires TODAY (the on-attack debuff/DoT/CC family) plus a
// DEFERRED list (counters / extra-turns / cooldown / defensive procs that need engine machinery we don't
// have yet) so the caller can FLAG them rather than silently drop them.
//
// TWO game rules baked in (doc §15): a gear-set debuff is INDEPENDENT of a skill debuff and IGNORES the
// attacker's ACC and the defender's RES — only the set chance rolls. And it is one chance PER TARGET, not
// per hit. An INCOMPLETE set (fewer pieces than `pieces`) grants NO proc.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TABLE = JSON.parse(fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data/gear-set-procs.json'), 'utf8'));

// what the engine consumes today: on-attack placement of a debuff/DoT/CC we already tick.
const WIRED_TRIGGERS = new Set(['on_attack']);
const WIRED_EFFECTS = new Set(['Poison', 'Hex', 'Sleep', 'Stun', 'Provoke']);

/** Parse one "Name×N" gear_sets entry → { name, count } (null if it isn't that shape). */
function parseSet(s) {
  const m = /^(.+?)\s*[×xX]\s*(\d+)$/.exec(String(s));
  return m ? { name: m[1].trim(), count: +m[2] } : null;
}

// ── EQUIPMENT-GENERATED SHIELDS (pool #2 of 3; Mike first-party 2026-07-30) ──────────────────────────────
// Shield/Bolster sets place a TEAMWIDE shield = a % of the WEARER's MAX HP at round start; Divine sets place a
// SELF shield. Multiple equipment sources SUM into one combined equipment pool (distinct from champion-skill
// [Shield] and [Magma Shield], which coexist with it). Values from data/gear-set-procs.json `_deterministic_sets`.
const TEAMWIDE_SHIELD_SETS = { 'Shield': { pieces: 2, pct: 0.30 }, 'Bolster': { pieces: 2, pct: 0.30 } };
const DIVINE_PIECES = 4, DIVINE_PCT = 0.15;   // "Divine <X>" 4-set: +15% MAX-HP SELF shield

/**
 * Combined per-champion equipment-shield value for a team (summed across all wearers, per the stacking rule).
 * @param {{name:string, maxHp:number, gearSets:string[]}[]} team
 * @returns {Object<string,number>} name → equipment-shield absorb value (0 if none)
 */
export function equipmentShieldFor(team = []) {
  let teamwide = 0;                       // Shield/Bolster: each complete set adds pct × THAT wearer's max HP, teamwide
  const selfDivine = {};                  // Divine: self-only
  for (const c of team) {
    for (const raw of (c.gearSets || [])) {
      const p = parseSet(raw); if (!p) continue;
      const tw = TEAMWIDE_SHIELD_SETS[p.name];
      if (tw && p.count >= tw.pieces) teamwide += tw.pct * (c.maxHp || 0);
      if (/^Divine\b/i.test(p.name) && p.count >= DIVINE_PIECES) selfDivine[c.name] = (selfDivine[c.name] || 0) + DIVINE_PCT * (c.maxHp || 0);
    }
  }
  const out = {};
  for (const c of team) out[c.name] = Math.round(teamwide + (selfDivine[c.name] || 0));
  return out;
}

/**
 * @param {string[]} gearSets e.g. ["Toxic×4", "Speed×2", "Lifesteal×1"]
 * @returns {{ wired: object[], deferred: object[] }}
 *   wired    — { set, trigger, chance, effect, value, turns } for COMPLETE on-attack-placement proc sets.
 *   deferred — { set, rng_type, trigger, reason } for COMPLETE proc sets whose family isn't wired yet.
 *   (incomplete sets and non-proc/stat sets are silently excluded — they grant no proc.)
 */
export function gearProcsForBuild(gearSets = []) {
  const wired = [], deferred = [];
  for (const raw of gearSets) {
    const p = parseSet(raw); if (!p) continue;
    const def = TABLE[p.name];
    if (!def || def.chance == null) continue;         // stat/deterministic set (or unknown) — no proc to roll
    if (p.count < def.pieces) continue;               // INCOMPLETE set — grants nothing
    if (WIRED_TRIGGERS.has(def.trigger) && WIRED_EFFECTS.has(def.effect)) {
      wired.push({ set: p.name, trigger: def.trigger, chance: def.chance, effect: def.effect,
                   value: def.value ?? null, turns: def.turns ?? 2 });
    } else {
      deferred.push({ set: p.name, rng_type: def.rng_type, trigger: def.trigger,
                      reason: `${def.rng_type} not yet wired (needs counter/extra-turn/cooldown/defensive machinery)` });
    }
  }
  return { wired, deferred };
}
