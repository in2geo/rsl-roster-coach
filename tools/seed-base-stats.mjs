#!/usr/bin/env node
// Generate a committed base-stat seed from hand-captured in-game screenshots (TIER-1).
//
// WHY: the remaining base-stat gap is ~125 champions that no bulk source covers (newest
// Legendaries + Mythicals). They come in one screenshot at a time, and hand-writing a
// generator per batch is how transcription errors get in. This centralises the guards.
//
// USAGE:
//   node --env-file=.env.local tools/seed-base-stats.mjs <captures.json> <seedNumber> "<title>"
//
// captures.json: [{ "name": "<champions.name EXACTLY>", "gameName": "<optional full in-game name>",
//                   "hp":22635, "atk":881, "def":1465, "spd":110,
//                   "crate":15, "cdmg":50, "res":30, "acc":20 }, ...]
//   crate/cdmg are PERCENT (the card reads "15%" -> 15), matching estimate-stats.js.
//
// GUARDS (all fatal — this throws rather than emit a bad row):
//   • HP must be a multiple of 15. Verified 3/3 against the game client 2026-07-17;
//     see CLAUDE.md "Base-stat validation". Any HP that fails is a misread.
//   • Exactly one champions row must match each name (catches the short-name duplicate
//     problem — knowledge/MISSING_BASE_STATS.md — where "Othorion" and "Wallmaster
//     Othorion" both exist).
//   • Plausibility bands on every stat.
//   • Reports (does NOT emit) any champion whose row is already populated, and DIFFS it
//     against the capture — that is how Sunken Sentinel's wrong crit_dmg was found.
//   • Reports any name with NO row: that is a MISSING CHAMPION needing an INSERT, not an
//     UPDATE (e.g. Aria the Golden Hope, Xanthe Seaflower).
//
// Emitted statements are fill-only (`and base_hp is null`), keyed on champions.id, and
// replay-safe. Apply with tools/apply-seed-pooler.mjs.
import fs from 'fs';

const [capPath, seedNo, title] = process.argv.slice(2);
if (!capPath || !seedNo) {
  console.error('usage: node --env-file=.env.local tools/seed-base-stats.mjs <captures.json> <seedNumber> "<title>"');
  process.exit(1);
}
const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
if (!base || !key) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing (use --env-file=.env.local)'); process.exit(1); }
const H = { apikey: key, Authorization: `Bearer ${key}` };

async function get(path) {
  const r = await fetch(`${base}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);   // THROW, never swallow
  return r.json();
}

const caps = JSON.parse(fs.readFileSync(capPath, 'utf8'));
const BANDS = {
  hp:[5000,32000], atk:[300,2200], def:[300,2200], spd:[80,130],
  crate:[5,35], cdmg:[30,100], res:[0,100], acc:[0,100],
};

const fatal = [];
for (const c of caps) {
  if (c.hp % 15 !== 0) fatal.push(`${c.name}: HP ${c.hp} is not a multiple of 15 — misread`);
  for (const [k,[lo,hi]] of Object.entries(BANDS)) {
    const v = c[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) fatal.push(`${c.name}: ${k} missing/not a number`);
    else if (v < lo || v > hi) fatal.push(`${c.name}: ${k}=${v} outside plausible ${lo}..${hi}`);
  }
  if (c.crate <= 1 || c.cdmg <= 1) fatal.push(`${c.name}: crit looks like a FRACTION (${c.crate}/${c.cdmg}) — must be percent`);
}
if (fatal.length) { console.error('REFUSING TO GENERATE:\n' + fatal.map(f=>'  ✗ '+f).join('\n')); process.exit(1); }
console.log(`✓ ${caps.length} captures pass HP-multiple-of-15, plausibility bands and the percent-crit check.`);

const out = [], already = [], missing = [];
for (const c of caps) {
  const rows = await get(`champions?game_id=eq.raid_shadow_legends&name=eq.${encodeURIComponent(c.name)}&select=id,name,rarity,faction,base_hp,base_atk,base_def,base_spd,base_crit_rate,base_crit_dmg,base_res,base_acc`);
  if (rows.length === 0) { missing.push(c); continue; }
  if (rows.length > 1) { console.error(`✗ ${rows.length} rows match "${c.name}" — ambiguous, refusing.`); process.exit(1); }
  const row = rows[0];
  if (row.base_hp != null) {
    const diffs = [];
    const cmp = { base_hp:c.hp, base_atk:c.atk, base_def:c.def, base_spd:c.spd, base_res:c.res, base_acc:c.acc };
    for (const [k,v] of Object.entries(cmp)) if (Number(row[k]) !== Number(v)) diffs.push(`${k}: live ${row[k]} vs game ${v}`);
    // crit: compare on value, tolerating the fraction encoding
    const lcr = row.base_crit_rate <= 1 ? row.base_crit_rate*100 : row.base_crit_rate;
    const lcd = row.base_crit_dmg  <= 1 ? row.base_crit_dmg*100  : row.base_crit_dmg;
    if (Math.round(lcr) !== c.crate) diffs.push(`base_crit_rate: live ${row.base_crit_rate} (=${Math.round(lcr)}%) vs game ${c.crate}%`);
    if (Math.round(lcd) !== c.cdmg)  diffs.push(`base_crit_dmg: live ${row.base_crit_dmg} (=${Math.round(lcd)}%) vs game ${c.cdmg}%`);
    already.push({ c, row, diffs });
    continue;
  }
  const nameNote = c.gameName && c.gameName !== c.name
    ? `\n-- NAME: in-game reads "${c.gameName}"; our row is "${c.name}". Not renamed (belongs in champion_aliases).` : '';
  // base_stat_reference_rank/level record WHAT THE STATS ARE SCALED TO. Without them a row is
  // unfalsifiable — Staltus Dragonbane sat at a 5*/50 Gestal placeholder (ATK 518 for a
  // Legendary) and only its citation gave it away. Captures are 6* L60 by definition.
  out.push(`-- ${c.gameName || c.name} (${row.rarity}, ${row.faction})${nameNote}\nupdate champions set base_hp=${c.hp}, base_atk=${c.atk}, base_def=${c.def}, base_spd=${c.spd}, base_crit_rate=${c.crate}, base_crit_dmg=${c.cdmg}, base_res=${c.res}, base_acc=${c.acc},\n  base_stat_reference_rank=6, base_stat_reference_level=60,\n  source_citation='in-game Index 6★ L60 Total Stats (Mike screenshot ${new Date().toISOString().slice(0,10)}); HP ✓ multiple-of-15'\nwhere id='${row.id}' and base_hp is null;`);
}

console.log(`\nFILLS:   ${out.length}`);
if (already.length) {
  console.log(`\nALREADY POPULATED (no statement emitted) — ${already.length}:`);
  for (const a of already) {
    if (!a.diffs.length) console.log(`  ✓ ${a.c.name} — live matches the game on all 8 (free Tier-1 confirmation)`);
    else { console.log(`  ⚠ ${a.c.name} — MISMATCH, live row is WRONG:`); for (const d of a.diffs) console.log(`      ${d}`); }
  }
}
if (missing.length) {
  console.log(`\n⚠ NO ROW AT ALL — ${missing.length} MISSING CHAMPION(S), need an INSERT not an UPDATE:`);
  for (const m of missing) console.log(`  ✗ ${m.gameName || m.name}  hp=${m.hp} atk=${m.atk} def=${m.def} spd=${m.spd} crate=${m.crate} cdmg=${m.cdmg} res=${m.res} acc=${m.acc}`);
}
if (!out.length) { console.log('\nNothing to emit.'); process.exit(0); }

const mism = already.filter(a => a.diffs.length);
const header = `-- ============================================================================
-- Seed ${seedNo} — ${title || 'base stats from in-game screenshots'} (TIER-1)
--
-- SOURCE: Mike's own in-game champion screens, 6* Lvl 60, ${new Date().toISOString().slice(0,10)}.
-- TIER-1 under the CLAUDE.md source hierarchy — the game client's own numbers.
-- Generated by tools/seed-base-stats.mjs, which refuses to emit a row that fails
-- the HP-multiple-of-15 rule, a plausibility band, or the exactly-one-row check.
--
-- FILLS ${out.length}. CRIT written as PERCENT, matching seeds 146/149-152.
${already.filter(a=>!a.diffs.length).length ? `--
-- FREE TIER-1 CONFIRMATIONS (already populated, live matches on all 8):
${already.filter(a=>!a.diffs.length).map(a=>`--   ✓ ${a.c.name}`).join('\n')}` : ''}
${mism.length ? `--
-- ⚠ MISMATCHES — live row is WRONG, NOT fixed here (fill-only seed, guard skips them):
${mism.map(a=>`--   ${a.c.name}: ${a.diffs.join('; ')}`).join('\n')}` : ''}
${missing.length ? `--
-- ⚠ MISSING CHAMPIONS — no row exists; needs an INSERT with skills/tags/aura.
-- Captured stats recorded here so the capture is not lost:
${missing.map(m=>`--   ${m.gameName||m.name}: hp=${m.hp} atk=${m.atk} def=${m.def} spd=${m.spd} crate=${m.crate} cdmg=${m.cdmg} res=${m.res} acc=${m.acc}`).join('\n')}` : ''}
--
-- FILL-ONLY, REPLAY-SAFE: guarded \`and base_hp is null\`, keyed on champions.id.
-- ============================================================================

`;
const fname = `seeds/${seedNo}_${(title||'base_stats').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}.sql`;
fs.writeFileSync(fname, header + out.join('\n\n') + '\n');
console.log(`\nWrote ${fname}`);
