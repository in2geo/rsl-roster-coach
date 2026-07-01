// Shared battle-processing core: map each battle's heroes to the player's
// user_champions (via the Gestal roster ⋈ DB champions), group identical
// (dungeon, stage, difficulty, team) runs, and evaluate each team against the
// seeded requirements with evaluateTeam(). Used by BOTH analyze-battles
// --cross-reference (reporting) and the outcomes upload (writing rows), so the
// map-heroes → evaluateTeam logic lives in one place.

import { evaluateTeam } from './match-engine.js';
import { buildUserChampions } from './gestal-context.js';

const CHAMPION_SELECT = `
  id, name, rarity, affinity, faction,
  base_hp, base_atk, base_def, base_spd, base_acc, base_res,
  base_crit_rate, base_crit_dmg,
  champion_tags ( tag_id, status, ascension_required, tags ( name, bypasses_accuracy_check ) )
`;

// Stage number from a battle: explicit stageNumber, else the last 3 digits of the
// in-memory stageId.
export function stageOf(b) {
  return b.stageNumber
    ?? (typeof b.stageId === 'number' && b.stageId > 1000 ? b.stageId % 1000 : null);
}

/**
 * @param battles  battle-log entries.
 * @param roster   Gestal roster ({ champions:[...] }) for hero→champion mapping.
 * @param supabase service-key client.
 * @returns { groups, evaluableCount } — each group has { dungeon, stage,
 *   difficulty, names, team (userChampions), notInDb, wins, losses, turns,
 *   battles (the raw entries), evaluation (evaluateTeam result incl.
 *   dungeon_stage_id) }.
 */
export async function groupAndEvaluateBattles(battles, roster, supabase) {
  const evaluable = (battles ?? []).filter(b => b.dungeon && stageOf(b) != null && (b.heroes ?? []).length);

  // Build the mapped roster once: Gestal state ⋈ DB champions (tags + base stats) by name.
  const ownedNames = [...new Set((roster?.champions ?? []).filter(c => !c.inStorage).map(c => c.name).filter(Boolean))];
  let dbChampions = [];
  if (ownedNames.length) {
    const { data, error } = await supabase.from('champions').select(CHAMPION_SELECT)
      .eq('game_id', 'raid_shadow_legends').in('name', ownedNames);
    if (error) throw new Error(`champions query failed: ${error.message}`);
    dbChampions = data ?? [];
  }
  const { userChampions } = buildUserChampions(roster?.champions ?? [], dbChampions);
  const ucByName = new Map(userChampions.map(uc => [uc.champion.name, uc]));

  // Group identical (dungeon, stage, difficulty, team) runs; tally outcomes.
  const groups = new Map();
  for (const b of evaluable) {
    const stage = stageOf(b);
    const names = (b.heroes ?? []).map(h => h.name).sort();
    const key = `${b.dungeon}|${stage}|${b.difficulty ?? ''}|${names.join(',')}`;
    if (!groups.has(key)) groups.set(key, { dungeon: b.dungeon, stage, difficulty: b.difficulty ?? null, names, wins: 0, losses: 0, turns: [], battles: [] });
    const g = groups.get(key);
    if (b.result === 'Victory') g.wins++; else if (b.result === 'Defeat') g.losses++;
    if (typeof b.turns === 'number') g.turns.push(b.turns);
    g.battles.push(b);
  }

  const out = [];
  for (const g of groups.values()) {
    const team = g.names.map(n => ucByName.get(n)).filter(Boolean);
    const notInDb = g.names.filter(n => !ucByName.has(n));
    const evaluation = await evaluateTeam(team, g.dungeon, g.stage, g.difficulty);
    out.push({ ...g, team, notInDb, evaluation });
  }
  return { groups: out, evaluableCount: evaluable.length };
}
