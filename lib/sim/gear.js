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
