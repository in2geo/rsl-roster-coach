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
  const resolve = (raw) => byKey.get(norm(raw)) ?? null;

  /* ── LOUD FAILURE (2026-07-21) ────────────────────────────────────────────────
   * `resolve()` returns null on a miss, and null is the whole problem. A raw-name
   * lookup that misses returns ZERO ROWS, and zero rows reads as a legitimate
   * finding — "this champion has no tags" — rather than "your lookup is broken".
   * That is not hypothetical: on 2026-07-21 a `where ch.name = 'Mavara'` query
   * reported her as a ZERO-TAG champion and it was very nearly written to memory as
   * fact. Her champions.name is "Mavara the Web Diviner"; `Mavara` is an alias that
   * this registry has always carried. The same day, a raw comparison against the
   * worksheet missed "Arne the White" and "Solanar the Gleaming" — also both
   * resolvable here. Measured afterwards: ALL 957 distinct worksheet champion names
   * resolve through this registry. 0% unresolvable. The registry was never the
   * problem; bypassing it was.
   *
   * So: prefer these. They convert a plausible wrong answer into a stack trace.
   * Same principle as buildUserChampions' required `dbAliases` — make the mistake
   * loud, keep the intent expressible (`resolve()` stays for callers that genuinely
   * want to test whether a name is known). */

  /** Resolve one name, or THROW naming the offender. */
  const resolveOrThrow = (raw, context = '') => {
    const hit = resolve(raw);
    if (hit) return hit;
    throw new Error(
      `champion-names: cannot resolve "${raw}"${context ? ` (${context})` : ''}. ` +
      `It is not a champions.name nor a champion_aliases.alias. Do NOT fall back to a raw ` +
      `name comparison — add an alias row, or fix the spelling.`);
  };

  /**
   * Resolve many names at once, THROWING once with EVERY miss listed (not just the
   * first — one-at-a-time failure turns a batch fix into N round trips).
   * @returns {Map<string,{id,name}>} keyed by the raw input string
   */
  const resolveAll = (rawNames = [], context = '') => {
    const out = new Map(); const missing = [];
    for (const raw of rawNames) {
      const hit = resolve(raw);
      if (hit) out.set(raw, hit); else missing.push(raw);
    }
    if (missing.length) {
      throw new Error(
        `champion-names: ${missing.length} of ${rawNames.length} names did not resolve` +
        `${context ? ` (${context})` : ''}: ${missing.slice(0, 15).join(', ')}` +
        `${missing.length > 15 ? ` … +${missing.length - 15} more` : ''}. ` +
        `Add alias rows or fix the spellings — never fall back to raw name matching.`);
    }
    return out;
  };

  return { resolve, resolveOrThrow, resolveAll, keys: [...byKey.keys()] };
}

/**
 * Index a ROSTER (or any champion list) so it can be looked up BY ANY NAME FORM.
 *
 * THE BUG THIS EXISTS TO KILL. Roughly 15 tools each define their own
 * `const norm = s => s.toLowerCase().replace(...)` and build `{[norm(c.name)]: c}`.
 * That collapses punctuation and case but knows NOTHING about aliases, so a hero whose
 * captured display name differs from `champions.name` silently vanishes — and the
 * caller reads it as "champion not on this team" rather than "lookup failed".
 * MEASURED 2026-07-21 over the battle log: of 64 distinct hero names, the local-norm
 * pattern misses 10 while this resolver misses 2. The 8 it silently drops include
 * "Thor Faehammer" and "Bambus Fourleaf" — a member of Don$Bambus's core five in every
 * run, absent from an analysis that day without any error.
 *
 * Both sides go through the registry, so "Mavara" finds "Mavara the Web Diviner" and
 * vice versa. Unresolvable roster entries are returned rather than thrown (a roster can
 * legitimately contain a champion the DB lacks) — but they are RETURNED, not swallowed,
 * so the caller must decide.
 *
 * @param {Array<{name:string}>} champions e.g. mapRoster(...).mapped
 * @param {{resolve:Function}} resolver from buildNameResolver / loadNameResolver*
 * @returns {{ get(rawName): object|undefined, unresolved: string[], size: number }}
 */
export function buildRosterIndex(champions = [], resolver) {
  if (!resolver?.resolve) throw new Error('buildRosterIndex: a resolver is required (buildNameResolver / loadNameResolver / loadNameResolverRest).');
  const byId = new Map(); const unresolved = [];
  for (const c of champions) {
    const hit = resolver.resolve(c?.name);
    if (hit) byId.set(hit.id, c); else unresolved.push(c?.name);
  }
  return {
    get: (raw) => { const h = resolver.resolve(raw); return h ? byId.get(h.id) : undefined; },
    unresolved,
    size: byId.size,
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

/**
 * Convenience loader for the REST path — most `tools/*.mjs` hold a `rest(path)` helper
 * rather than a pg client, and without this they hand-roll name matching instead (the
 * bypass that keeps re-introducing "champion not found" bugs). Paged: a plain select
 * caps at 1000 rows and there are already ~944 champions and ~505 aliases.
 * @param {(path: string) => Promise<any>} restGet GETs a PostgREST path, returns parsed JSON
 */
export async function loadNameResolverRest(restGet, gameId = 'raid_shadow_legends') {
  const page = async (path) => {
    let rows = [];
    for (let f = 0; ; f += 1000) {
      const d = await restGet(`${path}&limit=1000&offset=${f}`);
      if (!Array.isArray(d) || !d.length) break;
      rows = rows.concat(d);
      if (d.length < 1000) break;
    }
    return rows;
  };
  const champions = await page(`champions?select=id,name&game_id=eq.${gameId}`);
  const aliases   = await page('champion_aliases?select=alias,champion_id');
  return buildNameResolver(champions, aliases);
}
