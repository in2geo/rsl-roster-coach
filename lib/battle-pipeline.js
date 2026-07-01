// Shared battle-processing core: map each battle's heroes to the player's
// user_champions (via the Gestal roster ⋈ DB champions), group identical
// (dungeon, stage, difficulty, team) runs, and evaluate each team against the
// seeded requirements with evaluateTeam(). Used by BOTH analyze-battles
// --cross-reference (reporting) and the outcomes upload (writing rows), so the
// map-heroes → evaluateTeam logic lives in one place.

import { evaluateTeam } from './match-engine.js';
import { buildUserChampions } from './gestal-context.js';

const CHAMPION_SELECT = `
  id, name, type_id, rarity, affinity, faction,
  base_hp, base_atk, base_def, base_spd, base_acc, base_res,
  base_crit_rate, base_crit_dmg,
  champion_tags ( tag_id, status, ascension_required, tags ( name, bypasses_accuracy_check ) )
`;

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Look up a battle hero (or a plain name) in the mapper: prefer the stable typeId,
// then the in-game display name, then the DB canonical name. Keeps mapping working
// when the display name differs from the seeded champion name.
export function lookupHero(mapper, hero) {
  const h = typeof hero === 'string' ? { name: hero } : (hero ?? {});
  return (h.typeId != null ? mapper.get(`t${h.typeId}`) : undefined)
      ?? (h.name != null ? mapper.get(norm(h.name)) : undefined);
}

// Stage number from a battle: explicit stageNumber, else the last 3 digits of the
// in-memory stageId.
export function stageOf(b) {
  return b.stageNumber
    ?? (typeof b.stageId === 'number' && b.stageId > 1000 ? b.stageId % 1000 : null);
}

/**
 * Build the hero-name → user_champion map: the Gestal roster state joined to the
 * DB champions (tags + base stats) by name. The shared "map heroes → champion"
 * step used by the cross-reference AND the outcomes processing.
 */
export async function buildRosterMapper(roster, supabase) {
  const owned = (roster?.champions ?? []).filter(c => !c.inStorage);
  const ownedNames   = [...new Set(owned.map(c => c.name).filter(Boolean))];
  // type_id stores the stable baseTypeId — fetch/match on that, not the per-copy typeId.
  const ownedTypeIds = [...new Set(owned.map(c => c.baseTypeId ?? c.typeId).filter(t => t != null))];

  // Fetch by typeId (stable) AND by name (fallback for champions whose type_id
  // isn't seeded yet), then merge unique by id.
  const byId = new Map();
  for (const [col, vals] of [['type_id', ownedTypeIds], ['name', ownedNames]]) {
    if (!vals.length) continue;
    const { data, error } = await supabase.from('champions').select(CHAMPION_SELECT)
      .eq('game_id', 'raid_shadow_legends').in(col, vals);
    if (error) throw new Error(`champions query failed: ${error.message}`);
    for (const c of data ?? []) byId.set(c.id, c);
  }

  const { userChampions } = buildUserChampions(roster?.champions ?? [], [...byId.values()]);

  // Key each champion by baseTypeId, every owned copy's per-copy typeId (battle
  // logs record either the base or an instance id), the in-game display name, and
  // the DB canonical name — so a battle hero resolves by whichever id it carries.
  const map = new Map();
  for (const uc of userChampions) {
    if (uc.type_id != null) map.set(`t${uc.type_id}`, uc);
    if (uc.display_name)    map.set(norm(uc.display_name), uc);
    map.set(norm(uc.champion.name), uc);
    for (const c of owned) {
      if ((c.baseTypeId ?? c.typeId) === uc.type_id && c.typeId != null) map.set(`t${c.typeId}`, uc);
    }
  }
  return map;
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
  const ucByName = await buildRosterMapper(roster, supabase);

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
    const team = g.names.map(n => lookupHero(ucByName, n)).filter(Boolean);
    const notInDb = g.names.filter(n => !lookupHero(ucByName, n));
    const evaluation = await evaluateTeam(team, g.dungeon, g.stage, g.difficulty);
    out.push({ ...g, team, notInDb, evaluation });
  }
  return { groups: out, evaluableCount: evaluable.length };
}
