import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch: fetch } }
);

/**
 * Given a list of parsed champions and a content key, run the deterministic
 * matching engine against the dungeon-requirements table and return:
 * {
 *   content_label: string,
 *   team: [{ name, rarity, stars, level, tags[] }],
 *   gaps: [string],        // goals that no owned champion satisfies
 *   coverage: { [goalId]: { satisfied: bool, solution_label: string|null } }
 * }
 */
export async function matchRoster(parsedChampions, contentKey) {
  const contentLabel = {
    campaign:  "Campaign",
    spider:    "Spider's Den",
    clan_boss: "Clan Boss",
  }[contentKey] ?? contentKey;

  // 1. Look up which champions the player owns in our database
  const ownedNames = parsedChampions.map(c => c.name);
  const { data: ownedChampions, error: champErr } = await supabase
    .from('champions')
    .select(`
      id, name, rarity, faction, affinity,
      champion_tags ( tag_id, status, tags ( name ) )
    `)
    .in('name', ownedNames);

  if (champErr) throw new Error(`Supabase champions query failed: ${champErr.message} (URL: ${process.env.SUPABASE_URL})`);

  // Merge screenshot data (level, stars) with DB data (rarity, tags)
  const rosterMap = new Map(ownedChampions.map(c => [c.name, c]));
  const roster = parsedChampions
    .map(sc => {
      const db = rosterMap.get(sc.name);
      if (!db) return null;
      return {
        id:     db.id,
        name:   db.name,
        rarity: db.rarity,
        stars:  sc.stars,
        level:  sc.level,
        tags:   db.champion_tags
          .filter(ct => ct.status === 'approved')
          .map(ct => ct.tags.name),
      };
    })
    .filter(Boolean);

  // 2. Load dungeon goals for the requested content
  const { data: dungeon, error: dungeonErr } = await supabase
    .from('dungeons')
    .select('id, name')
    .eq('name', contentLabel)
    .single();

  if (dungeonErr || !dungeon) {
    throw new Error(`Dungeon "${contentLabel}" not found in database`);
  }

  const { data: goals, error: goalsErr } = await supabase
    .from('goals')
    .select(`
      id, description, is_informational,
      phases ( dungeon_stage_id,
        dungeon_stages ( dungeon_id ) ),
      goal_solutions (
        id, label, status,
        goal_solution_tags ( tag_id, tags ( name ) )
      )
    `)
    .eq('phases.dungeon_stages.dungeon_id', dungeon.id)
    .eq('goal_solutions.status', 'approved');

  if (goalsErr) throw new Error(`Supabase goals query failed: ${goalsErr.message}`);

  // 3. Match: for each goal, check if any solution is satisfied by the roster
  const rosterTagSet = new Set(roster.flatMap(c => c.tags));

  const coverage = {};
  const gaps = [];

  for (const goal of goals ?? []) {
    if (goal.is_informational) continue;

    const solutions = goal.goal_solutions ?? [];
    let satisfied = false;
    let matchedLabel = null;

    for (const sol of solutions) {
      const requiredTags = sol.goal_solution_tags.map(gst => gst.tags.name);
      if (requiredTags.every(t => rosterTagSet.has(t))) {
        satisfied = true;
        matchedLabel = sol.label;
        break;
      }
    }

    coverage[goal.id] = { description: goal.description, satisfied, solution_label: matchedLabel };
    if (!satisfied) gaps.push(goal.description);
  }

  // 4. Pick the best team (up to 5): champions that cover the most unsatisfied goals first
  const scored = roster.map(champ => {
    let score = 0;
    for (const goal of goals ?? []) {
      if (goal.is_informational) continue;
      if (coverage[goal.id]?.satisfied) continue;  // already covered
      for (const sol of goal.goal_solutions ?? []) {
        const req = sol.goal_solution_tags.map(g => g.tags.name);
        if (req.every(t => champ.tags.includes(t))) { score++; break; }
      }
    }
    return { ...champ, score };
  });

  scored.sort((a, b) => b.score - a.score || rarityWeight(b.rarity) - rarityWeight(a.rarity));
  const team = scored.slice(0, 5);

  return { content_label: contentLabel, team, gaps, coverage };
}

function rarityWeight(r) {
  return { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 }[r] ?? 0;
}
