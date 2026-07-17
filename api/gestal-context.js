// ── api/gestal-context.js ────────────────────────────────────────────────────
// Local endpoint that auto-populates the roster from the Gestal export and packages
// it with battle history. Reads local files (Gestal output + battle log) via fs,
// joins the roster to DB champions (tags + base stats) by name, and returns both
// the match-engine-ready `userChampions` and the prompt `context`.
//
// GET /api/gestal-context[?account=<accountId>]

import { createClient } from '@supabase/supabase-js';
import {
  readGestalRoster,
  readBattleHistory,
  buildUserChampions,
  buildContext,
} from '../lib/gestal-context.js';
import { normalizeName } from '../lib/champion-names.js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

function json(res, status, body) { res.status(status).json(body); }

// Same champion projection the match-engine expects (mirrors /api/user-champions).
const CHAMPION_SELECT = `
  id, name, type_id, rarity, portrait_url, affinity, faction,
  base_hp, base_atk, base_def, base_spd, base_acc, base_res,
  base_crit_rate, base_crit_dmg,
  champion_tags ( tag_id, status, ascension_required, tags ( name, bypasses_accuracy_check ) )
`;

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const accountId = req.query?.account ?? null;

  const gestalRoster = readGestalRoster(accountId);
  if (!gestalRoster) {
    return json(res, 404, {
      error: 'No Gestal roster found. Run gestal-sync to produce a normalized export first.',
    });
  }

  const battleLog = readBattleHistory();

  // Look up DB champions the player owns (battle-ready only). Match on the stable
  // game typeId first, name as fallback — fetch by both and merge unique by id.
  const owned = (gestalRoster.champions ?? []).filter(c => !c.inStorage);
  const ownedNames   = [...new Set(owned.map(c => c.name).filter(Boolean))];
  const ownedTypeIds = [...new Set(owned.map(c => c.baseTypeId ?? c.typeId).filter(t => t != null))];

  // Alias registry so a roster name in ANY form (long/short/apostrophe) resolves.
  const { data: aliasRows } = await supabase
    .from('champion_aliases').select('alias, champion_id').eq('game_id', 'raid_shadow_legends');
  const ownedNorm = new Set(ownedNames.map(normalizeName));
  const aliasChampIds = [...new Set((aliasRows ?? [])
    .filter(a => ownedNorm.has(normalizeName(a.alias))).map(a => a.champion_id))];

  const dbById = new Map();
  for (const [col, vals] of [['type_id', ownedTypeIds], ['name', ownedNames], ['id', aliasChampIds]]) {
    if (!vals.length) continue;
    const { data, error } = await supabase
      .from('champions')
      .select(CHAMPION_SELECT)
      .eq('game_id', 'raid_shadow_legends')
      .in(col, vals);
    if (error) return json(res, 500, { error: error.message });
    for (const c of data ?? []) dbById.set(c.id, c);
  }
  const dbChampions = [...dbById.values()];

  const { userChampions, unmatched } = buildUserChampions(gestalRoster.champions, dbChampions, aliasRows ?? []);
  const context = buildContext({ gestalRoster, userChampions, unmatched, battleLog });

  return json(res, 200, {
    account: context.account,
    userChampions,   // ready to POST straight to /api/match
    context,         // roster + battle history for the recommendation prompt
  });
}
