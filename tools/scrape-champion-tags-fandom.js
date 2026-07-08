#!/usr/bin/env node
/**
 * Fandom wiki champion-tags scraper — RSL Roster Coach
 *
 * Companion to tools/scrape-champion-tags.js (raid.guide). Fandom is CC-BY-SA and
 * an explicit Tier-1 primary source (CLAUDE.md source hierarchy) — verbatim Plarium skill
 * text, allowed for PROPOSED tags. Uses the MediaWiki API (action=parse&prop=wikitext),
 * NOT HTML scraping (the rendered site 403s generic clients; the API serves the
 * licensed content directly).
 *
 * Emits PROPOSED champion_tags (source_type='fandom_wiki') from the "Champion Skills"
 * wikitable: debuff/buff/support brackets mapped to the tag vocabulary, with unbooked
 * chance back-calculated. Auras go to a separate review file (placement/faction not
 * modeled — see KNOWN_GAPS). Skills/debuffs only; no ratings/strategy.
 *
 * Usage:
 *   node --env-file=.env.local tools/scrape-champion-tags-fandom.js --validate
 *   node --env-file=.env.local tools/scrape-champion-tags-fandom.js --champion "Kael"
 *   node --env-file=.env.local tools/scrape-champion-tags-fandom.js --gaps [--limit N]
 *   node --env-file=.env.local tools/scrape-champion-tags-fandom.js --all  [--limit N]
 *
 * --gaps  (default): DB champions NOT covered by the raid.guide scraper output,
 *          ordered zero-approved-tags first (the highest-priority coverage gaps).
 * --all:   every in-scope (Rare+) DB champion, same ordering.
 *
 * Outputs (output/):
 *   champion-tags-fandom-proposed.sql   proposed champion_tags INSERTs (idempotent, NOT EXISTS)
 *   skill-text-fandom.json              raw verbatim skill text per champion/slot (resume-merged)
 *   auras-fandom.txt                    aura data (tag/placement) for review — NOT champion_tags
 *   missing_from_fandom.txt             DB champions with no Fandom page or no skill table
 *   missing_tags_fandom.txt             brackets with no matching row in tags
 *   progress-fandom.txt                 checkpoint — completed names (skipped on rerun)
 *
 * Back-calc: unbooked = booked − Σ(Buff/Debuff Chance book increases).
 * ascension_required: active skills → 0; passives & auras → 3 (CLAUDE.md
 *   star-color rule, 2026-07-06); ASCENSION_OVERRIDES wins. Uncertain stays default — never
 *   guessed. A Fandom-shown ascended variant is noted for the reviewer, not auto-gated.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'output');
fs.mkdirSync(OUT, { recursive: true });

const API = (page) =>
  `https://raidshadowlegends.fandom.com/api.php?action=parse&page=${encodeURIComponent(page)}` +
  `&prop=wikitext&format=json&formatversion=2&redirects=1`;
const UA = { 'User-Agent': 'RSL-Roster-Coach-Scraper/1.0 (educational; CC-BY-SA content via MediaWiki API)' };
const DELAY_MS = 1000; // rate limit: 1s between requests

// bracket name → tags.name (base, non-AoE). Shared convention with the raid.guide scraper.
const TAG_MAP = {
  'poison': 'Poison', 'hp burn': 'HP Burn', 'weaken': 'Weaken',
  'decrease def': 'Decrease Defense', 'decrease atk': 'Decrease Attack',
  'decrease spd': 'Decrease Speed', 'decrease speed': 'Decrease Speed',
  'decrease turn meter': 'Decrease Turn Meter', 'decrease tm': 'Decrease Turn Meter',
  'stun': 'Stun', 'freeze': 'Freeze', 'sleep': 'Sleep', 'leech': 'Leech',
  'heal reduction': 'Heal Reduction', 'block revive': 'Block Revive',
  'block cooldowns': 'Block Cooldowns', 'block cooldown skills': 'Block Cooldowns',
  'counterattack': 'Counterattack',
  'increase def': 'Increase Defense', 'increase atk': 'Increase Attack',
  'increase spd': 'Increase Speed', 'increase turn meter': 'Increase Turn Meter',
  'continuous heal': 'Continuous Heal', 'shield': 'Shield', 'block damage': 'Block Damage',
  'ally protection': 'Ally Protection', 'revive': 'Revive', 'cleanse': 'Cleanse',
  'block debuffs': 'Block Debuffs',
  'provoke': 'Provoke', 'unkillable': 'Unkillable',
  'perfect veil': 'Perfect Veil', 'veil': 'Veil', 'fear': 'Fear', 'true fear': 'True Fear',
  'decrease acc': 'Decrease ACC', 'increase c.rate': 'Increase C.Rate', 'increase c.dmg': 'Increase C.DMG',
  'block buffs': 'Block Buffs', 'hex': 'Hex', 'bomb': 'Bomb',
  'reflect damage': 'Reflect Damage', 'block active skills': 'Block Active Skills',
  'decrease res': 'Decrease RES', 'strengthen': 'Strengthen', 'enfeeble': 'Enfeeble',
  'petrification': 'Petrification', 'buff spread': 'Buff Spread',
};
const nk = (s) => s.toLowerCase().replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ').trim();
const AOE_TAGS = new Set(['AoE Stun', 'AoE Freeze', 'AoE Sleep', 'AoE Decrease Turn Meter', 'AoE Damage', 'AoE Decrease Defense']);
// Aura icon names Fandom uses → our standardized aura tag names (post seed 63).
const AURA_MAP = {
  'hp aura': 'HP Aura', 'attack aura': 'ATK Aura', 'atk aura': 'ATK Aura',
  'defense aura': 'DEF Aura', 'def aura': 'DEF Aura', 'speed aura': 'SPD Aura', 'spd aura': 'SPD Aura',
  'accuracy aura': 'ACC Aura', 'acc aura': 'ACC Aura', 'resistance aura': 'RES Aura', 'res aura': 'RES Aura',
  'critical rate aura': 'C.Rate Aura', 'c.rate aura': 'C.Rate Aura',
};
const ASCENSION_OVERRIDES = {
  'Fayne|Decrease Attack': 3, 'Skeletor|Decrease RES': 3, 'Skeletor|Petrification': 3,
};

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const MODE = args.includes('--validate') ? 'validate'
  : flag('--champion') ? 'one'
  : args.includes('--all') ? 'all' : 'gaps';
const LIMIT = flag('--limit') ? parseInt(flag('--limit'), 10) : Infinity;

const esc = (s) => s.replace(/'/g, "''");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// strip wiki templates/links to readable text for the corpus + cooldown regex
const strip = (s) => s
  .replace(/\{\{Iconlink\|([^}|]+)\}\}/g, '[$1]')
  .replace(/\{\{Icon\|[^}]*\}\}/g, '')
  .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
  .replace(/<br\s*\/?>/gi, ' ').replace(/'''?/g, '').replace(/\s+/g, ' ').trim();

// ── Parse champion skills — two Fandom wikitext formats ──────────────────────
// Format A: one "|+ Champion Skills" table, columns (slot|times|targets|dmg|cd|desc).
// Format B (majority): one {|class="article-table"} PER ability, header
//   "!Ability N: Name[ROLE] - CD n Turns" / "(Cooldown: n)"; body rows carry the
//   description, {{iconlink|Debuff+}} list, and "Lvl. n Buff/Debuff Chance +x%".
function makeSkill(slot, name, desc, cooldown, targets = '') {
  return {
    slot, name, targets, desc, cooldown,
    aoe: /all enemies/i.test(targets) || /all enemies/i.test(desc),
    bookChance: [...desc.matchAll(/(?:Buff|Debuff) Chance \+(\d+)/gi)].reduce((s, m) => s + (+m[1] || 0), 0),
    cdReduce: [...desc.matchAll(/Cooldown\s*-\s*(\d+)/gi)].reduce((s, m) => s + (+m[1] || 0), 0),
    ascended: /ascend/i.test(desc),
  };
}

function parseFormatA(tbl) {
  const segs = tbl.split(/\n\|-/).slice(1);
  const skills = [];
  for (const seg of segs) {
    const line = seg.replace(/^\s*\n?/, '').split('\n')[0];
    if (!line.startsWith('|') || line.startsWith('|}')) continue;
    const cells = line.replace(/^\|/, '').split('||').map(c => c.trim());
    const c0 = cells[0] ?? '';
    let slot;
    if (/passive/i.test(c0) || /\[P\]/.test(c0)) slot = 'passive';
    else { const m = c0.match(/^A(\d+)/i); if (!m) continue; const n = +m[1]; slot = n === 0 ? 'aura' : `A${n}`; }
    const iconlink = c0.match(/\{\{[Ii]conlink\|([^}|]+)\}\}/);
    const name = c0.replace(/^A\d+\s*/i, '').replace(/^\s*passive\s*/i, '')
      .replace(/\{\{[^}]*\}\}/g, '').replace(/\[P\]/g, '').trim() || (iconlink ? iconlink[1].trim() : slot);
    const cdCell = cells[4] ?? ''; let cooldown = null;
    const cm = cdCell.match(/(\d+)/);
    if (cm) cooldown = +cm[1]; else if (/default/i.test(cdCell) && slot === 'A1') cooldown = 0;
    skills.push(makeSkill(slot, name, cells.slice(5).join(' || '), cooldown, cells[2] ?? ''));
  }
  return skills;
}

function parseFormatB(wikitext) {
  const tables = [...wikitext.matchAll(/\{\|\s*class="article-table"[\s\S]*?\n\|\}/g)].map(m => m[0]);
  const skills = [];
  for (const t of tables) {
    const hdr = (t.match(/!\s*([^\n]+)/) || [])[1] || '';
    const mAb = hdr.match(/Ability\s*(\d+)\s*:?\s*([^\[\-(]*)/i);
    const mPas = hdr.match(/Passive\s*:?\s*([^\[\-(]*)/i);
    const isPassive = /\[P\]|\[Passive\]/i.test(hdr) || (/passive/i.test(hdr) && !mAb);
    if (!mAb && !mPas && !isPassive) continue;
    let slot, name;
    if (mAb) { slot = isPassive ? 'passive' : `A${mAb[1]}`; name = mAb[2]; }
    else { slot = 'passive'; name = mPas ? mPas[1] : hdr; }
    name = name.replace(/\[[^\]]*\]/g, '').replace(/[-(].*$/, '').replace(/\{\{[^}]*\}\}/g, '').trim();
    let cooldown = null;
    const cd = hdr.match(/(?:CD|Cooldown)\s*:?\s*(\d+)/i);
    if (cd) cooldown = +cd[1]; else if (slot === 'A1') cooldown = 0;
    const body = t.replace(/^[\s\S]*?\n\|-/, ''); // drop the header row
    skills.push(makeSkill(slot, name, body, cooldown));
  }
  return skills.length ? skills : null;
}

function parseSkills(wikitext) {
  const a = wikitext.match(/\{\|[^\n]*\n\|\+\s*Champion Skills[\s\S]*?\n\|\}/);
  if (a) { const s = parseFormatA(a[0]); if (s && s.length) return s; }
  return parseFormatB(wikitext);
}

// nearest "N% chance" before position idx
function bookedBefore(desc, idx) {
  const chances = [...desc.slice(0, idx).matchAll(/(\d+)\s*%\s*chance/gi)];
  return chances.length ? +chances[chances.length - 1][1] : null;
}
// bracket occurrences (Iconlink + wikilink), document order, cleaned
function bracketsIn(desc) {
  const occ = [];
  for (const m of desc.matchAll(/\{\{[Ii]conlink\|([^}|]+)\}\}/g)) occ.push({ raw: m[1], idx: m.index });
  for (const m of desc.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) occ.push({ raw: m[1], idx: m.index });
  occ.sort((a, b) => a.idx - b.idx);
  return occ.map(o => ({ name: o.raw.replace(/\+$/, '').replace(/\s+[\d.]+%?$/, '').trim(), idx: o.idx }));
}
function mapTag(name, aoe, tagSet) {
  const base = TAG_MAP[nk(name)];
  if (!base) return null;
  if (aoe && AOE_TAGS.has(`AoE ${base}`)) return `AoE ${base}`;
  return tagSet.has(base) ? base : null;
}

async function fetchWikitext(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API(page), { headers: UA });
      if (!res.ok) { if (attempt === 3) return { fail: `HTTP ${res.status}` }; await sleep(1500 * attempt); continue; }
      const j = await res.json();
      if (j.error) return { fail: j.error.code };           // missingtitle etc.
      return { wikitext: j?.parse?.wikitext ?? '' };
    } catch (e) { if (attempt === 3) return { fail: `fetch ${e.message}` }; await sleep(1500 * attempt); }
  }
  return { fail: 'unknown' };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.SUPABASE_DB_URL) { console.error('Needs SUPABASE_DB_URL (run with --env-file).'); process.exit(1); }
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const rows = (await client.query(
    `select c.name, count(ct.*) filter (where ct.status='approved') as approved
     from champions c left join champion_tags ct on ct.champion_id=c.id
     where c.game_id='raid_shadow_legends' and coalesce(c.rarity,'') not in ('Common','Uncommon')
     group by c.name`)).rows;
  const tagSet = new Set((await client.query('select name from tags')).rows.map(r => r.name));
  await client.end();

  // raid.guide covered set (has ≥1 proposed tag in that scraper's output)
  let covered = new Set();
  try {
    const sql = fs.readFileSync(path.join(OUT, 'champion-tags-proposed.sql'), 'utf8');
    covered = new Set([...sql.matchAll(/ch\.name = '((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'")));
  } catch { /* raid.guide output absent — treat all as gaps */ }

  let worklist;
  if (MODE === 'one') worklist = [flag('--champion')];
  else if (MODE === 'validate') worklist = ['Kael'];
  else {
    let pool = rows.map(r => ({ name: r.name, approved: +r.approved }));
    if (MODE === 'gaps') pool = pool.filter(r => !covered.has(r.name));
    pool.sort((a, b) => a.approved - b.approved || a.name.localeCompare(b.name)); // zero-approved first
    worklist = pool.map(r => r.name);
  }

  const progressFile = path.join(OUT, 'progress-fandom.txt');
  const done = fs.existsSync(progressFile) && MODE !== 'one' && MODE !== 'validate'
    ? new Set(fs.readFileSync(progressFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)) : new Set();

  const tagSql = [], auraOut = [], missPage = [], missTag = [], rawText = [];
  let processed = 0, attempts = 0;

  for (const champ of worklist) {
    if (done.has(champ)) continue;
    if (attempts >= LIMIT) break;
    attempts++;
    await sleep(DELAY_MS);
    const { wikitext, fail } = await fetchWikitext(champ);
    if (fail) { missPage.push(`${champ} | ${fail}`); console.log(`  ${champ}: MISSING (${fail})`); continue; }
    const skills = parseSkills(wikitext);
    if (!skills || !skills.length) { missPage.push(`${champ} | no skill table`); console.log(`  ${champ}: no skill table`); continue; }

    if (MODE === 'validate') {
      console.log(`\n=== ${champ} ===`);
      skills.forEach(s => console.log(s.slot, '|', s.name, '| aoe', s.aoe, '| cd', s.cooldown, '| book+', s.bookChance, '| brackets', bracketsIn(s.desc).map(b => b.name)));
    }

    const emitted = new Set();
    for (const sk of skills) {
      rawText.push({ champion: champ, slot: sk.slot, skill: sk.name, description: strip(sk.desc), aoe: sk.aoe, cooldown: sk.cooldown, ascended: sk.ascended });
      if (sk.slot === 'aura') {
        const il = sk.name; const mapped = AURA_MAP[nk(il)] ?? null;
        auraOut.push(`-- ${champ}: aura "${il}"${mapped ? ` → ${mapped}` : ' (unmapped)'} | ${strip(sk.desc)}`);
        continue; // auras reviewed separately, not emitted as champion_tags
      }
      for (const br of bracketsIn(sk.desc)) {
        const tag = mapTag(br.name, sk.aoe, tagSet);
        if (!tag) { if (TAG_MAP[nk(br.name)] === undefined) missTag.push(`${champ} | ${sk.name} (${sk.slot}) | [${br.name}]`); continue; }
        if (emitted.has(tag)) continue;
        emitted.add(tag);
        const booked = bookedBefore(sk.desc, br.idx);
        const unbooked = booked != null ? booked - sk.bookChance : null;
        const ar = ASCENSION_OVERRIDES[`${champ}|${tag}`] ?? (sk.slot === 'passive' ? 3 : 0);
        const parts = [`Fandom ${sk.slot} ${sk.name}: [${br.name}].`];
        if (booked != null) parts.push(`${unbooked}% unbooked (${booked}% booked − ${sk.bookChance}% book).`);
        else parts.push('no explicit chance in description.');
        parts.push(sk.aoe ? 'AoE (all enemies).' : 'single-target.');
        if (sk.cooldown != null && sk.cdReduce) parts.push(`Cooldown ${sk.cooldown} unbooked, ${sk.cooldown - sk.cdReduce} fully booked.`);
        if (sk.slot === 'passive') parts.push('Passive — ascension_required defaulted to 3 (verify in-game Index).');
        if (sk.ascended) parts.push('Fandom shows an ascended variant — reviewer verify ascension gate.');
        const note = parts.join(' ');
        tagSql.push(
`insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'fandom_wiki', '${esc(note)}', 'fandom-wiki-scraper', now(), ${ar}
from champions ch join tags t on t.name = '${esc(tag)}'
where ch.game_id = 'raid_shadow_legends' and ch.name = '${esc(champ)}'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);`);
      }
    }
    processed++;
    if (MODE !== 'validate' && MODE !== 'one') fs.appendFileSync(progressFile, champ + '\n');
    console.log(`  ${champ}: ${skills.length} skill(s), ${emitted.size} tag(s)`);
  }

  if (MODE !== 'validate') {
    const hdr = `-- Proposed champion_tags from Fandom wiki (CC-BY-SA) skill descriptions.\n-- source_type=fandom_wiki, status=proposed. HUMAN REVIEW REQUIRED. Generated ${new Date().toISOString()}.\n\n`;
    if (tagSql.length) fs.appendFileSync(path.join(OUT, 'champion-tags-fandom-proposed.sql'),
      (fs.existsSync(path.join(OUT, 'champion-tags-fandom-proposed.sql')) ? '' : hdr) + tagSql.join('\n\n') + '\n\n');
    if (auraOut.length) fs.appendFileSync(path.join(OUT, 'auras-fandom.txt'), auraOut.join('\n') + '\n');
    if (missPage.length) fs.appendFileSync(path.join(OUT, 'missing_from_fandom.txt'), missPage.join('\n') + '\n');
    if (missTag.length) fs.appendFileSync(path.join(OUT, 'missing_tags_fandom.txt'), missTag.join('\n') + '\n');
    // resume-merged raw corpus
    const rawPath = path.join(OUT, 'skill-text-fandom.json');
    const byKey = new Map();
    try { for (const r of JSON.parse(fs.readFileSync(rawPath, 'utf8')).entries ?? []) byKey.set(`${r.champion}|${r.slot}`, r); } catch { /* first run */ }
    for (const r of rawText) byKey.set(`${r.champion}|${r.slot}`, r);
    const merged = [...byKey.values()];
    fs.writeFileSync(rawPath, JSON.stringify({
      source: 'raidshadowlegends.fandom.com MediaWiki API (verbatim skill text, CC-BY-SA)',
      extracted_at: new Date().toISOString(),
      champions: new Set(merged.map(r => r.champion)).size, skills: merged.length, entries: merged,
    }, null, 2));
  }
  console.log(`\nDone. ${processed} processed → ${tagSql.length} proposed tag(s), ${auraOut.length} aura(s), ${missPage.length} missing, ${missTag.length} unmapped bracket(s).`);
}
main().catch(e => { console.error(e); process.exit(1); });
