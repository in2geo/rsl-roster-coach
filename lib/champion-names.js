// ── lib/champion-names.js ────────────────────────────────────────────────────
// Resolve a name-keyed TEXT reference to a canonical champion, via champions.name +
// champion_aliases (see migration 2026-07-02_champion_aliases + seed 28). The core
// roster mapping is typeId-based and name-independent; this is only for text inputs
// (patch-notes scraper, future NL sources) that arrive as names/short forms.
//
// Case-insensitive. A canonical champion name always wins over an alias with the same
// key. Ambiguous short forms are excluded at seed time (see gen-champion-aliases.mjs),
// so every alias here maps to exactly one champion.

// THE canonical champion-name normalizer. Strips case, punctuation (apostrophes,
// hyphens), spacing, and accents, so every spelling variant of one name collapses:
//   "Kro'khad" == "Krokhad" == "krok khad", "Losan K'Leth" == "Losan KLeth".
// Used by the resolver here AND (re-exported) by every ingestion path, so the whole
// app resolves names one way. Length differences (short vs long) do NOT collapse —
// those still need an alias row; this only unifies punctuation/case/spacing.
export const normalizeName = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')      // strip combining accents
    .replace(/[^\p{L}\p{N}]/gu, '');       // keep only letters + numbers

const norm = normalizeName;

/**
 * Build a resolver from pre-loaded rows (decoupled from pg / supabase).
 * @param {Array<{id,name}>} champions
 * @param {Array<{alias, champion_id?, id?, name?}>} aliases
 * @returns {{ resolve(raw): {id,name}|null, keys: string[] }}
 */
export function buildNameResolver(champions = [], aliases = []) {
  const nameById = new Map(champions.map((c) => [c.id, c.name]));
  const byKey = new Map();
  for (const c of champions) byKey.set(norm(c.name), { id: c.id, name: c.name });
  for (const a of aliases) {
    const id = a.champion_id ?? a.id;
    const name = a.name ?? nameById.get(id);
    const k = norm(a.alias);
    if (id && name && !byKey.has(k)) byKey.set(k, { id, name }); // canonical name wins
  }
  return {
    resolve: (raw) => byKey.get(norm(raw)) ?? null,
    keys: [...byKey.keys()],
  };
}

/** Convenience loader for a `pg` client. */
export async function loadNameResolver(client, gameId = 'raid_shadow_legends') {
  const { rows: champions } = await client.query(
    'select id, name from champions where game_id = $1', [gameId]);
  const { rows: aliases } = await client.query(
    `select ca.alias, ca.champion_id, ch.name
       from champion_aliases ca join champions ch on ch.id = ca.champion_id
      where ca.game_id = $1`, [gameId]);
  return buildNameResolver(champions, aliases);
}

/** One-shot resolve of a single raw name against the DB (pg client). */
export async function resolveChampionName(client, rawName, gameId = 'raid_shadow_legends') {
  return (await loadNameResolver(client, gameId)).resolve(rawName);
}
