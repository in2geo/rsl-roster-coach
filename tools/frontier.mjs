#!/usr/bin/env node
// tools/frontier.mjs — FIND THE FAILURE BOUNDARY, THEN MEASURE IT.
//
// WHY THIS EXISTS (Mike, 2026-07-20). The grading corpus is mostly single-sample: 136 of 177
// (account, stage, exact-team) combinations have exactly ONE battle, and of the combinations that
// DO repeat, 20% produced both a win and a loss. The log contains a 19W-1L team (DonBrogni, Ice
// Golem 17). A single loss from a 95%-reliable team is indistinguishable from a bad team unless
// you sample — so `shadow-grade-clears`, which scores individual battles, can rank a 95% team
// below a 40% one and be reporting nothing but RNG.
//
// THE PROTOCOL THIS SERVES (Mike's design):
//   1. Climb until the team starts to fail  → that stage is the FRONTIER.
//   2. Run the FRONTIER 10 times            → measure the win RATE, not a win.
//   3. Run the stage BELOW it 10 times      → confirm it is ~10/10 (a clean floor).
//   4. ONLY THEN attribute causes (affinity, kit, gear).
// Sampling at the boundary is what makes this cheap: the stages far below the frontier are
// uninformative (they always win) and the stages far above are uninformative (they always lose).
// The information is concentrated in the band where the outcome is actually uncertain.
//
// ORDER MATTERS. Attributing a cause before knowing the variance is how a single wipe got called
// a model failure on 2026-07-20 — an n=1 result on each side. Establish the curve first.
//
// TIME, NOT TURNS, IS THE VERDICT (CLAUDE.md core principle): "a win that finishes inside the time
// budget is a good result regardless of turns." So duration is reported alongside the rate — a
// stage can be "reliable" at 10/10 and still FAIL the product test at 26 minutes.
//
// RETREATS ARE NOT LOSSES. `finishCause: "Retreat"` is captured and currently grades as a defeat
// (a known open defect). In a win-RATE measurement that is not a rounding error, it is poison: an
// abandoned run would read as a wipe and drag the rate down. They are excluded here and counted
// separately.
//
// Usage:
//   node tools/frontier.mjs                     # every account × content
//   node tools/frontier.mjs DonThor             # one account (substring match)
//   node tools/frontier.mjs DonThor "Ice Golem" # one account, one content
//   node tools/frontier.mjs --target 10         # sample target per stage (default 10)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const TARGET = Number(argv[argv.indexOf('--target') + 1]) || 10;
const args = argv.filter((a, i) => a !== '--target' && argv[i - 1] !== '--target');
const [ACCT_Q, CONTENT_Q] = args;

const log = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json'), 'utf8'));
const arr = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);

const shortName = n => String(n).split(' ')[0];
const stageNum = b => b.stageNumber ?? Number(String(b.stage ?? '').match(/Stage (\d+)/)?.[1]) ?? null;
const contentOf = b => b.dungeon ?? String(b.stage ?? '').replace(/ Stage \d+.*$/, '') ?? '?';

/* TEAM-CENTRIC, NOT STAGE-CENTRIC. The protocol is "find the level where THE TEAM starts to fail",
 * so the unit of analysis is a TEAM's ladder, not a stage's results. An earlier cut of this tool
 * grouped by stage and took the most-run team at each one — which silently compared DIFFERENT teams
 * across stages and produced an incoherent frontier (DonThor: it reported a stage-18 frontier for a
 * team that had never been run at 19 or 20). Swapping a champion starts a NEW experiment. */
// account -> content -> team -> stage -> battles
const tree = {};
let retreats = 0;
for (const b of arr) {
  if (!b.result || (b.heroes ?? []).length !== 5) continue;
  const st = stageNum(b); if (st == null) continue;
  if (/retreat/i.test(b.finishCause ?? '')) { retreats++; continue; }   // NOT a loss
  const acct = b.displayName ?? b.accountId ?? '?';
  const content = contentOf(b);
  if (ACCT_Q && !acct.toLowerCase().includes(ACCT_Q.toLowerCase())) continue;
  if (CONTENT_Q && !content.toLowerCase().includes(CONTENT_Q.toLowerCase())) continue;
  const team = (b.heroes ?? []).map(h => h.name).sort().join(', ');
  (((tree[acct] ??= {})[content] ??= {})[team] ??= {})[st] ??= [];
  tree[acct][content][team][st].push(b);
}

const mean = xs => xs.reduce((a, c) => a + c, 0) / (xs.length || 1);
const fmtDur = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

for (const [acct, contents] of Object.entries(tree)) {
  for (const [content, teams] of Object.entries(contents)) {
    // Rank teams by how far they got, then by evidence. The team that reached the highest stage is
    // the one whose frontier we care about; the rest are abandoned lines.
    const ranked = Object.entries(teams).map(([team, stages]) => {
      const nums = Object.keys(stages).map(Number).sort((a, b) => a - b);
      const runs = Object.values(stages).flat();
      const top = Math.max(...nums);
      const winsAtTop = (stages[top] ?? []).filter(r => r.result === 'Victory').length;
      return { team, stages, nums, top, runs: runs.length, winsAtTop };
    /* RANK: highest stage reached → most WINS at that stage → most runs.
     * Not by recency (that surfaces a brand-new n=1 configuration) and not by total runs (that
     * surfaces whichever line was ground longest, usually an ABANDONED one). Wins at the top stage
     * is the signal that a team can actually operate there, which is what makes it worth sampling. */
    }).sort((a, b) => b.top - a.top || b.winsAtTop - a.winsAtTop || b.runs - a.runs);
    if (!ranked.length) continue;

    console.log(`\n══ ${acct} · ${content} ══`);
    if (ranked.length > 1)
      console.log(`  ${ranked.length} distinct teams tried; showing the one with the best record at the highest stage.`);

    const T = ranked[0];
    console.log(`  TEAM: ${T.team.split(', ').map(shortName).join(', ')}`);
    console.log('  stage   n   W-L    rate   median time   status');

    const per = {};
    for (const st of T.nums) {
      const rs = T.stages[st];
      const w = rs.filter(r => r.result === 'Victory').length;
      const durs = rs.filter(r => r.durationSeconds != null).map(r => r.durationSeconds).sort((a, b) => a - b);
      per[st] = { n: rs.length, w, l: rs.length - w, rate: w / rs.length,
                  med: durs.length ? durs[Math.floor(durs.length / 2)] : null };
    }
    for (const st of T.nums) {
      const s = per[st];
      const status = s.n < 3 ? `n=${s.n} — NOT MEASURED` : s.rate === 1 ? 'clean' : s.rate === 0 ? 'wall' : 'CONTESTED';
      console.log(`   ${String(st).padStart(3)}  ${String(s.n).padStart(3)}  ${s.w}-${s.l}`.padEnd(22)
        + `${String(Math.round(s.rate * 100)).padStart(4)}%   ${fmtDur(s.med).padStart(6)}        ${status}`);
    }

    /* FRONTIER = the lowest stage THIS TEAM has lost. That is where the outcome is uncertain and so
     * where a sample buys the most information; stages well below always win and stages well above
     * always lose, and neither teaches anything. If the team has never lost, the frontier has not
     * been found — the instruction is to keep climbing, not to start sampling. */
    const lost = T.nums.filter(st => per[st].l > 0);
    const frontier = lost.length ? Math.min(...lost) : null;
    console.log('');
    if (frontier == null) {
      console.log(`  ▸ FRONTIER NOT FOUND — this team has never lost. Keep climbing above stage ${T.top}.`);
      continue;
    }
    const control = frontier - 1;
    const f = per[frontier], c = per[control];
    console.log(`  ▸ FRONTIER: stage ${frontier} — lowest stage this team has lost.`);
    console.log(`     TEST     stage ${frontier}: ${f.n}/${TARGET} runs` +
      (f.n >= TARGET ? `  ✔ MEASURED — win rate ${Math.round(f.rate * 100)}%` : `  → ${TARGET - f.n} more needed`));
    if (c) {
      console.log(`     CONTROL  stage ${control}: ${c.n}/${TARGET} runs` +
        (c.n >= TARGET
          ? (c.rate === 1 ? `  ✔ CLEAN FLOOR (${c.w}/${c.n})` : `  ⚠ only ${Math.round(c.rate * 100)}% — floor is NOT clean, the real frontier is lower`)
          : `  → ${TARGET - c.n} more needed`));
    } else {
      console.log(`     CONTROL  stage ${control}: NO RUNS — needed as the clean-floor comparison.`);
    }
    console.log(`     ⚠ Keep the team IDENTICAL across all runs — a swap restarts the experiment.`);
    if (f.n >= TARGET && c && c.n >= TARGET)
      console.log(`     ▸ CURVE ESTABLISHED — now attribute causes (affinity, kit, gear).`);

    if (ranked.length > 1) {
      console.log(`\n  other teams tried in this content (each its own experiment):`);
      for (const o of ranked.slice(1, 5)) {
        const w = Object.values(o.stages).flat().filter(r => r.result === 'Victory').length;
        console.log(`     top stage ${String(o.top).padStart(2)}  ${o.runs} run(s) ${w}W-${o.runs - w}L   ${o.team.split(', ').map(shortName).join(', ')}`);
      }
    }
  }
}
if (retreats) console.log(`\n(${retreats} retreat${retreats > 1 ? 's' : ''} excluded — abandoned runs are not losses.)`);
