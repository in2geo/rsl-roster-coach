#!/usr/bin/env node
/**
 * raid.guide champion-tags + aura scraper — RSL Roster Coach
 *
 * Fetches per-champion pages (/en/shadow-legends/<slug>/) and emits PROPOSED
 * champion_tags from the verbatim skill descriptions, plus auras to a separate
 * file (auras aren't a settled schema yet). Skills/debuffs only — per the
 * 2026-07-01 CLAUDE.md carve-out, raid.guide skill DESCRIPTIONS are Plarium's
 * literal text (allowed for proposed tags); ratings/strategy are not.
 *
 * Usage:
 *   node --env-file=.env.local tools/scrape-champion-tags.js --priority
 *   node --env-file=.env.local tools/scrape-champion-tags.js --champion "Kael"
 *   node --env-file=.env.local tools/scrape-champion-tags.js --all [--limit N]
 *   node --env-file=.env.local tools/scrape-champion-tags.js --validate   # Kael only, print parse
 *
 * Outputs (output/):
 *   champion-tags-proposed.sql     proposed champion_tags INSERTs (idempotent, NOT EXISTS)
 *   skill-text-raidguide.json      raw verbatim skill text per champion/slot (review corpus; resume-merged)
 *   auras.sql                      aura data (stat/pct/placement) as comments — schema TBD
 *   missing_from_raid_guide.txt    DB champions with no raid.guide page (404/empty)
 *   missing_tags.txt               debuffs with no matching row in tags
 *   progress.txt                   checkpoint — completed champion names (skipped on rerun)
 *
 * Notes:
 *  - Unbooked chance = booked (described) chance − Σ(Buff/Debuff chance book rows).
 *  - ascension_required defaults 0 (static HTML doesn't flag ascension). Known
 *    corrections applied from ASCENSION_OVERRIDES; anything uncertain stays 0 and
 *    is the reviewer's job — do NOT guess (a wrong value silently breaks matching).
 *  - Auras go to auras.sql only (Part 7 of spec). No aura rows in champion_tags.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'output');
fs.mkdirSync(OUT, { recursive: true });

const STATS_URL = 'https://raid.guide/en/stats/';
const PAGE = (slug) => `https://raid.guide/en/shadow-legends/${slug}/`;
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; RSL-Roster-Coach-Scraper/2.0)' };
const DELAY_MS = 500;

const PRIORITY = ['Kael', 'Pelops the Victor', 'Staltus Dragonbane', 'Fayne', 'Uugo'];

// raid.guide bracket name → tags.name (base, non-AoE). Extend as gaps surface.
const TAG_MAP = {
  'poison': 'Poison', 'hp burn': 'HP Burn', 'weaken': 'Weaken',
  'decrease def': 'Decrease Defense', 'decrease atk': 'Decrease Attack',
  'decrease spd': 'Decrease Speed', 'decrease speed': 'Decrease Speed',
  'decrease turn meter': 'Decrease Turn Meter', 'decrease tm': 'Decrease Turn Meter',
  'stun': 'Stun', 'freeze': 'Freeze', 'sleep': 'Sleep', 'leech': 'Leech',
  'heal reduction': 'Heal Reduction', 'block revive': 'Block Revive',
  'block cooldowns': 'Block Cooldowns', 'block cooldown skills': 'Block Cooldowns',
  'counterattack': 'Counterattack',
  // buffs / support the engine also matches on
  'increase def': 'Increase Defense', 'increase atk': 'Increase Attack',
  'increase spd': 'Increase Speed', 'increase turn meter': 'Increase Turn Meter',
  'continuous heal': 'Continuous Heal', 'shield': 'Shield', 'block damage': 'Block Damage',
  'ally protection': 'Ally Protection', 'revive': 'Revive', 'cleanse': 'Cleanse',
  'block debuffs': 'Block Debuffs',
  // 2026-07-01 vocabulary expansion (seeds/14_new_tags.sql):
  'provoke': 'Provoke', 'unkillable': 'Unkillable',
  'perfect veil': 'Perfect Veil', 'veil': 'Veil', 'fear': 'Fear', 'true fear': 'True Fear',
  'decrease acc': 'Decrease ACC', 'increase c.rate': 'Increase C.Rate', 'increase c.dmg': 'Increase C.DMG',
  'block buffs': 'Block Buffs', 'hex': 'Hex', 'bomb': 'Bomb',
  'reflect damage': 'Reflect Damage', 'block active skills': 'Block Active Skills',
};
// Normalize a raid.guide bracket to a TAG_MAP key: lowercase, collapse ". " → "."
// so "Increase C. RATE" and "Increase C.DMG" match ("increase c.rate"/"c.dmg").
const nk = (s) => s.toLowerCase().replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ').trim();
// stat auras raid.guide encodes → note only (not tags). placement normalization.
const AURA_STAT = { hp: 'hp', atk: 'atk', def: 'def', spd: 'spd', 'c.rate': 'crit_rate', 'c.dmg': 'crit_dmg', res: 'res', acc: 'acc', accuracy: 'acc', resist: 'res' };
// AoE-variant tags that actually exist (so we only prefix when the tag is real).
const AOE_TAGS = new Set(['AoE Stun', 'AoE Freeze', 'AoE Sleep', 'AoE Decrease Turn Meter', 'AoE Damage']);
// Ascension corrections confirmed from the in-game Index (raid.guide can't flag these,
// and the padlock is only visible on an owned, not-yet-ascended champion). DURABLE SOURCE
// OF TRUTH: seeds/31_ascension_overrides.sql (applied to champion_tags.ascension_required,
// and it also covers champions not on raid.guide, e.g. Skeletor). Keep this map in sync —
// it's applied at scrape time for raid.guide champions. Format: 'Champion|Tag': level.
const ASCENSION_OVERRIDES = {
  'Fayne|Decrease Attack': 3,
  'Skeletor|Decrease RES': 3,
  'Skeletor|Petrification': 3,
};

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const MODE = args.includes('--all') ? 'all' : args.includes('--validate') ? 'validate'
  : flag('--champion') ? 'one' : 'priority';
const LIMIT = flag('--limit') ? parseInt(flag('--limit'), 10) : Infinity;

const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/'/g, "''");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Derive raid.guide's slug convention from a champion name: lowercase, drop
// apostrophes/periods, non-alphanumeric runs → single hyphen (e.g. "Ash'nar" →
// "ashnar", "Ambassador Lethelin" → "ambassador-lethelin"). Used only as a fallback
// when the name isn't in the /stats/ slug dictionary.
const guessSlug = (name) => name.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Parsers ──────────────────────────────────────────────────────────────────
function parseAura(html) {
  // "HP 15 % Place:All battles"  (stat, pct, placement)
  const m = strip(html).match(/([A-Za-z.]+)\s+([\d.]+)\s*%\s*Place:\s*([A-Za-z ]+?)(?:\s{2,}|$|[A-Z][a-z]+ skills)/);
  if (!m) return null;
  const stat = AURA_STAT[m[1].toLowerCase()] ?? m[1].toLowerCase();
  const placement = m[3].trim().toLowerCase().replace(/^all battles$/, 'all');
  return { stat, pct: +(parseFloat(m[2]) / 100).toFixed(4), placement, raw: m[0].trim() };
}

function parseSkills(html) {
  // Each skill = <div class="skill"> … <h4>Name</h4> … <article>desc</article> …
  // <table> book levels (Level|Type|Amount).
  const blocks = html.split('<div class="skill"').slice(1);
  const skills = [];
  let slot = 0;
  for (const b of blocks) {
    const name = (b.match(/<h4>([^<]+)<\/h4>/) || [])[1]?.trim();
    if (!name) continue;
    slot++;
    const article = (b.match(/<article>([\s\S]*?)<\/article>/) || [])[1] ?? '';
    const desc = strip(article);
    // debuff/buff brackets: <color=...>[Name]</color>
    const brackets = [...article.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
    // book table Buff/Debuff chance total + cooldown reductions
    const table = (b.match(/<table[\s\S]*?<\/table>/) || [])[0] ?? '';
    const rows = [...table.matchAll(/<tr>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g)]
      .map(m => ({ level: strip(m[1]), type: strip(m[2]), amount: strip(m[3]) }));
    const bookChance = rows.filter(r => /buff\/debuff chance/i.test(r.type))
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const cdReduce = rows.filter(r => /cooldown/i.test(r.type)).length;
    const cdMatch = desc.match(/cooldown[:\s]+(\d+)/i);
    const cooldown = cdMatch ? +cdMatch[1] : (slot === 1 ? 0 : null);
    skills.push({ name, slot: `A${slot}`, desc, brackets, bookChance, cdReduce, cooldown, aoe: /all enemies/i.test(desc) });
  }
  return skills;
}

// booked chance for a bracket = nearest "N% chance" before it in the description
function bookedChanceFor(desc, bracketName) {
  const idx = desc.indexOf(`[${bracketName}]`);
  if (idx < 0) return null;
  const before = desc.slice(0, idx);
  const chances = [...before.matchAll(/(\d+)\s*%\s*chance/gi)];
  return chances.length ? +chances[chances.length - 1][1] : null;
}

function mapTag(bracketName, aoe, tagSet) {
  const base = TAG_MAP[nk(bracketName)];
  if (!base) return null;
  if (aoe && AOE_TAGS.has(`AoE ${base}`)) return `AoE ${base}`;
  return tagSet.has(base) ? base : null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.SUPABASE_DB_URL) { console.error('Needs SUPABASE_DB_URL. Run with --env-file=.env.local'); process.exit(1); }
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  // Scope: Rare and above only. The app's audience owns Rare+; Common/Uncommon are
  // out of scope (product decision 2026-07-02) — don't scrape or tag them.
  const dbChamps = (await client.query(
    "select name from champions where game_id='raid_shadow_legends' " +
    "and coalesce(rarity,'') not in ('Common','Uncommon') order by name")).rows.map(r => r.name);
  const tagSet = new Set((await client.query('select name from tags')).rows.map(r => r.name));
  await client.end();

  console.log(`Fetching slug dictionary from ${STATS_URL} …`);
  const statsHtml = await (await fetch(STATS_URL, { headers: UA })).text();
  const slugByName = new Map();
  for (const m of statsHtml.matchAll(/href="\/en\/shadow-legends\/([a-z0-9-]+)\/"\s+class="simple-champion-link">([^<]+)</g)) {
    slugByName.set(m[2].trim().toLowerCase(), m[1]);
  }
  console.log(`  ${slugByName.size} champion slugs.\n`);

  const worklist = MODE === 'one' ? [flag('--champion')]
    : MODE === 'validate' ? ['Kael']
    : MODE === 'all' ? dbChamps
    : PRIORITY;

  // checkpoint
  const progressFile = path.join(OUT, 'progress.txt');
  const done = fs.existsSync(progressFile) && MODE === 'all'
    ? new Set(fs.readFileSync(progressFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)) : new Set();

  const tagSql = [], auraSql = [], missPage = [], missTag = [], rawText = [];
  let processed = 0;

  for (const champ of worklist) {
    if (processed >= LIMIT) break;
    if (done.has(champ)) continue;
    // Prefer the /stats/ dictionary slug; fall back to a derived slug for champions
    // absent from that (curated) table — some still HAVE a per-champion page (e.g.
    // Aeshma → /en/shadow-legends/aeshma/). A real 404 below confirms genuine absence.
    const slug = slugByName.get(champ.toLowerCase()) ?? guessSlug(champ);

    // Fetch with retry — raid.guide rate-limits the tail of a long batch, so a
    // transient "fetch failed" must be retried (with backoff) before giving up.
    // A real 404 is genuine (champion not on the site) — no retry.
    let html, fail = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await sleep(attempt === 1 ? DELAY_MS : 1500 * attempt);
      try {
        const res = await fetch(PAGE(slug), { headers: UA });
        if (res.status === 404) { fail = `HTTP 404`; break; }
        if (!res.ok) { fail = `HTTP ${res.status}`; continue; }
        html = await res.text(); fail = null; break;
      } catch (e) { fail = `fetch error ${e.message}`; }
    }
    if (html == null) { missPage.push(`${champ} | ${champ} | ${slug} | ${fail}`); continue; }

    const aura = parseAura(html);
    if (aura) auraSql.push(`-- ${champ}: ${aura.stat} ${(aura.pct * 100)}% place=${aura.placement}\n--   (raw: ${aura.raw})`);

    const skills = parseSkills(html);
    if (MODE === 'validate') { console.log(`\n=== ${champ} (${slug}) ===`); console.log('aura:', aura); skills.forEach(s => console.log(s.slot, s.name, '| aoe', s.aoe, '| book+', s.bookChance, '| brackets', s.brackets, '| cd', s.cooldown)); }

    const emitted = new Set();
    for (const sk of skills) {
      // Raw verbatim skill text dump (Plarium's literal description per the carve-out).
      // Human-review corpus — NOT auto-tagged. Keyed champion|slot for resume-merge.
      rawText.push({ champion: champ, slug, slot: sk.slot, skill: sk.name, description: sk.desc, aoe: sk.aoe, cooldown: sk.cooldown });
      for (const br of sk.brackets) {
        const tag = mapTag(br, sk.aoe, tagSet);
        if (!tag) { if (TAG_MAP[nk(br)] === undefined) missTag.push(`${champ} | ${sk.name} (${sk.slot}) | [${br}] | (no mapping)`); continue; }
        if (emitted.has(`${champ}|${tag}`)) continue;   // one row per distinct tag
        emitted.add(`${champ}|${tag}`);
        const booked = bookedChanceFor(sk.desc, br);
        const unbooked = booked != null ? booked - sk.bookChance : null;
        const ar = ASCENSION_OVERRIDES[`${champ}|${tag}`] ?? 0;
        const parts = [`raid.guide ${sk.slot} ${sk.name}: [${br}]`];
        if (booked != null) parts.push(`${unbooked}% unbooked (${booked}% booked − ${sk.bookChance}% book).`);
        else parts.push('no explicit chance in description.');
        parts.push(sk.aoe ? 'AoE (all enemies).' : 'single-target.');
        if (sk.cooldown != null && sk.cdReduce) parts.push(`Cooldown ${sk.cooldown} unbooked, ${sk.cooldown - sk.cdReduce} fully booked.`);
        if (ar) parts.push('ascension_required set from confirmed in-game Index.');
        const note = parts.join(' ');
        tagSql.push(
`insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'raid_guide', '${esc(note)}', 'raid-guide-scraper', now(), ${ar}
from champions ch join tags t on t.name = '${esc(tag)}'
where ch.game_id = 'raid_shadow_legends' and ch.name = '${esc(champ)}'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);`);
      }
    }
    processed++;
    if (MODE === 'all') fs.appendFileSync(progressFile, champ + '\n');
    console.log(`  ${champ}: ${skills.length} skill(s), aura=${aura ? aura.stat : 'none'}`);
  }

  const header = `-- Proposed champion_tags from raid.guide skill descriptions (source_type=raid_guide,\n-- status=proposed). HUMAN REVIEW REQUIRED. Generated ${new Date().toISOString()}.\n\n`;
  fs.writeFileSync(path.join(OUT, 'champion-tags-proposed.sql'), header + tagSql.join('\n\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'auras.sql'), `-- Aura data (stat/pct/placement) — schema TBD, review only. Generated ${new Date().toISOString()}.\n\n` + auraSql.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'missing_from_raid_guide.txt'), missPage.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'missing_tags.txt'), missTag.join('\n') + '\n');
  // Raw skill-text corpus. Merge with any prior run (resume-safe) keyed champion|slot.
  const rawPath = path.join(OUT, 'skill-text-raidguide.json');
  const byKey = new Map();
  try { for (const r of JSON.parse(fs.readFileSync(rawPath, 'utf8')).entries ?? []) byKey.set(`${r.champion}|${r.slot}`, r); } catch { /* first run */ }
  for (const r of rawText) byKey.set(`${r.champion}|${r.slot}`, r);
  const merged = [...byKey.values()];
  fs.writeFileSync(rawPath, JSON.stringify({
    source: 'raid.guide per-champion pages (verbatim skill descriptions)',
    extracted_at: new Date().toISOString(),
    champions: new Set(merged.map(r => r.champion)).size,
    skills: merged.length,
    note: 'Plarium literal skill text (2026-07-01 carve-out). Human-review corpus; NOT auto-tagged.',
    entries: merged,
  }, null, 2));
  console.log(`\nDone. ${processed} champion(s) processed → ${tagSql.length} proposed tag(s), ${auraSql.length} aura(s), ${missPage.length} missing page(s), ${missTag.length} unmapped debuff(s).`);
  console.log(`Output in ${OUT}/`);
}
main().catch(e => { console.error(e); process.exit(1); });
