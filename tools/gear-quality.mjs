#!/usr/bin/env node
// tools/gear-quality.mjs — TEST MIKE'S DEFINITION OF "GOOD" GEAR AGAINST WHAT ACTUALLY CLEARS.
//
// Mike's definition (2026-07-20): "'good' gear is 5 star gear with the right substats leveled up
// to +16." And his observation: "I have very few characters in what I would call good gear... with
// that being said, we have been able to clear level 20 of a few dungeons, so either my rating of my
// gear is wrong or level 20 is too low of a bar for 'good' gear."
//
// Both halves are measurable, and they are different questions:
//   1. HOW MANY champions actually meet 5★/+16?              (is the self-assessment right?)
//   2. Do the champions CLEARING stage 20 meet it?           (is stage 20 the right anchor?)
// If few champions meet the bar AND those same champions clear 20, then stage 20 is too low an
// anchor for "good" — which matters because §3.6 anchors the whole tier scale to it.
//
// "RIGHT SUBSTATS" is scored by the PRIORITY LADDER worked out on Fahrakin (SPD > ACC > CRIT):
// a substat is "useful" if it is SPD or ACC (preconditions, useful on nearly every champion), or a
// crit stat (a multiplier, useful only on attack-damage champions). Flat HP/ATK/DEF rolls on a
// +16 piece are the classic "levelled the wrong gear" outcome.
//
// ⚠ ACCESSORIES EXCLUDED. Rings/Amulets/Banners roll a different substat pool and have no set, so
// mixing them into a "6 armour pieces at 5★+16" test would understate everyone.
import fs from 'fs';

const ARMOUR = new Set(['Weapon', 'Helmet', 'Shield', 'Gauntlets', 'Chestplate', 'Boots']);
const PRIORITY_SUBS = new Set(['SPD', 'ACC']);            // preconditions — good on almost anyone
const MULTIPLIER_SUBS = new Set(['CRATE', 'CDMG']);       // only useful on attack-damage champions

const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
const battles = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const stageNum = b => { const n = b.stageNumber ?? Number(String(b.stage ?? '').match(/Stage (\d+)/)?.[1]); return Number.isFinite(n) ? n : null; };
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// who appears on a team clearing stage >= 20?
const clears20 = new Set();
for (const b of battles) {
  if (b.result !== 'Victory' || (stageNum(b) ?? 0) < 20) continue;
  if (/retreat/i.test(b.finishCause ?? '')) continue;
  for (const h of b.heroes ?? []) clears20.add(`${b.displayName}|${norm(h.name)}`);
}

const rows = [];
for (const f of fs.readdirSync('gestal-sync/output').filter(x => x.endsWith('.json') && !/gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(`gestal-sync/output/${f}`, 'utf8'));
  for (const c of snap.champions ?? []) {
    const armour = (c.equippedArtifacts ?? []).filter(a => ARMOUR.has(a.slot));
    if (!armour.length) continue;
    const at5 = armour.filter(a => (a.rank ?? 0) >= 5).length;
    const at16 = armour.filter(a => (a.level ?? 0) >= 16).length;
    const both = armour.filter(a => (a.rank ?? 0) >= 5 && (a.level ?? 0) >= 16).length;
    // substat quality: fraction of +16 pieces carrying at least one priority substat
    const levelled = armour.filter(a => (a.level ?? 0) >= 16);
    const withPriority = levelled.filter(a =>
      (a.substats ?? []).some(s => PRIORITY_SUBS.has(String(s.stat).toUpperCase().replace(/[^A-Z]/g, '')))).length;
    rows.push({ acct: snap.displayName, name: c.name, pieces: armour.length,
                at5, at16, both, levelled: levelled.length, withPriority,
                clears20: clears20.has(`${snap.displayName}|${norm(c.name)}`) });
  }
}

const full = r => r.pieces === 6 && r.both === 6;                 // all six at 5★ AND +16
const partial = r => r.both >= 4;

console.log(`\n══ TESTING "GOOD GEAR = 5★ SUBSTATS AT +16" ══`);
console.log(`geared champions (>=1 armour piece): ${rows.length}\n`);

console.log('── Q1: how many champions actually meet the bar? ──');
console.log(`   all 6 armour pieces at 5★ AND +16 ......... ${rows.filter(full).length}`);
console.log(`   at least 4 of 6 at 5★ AND +16 ............. ${rows.filter(partial).length}`);
console.log(`   at least 1 piece at 5★ AND +16 ............ ${rows.filter(r => r.both >= 1).length}`);
console.log(`   ZERO pieces at 5★+16 ...................... ${rows.filter(r => r.both === 0).length}`);

console.log('\n── Q2: do the stage-20 clearers meet it? ──');
const c20 = rows.filter(r => r.clears20);
console.log(`   champions fielded in a stage-20+ clear: ${c20.length}`);
console.log(`   ...of those, ALL SIX at 5★+16: ${c20.filter(full).length}`);
console.log(`   ...of those, 4+ at 5★+16: ${c20.filter(partial).length}`);
const avgBoth = c20.length ? (c20.reduce((a, r) => a + r.both, 0) / c20.length).toFixed(1) : '—';
console.log(`   ...median pieces at 5★+16 per champion: ${avgBoth} of 6`);

console.log('\n── the stage-20 clearers, piece by piece ──');
console.log('   acct         champion                  5★  +16  BOTH  useful-subs-on-+16');
for (const r of c20.sort((a, b) => b.both - a.both).slice(0, 22))
  console.log(`   ${r.acct.padEnd(12)} ${r.name.padEnd(25)} ${String(r.at5).padStart(2)}/6 ${String(r.at16).padStart(3)}/6 ${String(r.both).padStart(4)}/6      ${r.withPriority}/${r.levelled || 0}`);

console.log('\n── for comparison: the best-geared champions overall ──');
for (const r of [...rows].sort((a, b) => b.both - a.both || b.at16 - a.at16).slice(0, 8))
  console.log(`   ${r.acct.padEnd(12)} ${r.name.padEnd(25)} ${String(r.both).padStart(4)}/6 at 5★+16${r.clears20 ? '   (clears 20+)' : ''}`);
