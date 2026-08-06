// lib/selection/leader.js — Archetype Selector: pick the team's LEADER (its aura), and hand the sim a
// battle-layer it can apply. In RSL only the leader's aura is live, so choosing a leader = choosing which
// aura runs. Reuses the solved mechanism in match-engine.pickLeaderFrom (INS-0005: SPD auras score by
// value; ACC auras by the deficit they close vs the content floor; affinity-restricted auras scale by how
// much of the team matches; on Clan Boss only "All Battles" auras apply — LEADER_AREA_APPLIES.clan_boss).
//
// This is NOT a re-implementation — it wires the existing leader logic into the archetype path and
// translates the chosen aura into the `leaderAura` shape sim/dragon-fixture.applyBattleLayers consumes.

import { pickLeaderFrom } from '../match-engine.js';

/**
 * @param {Array<{id,name,affinity,base_spd,...}>} teamChamps  - the 5 champs as DB-ish rows (need id + affinity)
 * @param {Object<string, object[]>} aurasByChampId            - champion id → champion_auras rows
 * @param {object} [opts] { contentArea='clan_boss', accFloor=0 }
 * @returns {object|null} the chosen leader { champion_id, name, aura_type, aura_value, restriction, score, ... }
 */
export function selectLeader(teamChamps, aurasByChampId, { contentArea = 'clan_boss', accFloor = 0 } = {}) {
  const auras = teamChamps.flatMap((c) => (aurasByChampId[c.id] ?? []).map((a) => ({ ...a, champion_id: c.id })));
  return pickLeaderFrom(teamChamps, auras, { contentArea, accFloor, thresholdStats: accFloor ? ['acc'] : [] });
}

/** Translate a chosen leader into the `leaderAura` battle-layer for the sim (applyBattleLayers). */
export function leaderAuraLayer(leader) {
  if (!leader) return null;
  return { type: leader.aura_type, value: leader.aura_value, restriction: leader.restriction };
}
