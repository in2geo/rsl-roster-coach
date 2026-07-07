#!/usr/bin/env node
/**
 * Fandom → Skills_Raw worksheet feeder — RSL Roster Coach
 *
 * Scrapes the Fandom wiki (CC-BY-SA, MediaWiki API) for champion skill data and
 * emits Skills_Raw-shaped rows to an intermediate JSON. Does NOT write Supabase
 * and does NOT touch the .xlsx — the worksheet load is a separate, human-gated
 * step. Champion roster + Stable Champion ID come from champions_tab.csv.
 *
 * Usage (run from repo/, needs --env-file for the Supabase approved-count sort):
 *   node --env-file=.env.local tools/scrape-skills-to-worksheet.js --sample
 *   node --env-file=.env.local tools/scrape-skills-to-worksheet.js --all [--limit N]
 *
 * Output:
 *   output/skills_raw.json                 Skills_Raw rows (merged/resumable)
 *   ../fandom_missing.txt   (Desktop)      404 / no Fandom page
 *   ../fandom_no_skills.txt (Desktop)      page exists, no parseable skills
 *   output/progress-worksheet.txt          checkpoint
 *
 * Ascension Gated? is ALWAYS "Needs Review" from this source (per spec). Verification
 * Status defaults "Pending". Unbooked chance = booked − Σ(Buff/Debuff Chance book).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'output');
const DESKTOP = path.join(REPO, '..');           // C:\...\RSL-coach\
const CHAMPS_CSV = path.join(DESKTOP, 'champions_tab.csv');
fs.mkdirSync(OUT, { recursive: true });

const TODAY = new Date().toISOString().slice(0, 10);
const API = (p) => `https://raidshadowlegends.fandom.com/api.php?action=parse&page=${encodeURIComponent(p)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
const UA = { 'User-Agent': 'RSL-Roster-Coach-Scraper/1.0 (educational; CC-BY-SA via MediaWiki API)' };
const DELAY_MS = 1000;
const BATTLE_LOG = ['Kael', 'Pelops', 'Staltus', 'Fayne', 'Uugo', 'Gnut', 'Tagoar', 'Fahrakin'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const strip = (s) => s
  .replace(/\{\{[Ii]conlink\|([^}|]+)\}\}/g, '[$1]').replace(/\{\{Icon\|[^}]*\}\}/g, '')
  .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').replace(/<br\s*\/?>/gi, ' ')
  .replace(/'''?/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"') // smart quotes → ASCII
  .replace(/\s+/g, ' ').trim();
// Clean ability prose for the Description column: first body cell only, cut at the
// "Lvl./Level N" book progression, drop table row markers.
const cleanDesc = (raw) => strip((raw.split(/\n\|-/)[0] || '').replace(/^\s*\|+/, ''))
  .split(/\s*(?:Lvl\.|Level)\s*\d/)[0].replace(/\s*\|+\s*$/,'').trim();
const nk = (s) => s.toLowerCase().replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ').trim();

// debuff/buff bracket → canonical name (for the Debuff Name column; review-facing text)
const DEBUFFS = new Set(['poison', 'hp burn', 'weaken', 'decrease def', 'decrease atk', 'decrease spd',
  'decrease speed', 'decrease turn meter', 'decrease tm', 'stun', 'freeze', 'sleep', 'heal reduction',
  'block revive', 'block cooldowns', 'block buffs', 'block active skills', 'decrease acc', 'decrease res',
  'hex', 'bomb', 'fear', 'true fear', 'provoke', 'petrification', 'enfeeble']);

// ── wikitext skill parsing (both Fandom page formats) ────────────────────────
function makeSkill(slot, name, desc, cooldown, targets = '') {
  return { slot, name, targets, desc, cooldown,
    aoe: /all enemies/i.test(targets) || /all enemies/i.test(desc),
    bookChance: [...desc.matchAll(/(?:Buff|Debuff) Chance \+(\d+)/gi)].map(m => +m[1]),
    cdReduce: [...desc.matchAll(/Cooldown\s*-\s*(\d+)/gi)].reduce((s, m) => s + (+m[1] || 0), 0) };
}
function parseFormatA(tbl) {
  const skills = [];
  for (const seg of tbl.split(/\n\|-/).slice(1)) {
    const line = seg.replace(/^\s*\n?/, '').split('\n')[0];
    if (!line.startsWith('|') || line.startsWith('|}')) continue;
    const cells = line.replace(/^\|/, '').split('||').map(c => c.trim());
    const c0 = cells[0] ?? ''; let slot;
    if (/passive/i.test(c0) || /\[P\]/.test(c0)) slot = 'Passive';
    else { const m = c0.match(/^A(\d+)/i); if (!m) continue; const n = +m[1]; slot = n === 0 ? 'Aura' : `A${n}`; }
    const il = c0.match(/\{\{[Ii]conlink\|([^}|]+)\}\}/);
    const name = c0.replace(/^A\d+\s*/i, '').replace(/^\s*passive\s*/i, '').replace(/\{\{[^}]*\}\}/g, '').replace(/\[P\]/g, '').trim() || (il ? il[1].trim() : slot);
    const cd = (cells[4] ?? '').match(/(\d+)/); let cooldown = cd ? +cd[1] : (/default/i.test(cells[4] ?? '') && slot === 'A1' ? 0 : null);
    skills.push(makeSkill(slot, name, cells.slice(5).join(' || '), cooldown, cells[2] ?? ''));
  }
  return skills;
}
function parseFormatB(wt) {
  const skills = [];
  for (const t of [...wt.matchAll(/\{\|\s*class="article-table"[\s\S]*?\n\|\}/g)].map(m => m[0])) {
    const hdr = (t.match(/!\s*([^\n]+)/) || [])[1] || '';
    const mAb = hdr.match(/Ability\s*(\d+)\s*:?\s*([^\[\-(]*)/i);
    const mPas = hdr.match(/Passive\s*:?\s*([^\[\-(]*)/i);
    const isPassive = /\[P\]|\[Passive\]/i.test(hdr) || (/passive/i.test(hdr) && !mAb);
    if (!mAb && !mPas && !isPassive) continue;
    let slot, name;
    if (mAb) { slot = isPassive ? 'Passive' : `A${mAb[1]}`; name = mAb[2]; } else { slot = 'Passive'; name = mPas ? mPas[1] : hdr; }
    name = name.replace(/\[[^\]]*\]/g, '').replace(/[-(].*$/, '').replace(/\{\{[^}]*\}\}/g, '').trim();
    const cd = hdr.match(/(?:CD|Cooldown)\s*:?\s*(\d+)/i); let cooldown = cd ? +cd[1] : (slot === 'A1' ? 0 : null);
    skills.push(makeSkill(slot, name, t.replace(/^[\s\S]*?\n\|-/, ''), cooldown));
  }
  return skills.length ? skills : null;
}
function parseSkills(wt) {
  const a = wt.match(/\{\|[^\n]*\n\|\+\s*Champion Skills[\s\S]*?\n\|\}/);
  if (a) { const s = parseFormatA(a[0]); if (s && s.length) return s; }
  return parseFormatB(wt);
}
function bracketsIn(desc) {
  const occ = [];
  for (const m of desc.matchAll(/\{\{[Ii]conlink\|([^}|]+)\}\}/g)) occ.push({ raw: m[1], idx: m.index });
  for (const m of desc.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) occ.push({ raw: m[1], idx: m.index });
  occ.sort((a, b) => a.idx - b.idx);
  return occ.map(o => ({ name: o.raw.replace(/\+$/, '').replace(/\s+([\d.]+)%?$/, '').trim(),
    pct: (o.raw.match(/([\d.]+)\s*%?$/) || [])[1] ?? null, idx: o.idx }));
}
const bookedBefore = (desc, idx) => { const c = [...desc.slice(0, idx).matchAll(/(\d+)\s*%\s*chance/gi)]; return c.length ? +c[c.length - 1][1] : null; };

async function fetchWikitext(page) {
  for (let a = 1; a <= 3; a++) {
    try {
      const res = await fetch(API(page), { headers: UA });
      if (!res.ok) { if (a === 3) return { fail: `HTTP ${res.status}` }; await sleep(1500 * a); continue; }
      const j = await res.json();
      if (j.error) return { fail: j.error.code };
      return { wt: j?.parse?.wikitext ?? '' };
    } catch (e) { if (a === 3) return { fail: `fetch ${e.message}` }; await sleep(1500 * a); }
  }
  return { fail: 'unknown' };
}

function readChampionsCsv() {
  const raw = fs.readFileSync(CHAMPS_CSV, 'utf8').replace(/^﻿/, '');
  const [head, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  const iId = cols.indexOf('Stable Champion ID'), iName = cols.indexOf('Champion'), iRar = cols.indexOf('Rarity');
  return lines.map(l => { const c = l.split(','); return { id: c[iId], name: c[iName], rarity: c[iRar] }; })
    .filter(r => r.name && !['Common', 'Uncommon'].includes(r.rarity));
}

async function main() {
  const MODE = process.argv.includes('--all') ? 'all' : 'sample';
  const li = process.argv.indexOf('--limit'); const LIMIT = li >= 0 ? +process.argv[li + 1] : Infinity;
  const champs = readChampionsCsv();

  // priority sort (Step 4): zero-approved-in-Supabase → battle-log → rest alphabetical
  let approved = new Set();
  if (process.env.SUPABASE_DB_URL) {
    const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    approved = new Set((await client.query(
      `select distinct c.name from champions c join champion_tags ct on ct.champion_id=c.id
       where ct.status='approved'`)).rows.map(r => r.name.toLowerCase()));
    await client.end();
  }
  const isBattleLog = (n) => BATTLE_LOG.some(b => n.toLowerCase().startsWith(b.toLowerCase()));
  const hasApproved = (n) => approved.has(n.toLowerCase()) || [...approved].some(a => n.toLowerCase().startsWith(a));
  const rank = (r) => isBattleLog(r.name) ? 1 : (!hasApproved(r.name) ? 0 : 2); // 0=zero-approved first, 1=battle-log, 2=rest
  champs.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  const worklist = MODE === 'sample' ? champs.filter(r => isBattleLog(r.name)) : champs;

  const progressFile = path.join(OUT, 'progress-worksheet.txt');
  const done = fs.existsSync(progressFile) && MODE === 'all'
    ? new Set(fs.readFileSync(progressFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)) : new Set();

  const rows = [], missing = [], noSkills = [];
  let attempts = 0, scraped = 0;
  for (const ch of worklist) {
    if (done.has(ch.name)) continue;
    if (attempts >= LIMIT) break;
    attempts++;
    await sleep(DELAY_MS);
    const { wt, fail } = await fetchWikitext(ch.name);
    if (fail) { missing.push(`${ch.id} | ${ch.name} | ${fail}`); console.log(`  ${ch.name}: MISSING (${fail})`); continue; }
    const skills = parseSkills(wt);
    if (!skills || !skills.length) { noSkills.push(`${ch.id} | ${ch.name} | page exists, no skill table`); console.log(`  ${ch.name}: no skills`); continue; }
    scraped++;
    for (const sk of skills) {
      const bookList = sk.bookChance;
      const bookSum = bookList.reduce((s, n) => s + n, 0);
      const cdBooked = (sk.cooldown != null && sk.cdReduce) ? sk.cooldown - sk.cdReduce : sk.cooldown;
      const debuffs = bracketsIn(sk.desc).filter(b => DEBUFFS.has(nk(b.name)));
      const base = {
        'Champion ID': ch.id, 'Champion': ch.name, 'Slot': sk.slot, 'Skill Name': strip(sk.name),
        'Description': cleanDesc(sk.desc), 'Cooldown Unbooked': sk.cooldown ?? '', 'Cooldown Booked': cdBooked ?? '',
        'Book Increases (list)': bookList.length ? bookList.map(n => `+${n}%`).join(', ') : '',
        'Ascension Gated?': 'Needs Review', 'Source': 'fandom_wiki', 'Date Scraped': TODAY,
        'Verification Status': 'Pending', 'Notes': '',
      };
      if (!debuffs.length) {
        rows.push({ ...base, 'Debuff Name': '', 'Debuff Chance Unbooked': '', 'Debuff Chance Booked': '' });
      } else {
        const seen = new Set();
        for (const d of debuffs) {
          if (seen.has(nk(d.name))) continue; seen.add(nk(d.name));
          const booked = bookedBefore(sk.desc, d.idx);
          rows.push({ ...base, 'Debuff Name': d.name,
            'Debuff Chance Booked': booked ?? '', 'Debuff Chance Unbooked': booked != null ? booked - bookSum : '' });
        }
      }
    }
    if (MODE === 'all') fs.appendFileSync(progressFile, ch.name + '\n');
    console.log(`  ${ch.name}: ${skills.length} skill(s)`);
  }

  // merge with prior run (resumable), keyed champion|slot|debuff
  const rawPath = path.join(OUT, 'skills_raw.json');
  const byKey = new Map();
  try { for (const r of JSON.parse(fs.readFileSync(rawPath, 'utf8')).rows ?? []) byKey.set(`${r['Champion']}|${r['Slot']}|${r['Debuff Name']}`, r); } catch {}
  for (const r of rows) byKey.set(`${r['Champion']}|${r['Slot']}|${r['Debuff Name']}`, r);
  fs.writeFileSync(rawPath, JSON.stringify({ generated: new Date().toISOString(), source: 'raidshadowlegends.fandom.com (CC-BY-SA)', rows: [...byKey.values()] }, null, 2));
  if (missing.length) fs.appendFileSync(path.join(DESKTOP, 'fandom_missing.txt'), missing.join('\n') + '\n');
  if (noSkills.length) fs.appendFileSync(path.join(DESKTOP, 'fandom_no_skills.txt'), noSkills.join('\n') + '\n');

  console.log(`\nDone (${MODE}). ${scraped} champion(s) with skills → ${byKey.size} Skills_Raw row(s) total. ${missing.length} missing, ${noSkills.length} no-skills.`);
}
main().catch(e => { console.error(e); process.exit(1); });
