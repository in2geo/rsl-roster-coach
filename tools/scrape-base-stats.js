#!/usr/bin/env node
/**
 * Base stats scraper — RSL Roster Coach
 *
 * Fetches 6* Ascended Stats for all RSL champions from raid.guide/en/stats/
 * (one HTTP request, full table) and writes SQL UPDATE statements.
 *
 * Usage:
 *   node tools/scrape-base-stats.js [--validate] [--out FILE]
 *
 * Flags:
 *   --validate   Parse and print Kael, Staltus Dragonbane, Uugo for manual check
 *   --out FILE   Write SQL to output/FILE instead of output/base-stats-full.sql
 *
 * Output:
 *   output/base-stats-full.sql  — SQL UPDATE statements, paste into Supabase
 *   output/base-stats-fail.log  — Champions that didn't parse cleanly
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'output');
const FAIL_FILE = path.join(OUT_DIR, 'base-stats-fail.log');

const SOURCE_URL = 'https://raid.guide/en/stats/';

// ── Known-good validation targets (6* fully ascended level 60) ───────────────
const VALIDATION_TARGETS = {
  'Kael':               { hp: 13710, atk: 1200, def: 914,  spd: 103, crit_rate: 15, crit_dmg: 57, res: 30, acc: 0  },
  'Staltus Dragonbane': { hp: 20805, atk: 738,  def: 1454, spd: 99,  crit_rate: 15, crit_dmg: 63, res: 30, acc: 10 },
  'Uugo':               { hp: 19650, atk: 738,  def: 1255, spd: 102, crit_rate: 15, crit_dmg: 50, res: 30, acc: 15 },
};

// ── Fetch and parse the stats table ─────────────────────────────────────────
async function fetchStatsTable() {
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSL-Roster-Coach-Scraper/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${SOURCE_URL}`);
  const html = await res.text();

  // Split on <tr> boundaries and keep only rows containing a champion link
  const trBlocks = html.split('<tr>').slice(1); // drop everything before first <tr>
  const champions = [];

  for (const block of trBlocks) {
    // Champion name — extract from the simple-champion-link anchor
    const nameMatch = block.match(/class="simple-champion-link"[^>]*>([^<]+)</);
    if (!nameMatch) continue; // header row or non-champion row
    const name = nameMatch[1].trim();

    // Rarity — from data-rarity attribute on the second anchor
    const rarityMatch = block.match(/data-rarity="([^"]+)"/);
    const rarity = rarityMatch ? rarityMatch[1] : null;

    // Stats — the 8 <td> cells after the first (name) cell, in order:
    // HP, ATK, DEF, SPD, C.RATE, C.DMG, RESIST, ACC
    // We strip the name cell first then grab all remaining <td> values
    const afterNameCell = block.replace(/<td[^>]*>[\s\S]*?<\/td>/, ''); // drop name td
    const tdValues = [...afterNameCell.matchAll(/<td>(\d+)<\/td>/g)].map(m => parseInt(m[1], 10));

    if (tdValues.length < 8) {
      champions.push({ name, rarity, error: `only ${tdValues.length} stat cells found` });
      continue;
    }

    champions.push({
      name,
      rarity,
      hp:        tdValues[0],
      atk:       tdValues[1],
      def:       tdValues[2],
      spd:       tdValues[3],
      crit_rate: tdValues[4],  // stored as integer percent (15 = 15%)
      crit_dmg:  tdValues[5],  // stored as integer percent (50 = 50%)
      res:       tdValues[6],
      acc:       tdValues[7],
    });
  }

  return champions;
}

// ── Validation ───────────────────────────────────────────────────────────────
function validateRow(row) {
  if (row.error) return [row.error];
  const issues = [];
  if (row.hp  == null || row.hp  < 3000)  issues.push(`hp implausible: ${row.hp}`);
  if (row.atk == null || row.atk < 200)   issues.push(`atk implausible: ${row.atk}`);
  if (row.def == null || row.def < 100)   issues.push(`def implausible: ${row.def}`);
  if (row.spd == null || row.spd < 80)    issues.push(`spd implausible: ${row.spd}`);
  if (row.crit_rate == null)              issues.push('crit_rate missing');
  if (row.crit_dmg  == null)              issues.push('crit_dmg missing');
  if (row.res  == null)                   issues.push('res missing');
  if (row.acc  == null)                   issues.push('acc missing');
  if (row.acc  != null && row.acc > 100)  issues.push(`acc implausibly high: ${row.acc}`);
  return issues;
}

// ── SQL generation ────────────────────────────────────────────────────────────
function toSql(row) {
  const safeName = row.name.replace(/'/g, "''");
  // Store crit_rate and crit_dmg as decimals (0.15, 0.57) to match schema
  return [
    `update champions set`,
    `  base_hp               = ${row.hp},`,
    `  base_atk              = ${row.atk},`,
    `  base_def              = ${row.def},`,
    `  base_spd              = ${row.spd},`,
    `  base_crit_rate        = ${(row.crit_rate / 100).toFixed(2)},`,
    `  base_crit_dmg         = ${(row.crit_dmg  / 100).toFixed(2)},`,
    `  base_res              = ${row.res},`,
    `  base_acc              = ${row.acc},`,
    `  base_stat_reference_rank  = 6,`,
    `  base_stat_reference_level = 60`,
    `where name = '${safeName}';`,
  ].join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const flags   = new Set(args.filter(a => a.startsWith('--')));
  const outArg  = args.find((a, i) => args[i - 1] === '--out');
  const SQL_FILE = path.join(OUT_DIR, outArg ?? 'base-stats-full.sql');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Fetching ${SOURCE_URL} ...`);
  const champions = await fetchStatsTable();
  console.log(`Parsed ${champions.length} champion rows.\n`);

  if (flags.has('--validate')) {
    let allOk = true;
    for (const [name, expected] of Object.entries(VALIDATION_TARGETS)) {
      const row = champions.find(c => c.name === name);
      if (!row) { console.log(`  ✗ ${name}: NOT FOUND in table`); allOk = false; continue; }
      const mismatches = Object.entries(expected)
        .filter(([f, v]) => Math.abs((row[f] ?? -1) - v) > 0.001)
        .map(([f, v]) => `${f}: expected ${v}, got ${row[f]}`);
      if (mismatches.length) {
        console.log(`  ✗ ${name}: ${mismatches.join('; ')}`);
        allOk = false;
      } else {
        console.log(`  ✓ ${name}: all values match`);
      }
    }
    if (!allOk) process.exit(1);
    return;
  }

  const sqlLines  = [];
  const failLines = [];

  for (const row of champions) {
    const issues = validateRow(row);
    if (issues.length) {
      failLines.push(`${row.name}\t${issues.join('; ')}`);
    } else {
      sqlLines.push(toSql(row));
    }
  }

  const sqlHeader = [
    '-- RSL Roster Coach — base stats from raid.guide/en/stats/',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Champions: ${sqlLines.length} rows`,
    '-- Apply in Supabase SQL editor',
    '',
  ].join('\n');

  fs.writeFileSync(SQL_FILE, sqlHeader + sqlLines.join('\n\n') + '\n');
  console.log(`✓ SQL written to ${SQL_FILE}`);

  if (failLines.length) {
    fs.writeFileSync(FAIL_FILE, `# base-stats failures — ${new Date().toISOString()}\n\n` + failLines.join('\n') + '\n');
    console.log(`✗ ${failLines.length} failure(s) written to ${FAIL_FILE}`);
  }

  console.log(`\nDone: ${sqlLines.length} succeeded, ${failLines.length} failed.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
