// tools/sim-per-hero-bands.mjs — PER-HERO REALITY BANDS (the missing whole-fight magnitude gate).
//
// WHAT IT DOES: for each BUILT content, run the sim N times and aggregate, per champion, the three
// victory-screen numbers from `state.effects` — DAMAGE DEALT, DAMAGE TAKEN, HEALING (done) — then compare the
// sim's median to the band (p10 / median / p90) of the SAME three numbers hand-transcribed from real battles
// in data/manual-captures.json (+ the reader/watcher battle-log). Also gates sim win rate and median turn
// count. All pass/fail tolerances come from config/qa-thresholds.json (per dungeon) — NOT hardcoded — and it
// EXITS NON-ZERO if any gated metric is outside its acceptance threshold.
//
// WHY IT MATTERS: this is the check the QA suite was missing (QA_INVENTORY.md §12) — nothing else asserts the
// sim's per-hero DEALT/TAKEN over a full fight against reality. The Bambus poison-redirect gap (356k vs ~1.08M)
// is exactly what this catches.
//
// LEDGER-ATTRIBUTION SEAMS (honest limits — see the printed NOTES):
//   • DEALT under-counts REFLECT damage (Magma Shield / Reflect Damage). Reflection IS ledgered (kind:'reflect')
//     but is NOT source-attributed to the reflecting champion, so Pelops/Vergis dealt is low by the per-fight
//     reflect total (reported). Direct hits + DoT + lifesteal ARE attributed correctly.
//   • HEALING (done) counts lifesteal + direct heals + crit-heal (all sourced to the champ), but NOT
//     [Continuous Heal] ticks (ledgered with source 'Continuous Heal', not the caster) nor magma-reflection
//     lifesteal (not ledgered). So HEALING is REPORT-ONLY (not gated) — gating it would false-positive the
//     sustainers. The clean fix is a per-champion `dealt`/`healingDone` accounting field mirroring the existing
//     records-only `taken`/`healed` (survival-oracle) fields; offered separately.
//
// Run: node --env-file=.env.local tools/sim-per-hero-bands.mjs [N=50]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey, deferredMechanicsFor } from '../lib/sim/recipes.js';
import { appendQaHistory, gitCommit, nowIso } from './qa-history.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 50);
const GATED = ['dealt', 'taken'];               // healing is report-only (see the attribution seam above)
const THRESH_METRIC = { dealt: 'perHeroDealtPct', taken: 'perHeroTakenPct' };   // per-hero metric → its threshold field

// ACCEPTANCE THRESHOLDS — "good enough" per dungeon, from config/qa-thresholds.json (DEFAULT_THRESH is the
// code-level fallback if the file is absent). TARGETS to tighten as the sim improves, not permanent tolerances.
const DEFAULT_THRESH = { perHeroDealtPct: 0.20, perHeroTakenPct: 0.20, winRatePctPoints: 10, medianTurnsPct: 0.15 };
const CONFIG_PATH = path.join(REPO, 'config', 'qa-thresholds.json');
let THRESH_CONFIG = {};
try { if (fs.existsSync(CONFIG_PATH)) THRESH_CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { /* fall back to DEFAULT_THRESH */ }
const thresholdsFor = (dungeon, stage) => ({ ...DEFAULT_THRESH, ...(THRESH_CONFIG.default || {}), ...(THRESH_CONFIG[`${dungeon} ${stage}`] || {}) });

// ACCOUNT-SCOPED (2026-08-01). Each content pins the ACCOUNT (displayName) whose captures it is graded
// against — a Spider-13 team on Don$Bambus (Pelops) vs DonaHilvi (Michelangelo/Hilvi/…) are DIFFERENT
// teams, so their per-hero bands must NOT blend (the handoff TODO). `teamVariant` further pins the exact
// roster where one account runs several at the same dungeon+stage (DonaHilvi's Artor-for-Alice swap).
// Both manual captures and the reader battle-log carry `displayName`, so the filter works on both sources.
const CONTENTS = [
  { fixture: 'spider13-donbambus-current.json', dungeon: "Spider's Den", stage: 13, account: 'Don$Bambus' },
  { fixture: 'dragon16-donbambus-current.json', dungeon: "Dragon's Lair", stage: 16, account: 'Don$Bambus' },
  { fixture: 'spider-donahilvi-artor-current.json', dungeon: "Spider's Den", stage: 13, account: 'DonaHilvi', teamVariant: 'Artor-for-Alice' },
  { fixture: 'spider-donahilvi-artak-current.json', dungeon: "Spider's Den", stage: 13, account: 'DonaHilvi', teamVariant: 'Artak+Ninja (Artor out)' },
  { fixture: 'dragon-donahilvi-pool-current.json', dungeon: "Dragon's Lair", stage: 16, account: 'DonaHilvi', teamVariant: 'Artor (Dragon pool team)' },
  { fixture: 'dragon-donahilvi-ezio-xeno-st20-current.json', dungeon: "Dragon's Lair", stage: 20, account: 'DonaHilvi' },   // fresh per-hero captures (dialog-nav fix 2026-08-13)
];

// kinds that count as DAMAGE the source dealt to a victim. NB: 'activate' is EXCLUDED — activatePoisons already
// emits the per-owner 'dot' events, so counting 'activate' too would double-count the same damage.
const DEALT_KINDS = new Set(['damage', 'dot']);
const TAKEN_KINDS = new Set(['damage', 'dot']);

const pctile = (arr, p) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))));
  return a[i];
};
const band = (arr) => ({ p10: pctile(arr, 0.10), median: pctile(arr, 0.50), p90: pctile(arr, 0.90), n: arr.length });

// ── REALITY: per-champion dealt/taken/healing bands from the captures for this content ──
// TWO capture sources, both giving the three victory-screen bars per hero:
//   • data/manual-captures.json (hand-transcribed) — fields damage / taken / healing.
//   • the reader/watcher battle-log.json — fields damage / defense(=taken) / healing; MANY runs, but only
//     rows where every hero's damage is populated are usable (the reader nulls per-hero on some captures).
// A capture is only used if EVERY hero's dealt is a finite number (drop the reader's partial reads).
const heroFromManual = (h) => ({ key: champKey(h.name || h.displayName), name: h.displayName || h.name, dealt: h.damage, taken: h.taken, healing: h.healing });
const heroFromReader = (h) => ({ key: champKey(h.name), name: h.name, dealt: h.damage, taken: h.defense, healing: h.healing });
const fullyPopulated = (heroes) => heroes.length > 0 && heroes.every((h) => Number.isFinite(h.dealt));

function capturedBands(manualCaps, readerCaps, dungeon, stage, account = null, teamVariant = null) {
  // ACCOUNT + VARIANT scoping (2026-08-01): grade only against captures from the SAME account (and, when
  // pinned, the SAME team variant) — else Don$Bambus's Pelops team blends into DonaHilvi's bands and a
  // DonaHilvi Artor fixture is compared to its own Alice/Ninja/Artak variants. Both sources carry displayName.
  const matchesContent = (c) => c.dungeon === dungeon && c.stageNumber === stage
    && (account == null || c.displayName === account)
    && (teamVariant == null || c.teamVariant === teamVariant);
  const isWin = (c) => matchesContent(c) && c.result === 'Victory';
  const manualRows = manualCaps.filter(isWin).map((c) => (c.heroes || []).map(heroFromManual)).filter(fullyPopulated);
  const readerRows = readerCaps.filter(isWin).map((c) => (c.heroes || []).map(heroFromReader)).filter(fullyPopulated);
  // PREFER the hand-verified manual set for a content (the reader mis-attributes Spider per-hero via a
  // contiguity failure — rslbattlereader-status memory); fall back to the reader captures (the many Dragon
  // and other-content runs) when there is no manual set.
  const rows = manualRows.length ? manualRows : readerRows;
  const source = manualRows.length ? `manual hand-verified (${manualRows.length})` : `reader/watcher (${readerRows.length})`;
  const by = {};
  for (const heroes of rows) for (const h of heroes) {
    (by[h.key] ??= { name: h.name, dealt: [], taken: [], healing: [] });
    if (Number.isFinite(h.dealt)) by[h.key].dealt.push(h.dealt);
    if (Number.isFinite(h.taken)) by[h.key].taken.push(h.taken);
    if (Number.isFinite(h.healing)) by[h.key].healing.push(h.healing);
  }
  const out = {};
  for (const [k, v] of Object.entries(by)) out[k] = { name: v.name, dealt: band(v.dealt), taken: band(v.taken), healing: band(v.healing) };
  // WIN RATE + MEDIAN TURNS from the SAME source family (ALL results, not just the populated wins used for bands)
  const src = manualRows.length ? manualCaps : readerCaps;
  const allForContent = src.filter(matchesContent);
  const winCaps = allForContent.filter((c) => c.result === 'Victory');
  const lossCaps = allForContent.filter((c) => c.result === 'Defeat' || c.result === 'Loss');
  const total = winCaps.length + lossCaps.length;
  const winRate = total ? Math.round((100 * winCaps.length) / total) : null;
  const turnsVals = winCaps.map((c) => c.turns).filter((t) => Number.isFinite(t));
  const medianTurns = turnsVals.length ? pctile(turnsVals, 0.5) : null;
  return { bands: out, n: rows.length, source, winRate, medianTurns, totalCaptures: total };
}

// ── SIM: per-champion dealt/taken/healing medians over N seeds, aggregated from state.effects ──
async function simBands(rest, fixtureFile) {
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', fixtureFile), 'utf8'));
  const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
  if (probe.skip) return { skip: probe.skip };

  // ⚠ CALL OUT UNMODELLED (deferred) mechanics for this exact team — surfaced up front so a reality mismatch
  // is not hand-diagnosed for hours before realising the sim never simulated the mechanic (Mike 2026-08-03).
  const deferred = deferredMechanicsFor(probe.allies.map((a) => a.name));
  if (deferred.length) {
    const total = deferred.reduce((s, d) => s + d.count, 0);
    console.log(`  ⚠ ${total} DEFERRED (unmodelled) mechanics on this team — the sim is NOT simulating these:`);
    for (const d of deferred) for (const it of d.items) console.log(`      ${d.champion} [${it.slot}] ${String(it.note).split(' — ')[0].slice(0, 92)}`);
  }

  const per = {};                 // champKey → { name, dealt:[], taken:[], healing:[] }
  let wins = 0, reflectPerFight = 0, chHealPerFight = 0;
  const turnsArr = [];            // sim turn count per run → median (vs the captured median-turns threshold)
  const takenLedgerVsField = [];  // integrity cross-check: ledger taken vs combatant.taken

  for (let seed = 1; seed <= N; seed++) {
    const built = await buildBattle({ rest, fixture, repoRoot: REPO });
    applyBattleLayers(built.allies, fixture.battle_layers);   // fixture-declared aura/arena (e.g. DonaHilvi ACC lead); defaults (Ezio SPD +19%, arena +3%) when absent
    const allyKey = new Map(built.allies.map((a) => [champKey(a.name), a]));
    const st = makeState({ allies: built.allies, enemies: [], seed });
    installRecipeRun(st);
    const res = simulate(st, built.content, { turnCap: 400 });
    if (res.won) wins++;
    turnsArr.push(res.turns || 0);

    const dealt = {}, taken = {}, healing = {};
    for (const e of res.effects || []) {
      const amt = e.amount ?? 0;
      if (amt <= 0) { if (e.kind === 'reflect') { /* amount may be present even if <=0 guard skipped */ } continue; }
      const sk = e.source ? champKey(e.source) : null;
      const tk = e.target ? champKey(e.target) : null;
      // DEALT — an ally is the source of damage
      if (sk && allyKey.has(sk) && DEALT_KINDS.has(e.kind)) dealt[sk] = (dealt[sk] || 0) + amt;
      // TAKEN — an ally is the target of damage
      if (tk && allyKey.has(tk) && TAKEN_KINDS.has(e.kind)) taken[tk] = (taken[tk] || 0) + amt;
      // HEALING (done) — an ally is the source of a heal (lifesteal/direct/crit-heal carry source=champ)
      if (sk && allyKey.has(sk) && e.kind === 'heal') healing[sk] = (healing[sk] || 0) + amt;
      // NOTES: reflect not attributed to reflector; Continuous Heal sourced to the string, not the caster.
      if (e.kind === 'reflect') reflectPerFight += amt;
      if (e.kind === 'heal' && e.source === 'Continuous Heal') chHealPerFight += amt;
    }
    for (const [k, a] of allyKey) {
      (per[k] ??= { name: a.name, dealt: [], taken: [], healing: [] });
      per[k].dealt.push(Math.round(dealt[k] || 0));
      // TAKEN is read from the AUTHORITATIVE combatant.taken field, NOT the ledger: scripted enemies (the
      // Spider boss/Spiderlings) damage allies via dealDamage WITHOUT emitting a 'damage' ledger event, so a
      // ledger sum reads ~0 for incoming damage. combatant.taken is the survival-oracle field maintained on
      // every HP drop (= the victory-screen blue bar). The `takenLedgerVsField` cross-check MEASURES this gap.
      per[k].taken.push(Math.round(a.taken || 0));
      per[k].healing.push(Math.round(healing[k] || 0));
      takenLedgerVsField.push({ k, ledger: Math.round(taken[k] || 0), field: Math.round(a.taken || 0) });
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(per)) out[k] = { name: v.name, dealt: band(v.dealt), taken: band(v.taken), healing: band(v.healing) };
  return { bands: out, deferred, winRate: Math.round((100 * wins) / N), simTurnsMedian: pctile(turnsArr, 0.5), reflectPerFight: Math.round(reflectPerFight / N), chHealPerFight: Math.round(chHealPerFight / N), takenLedgerVsField };
}

// ── comparison + gate ──────────────────────────────────────────────────────────────────────────────────
function fmt(n) { return n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n)); }

async function main() {
  if (!process.env.SUPABASE_URL) { console.log('QA_JSON ' + JSON.stringify({ rung: 'per-hero-bands', pass: 0, fail: 0, skipped: 'no DB — run with --env-file=.env.local' })); process.exit(0); }
  const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
  const _c = new Map();
  const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };
  const manualCaps = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'manual-captures.json'), 'utf8')).captures;
  const READER_LOG = path.join(REPO, 'gestal-sync', 'RslBattleReader', 'output', 'battle-log.json');
  const readerCaps = fs.existsSync(READER_LOG) ? JSON.parse(fs.readFileSync(READER_LOG, 'utf8')) : [];

  const failures = [];
  const perContentJson = [];
  const historyContents = {};   // measurement backbone: per-content → per-champ → per-metric {sim, realMedian, inBand, devPct}

  for (const { fixture, dungeon, stage, account, teamVariant } of CONTENTS) {
    const acctLabel = account ? ` · ${account}${teamVariant ? '/' + teamVariant : ''}` : '';
    console.log(`\n═══ PER-HERO BANDS — ${dungeon} ${stage}${acctLabel}  (sim ${N} seeds vs captured reality) ═══`);
    const sim = await simBands(rest, fixture);
    if (sim.skip) { console.log(`  skipped: ${sim.skip}`); continue; }
    const real = capturedBands(manualCaps, readerCaps, dungeon, stage, account, teamVariant);
    const gatedHere = real.n > 0;
    const cKey = `${dungeon} ${stage}${account ? ` [${account}]` : ''}`;
    const th = thresholdsFor(dungeon, stage);
    historyContents[cKey] = { simWinRate: sim.winRate, capturedWins: real.n, source: real.source, thresholds: th, champs: {} };
    console.log(`  sim win rate ${sim.winRate}%  ·  captured wins: ${real.n} [${real.source}]  ·  thresholds: dealt/taken ${Math.round(th.perHeroDealtPct * 100)}%/${Math.round(th.perHeroTakenPct * 100)}%, WR ${th.winRatePctPoints}pp, turns ${Math.round(th.medianTurnsPct * 100)}%${gatedHere ? '' : '  → NO CAPTURES: report-only, not gated'}`);
    console.log(`  ${'CHAMPION'.padEnd(10)}${'METRIC'.padEnd(9)}${'SIM med'.padStart(9)}${'REAL p10'.padStart(10)}${'REAL med'.padStart(10)}${'REAL p90'.padStart(10)}   VERDICT`);

    const champs = new Set([...Object.keys(sim.bands), ...Object.keys(real.bands)]);
    for (const k of [...champs].sort()) {
      const s = sim.bands[k], r = real.bands[k];
      const name = (r?.name || s?.name || k);
      for (const metric of ['dealt', 'taken', 'healing']) {
        const sm = s?.[metric]?.median ?? null;
        const rp10 = r?.[metric]?.p10 ?? null, rmed = r?.[metric]?.median ?? null, rp90 = r?.[metric]?.p90 ?? null;
        const thPct = THRESH_METRIC[metric] ? th[THRESH_METRIC[metric]] : null;   // null ⇒ not gated (healing)
        const inBand = (sm != null && rmed != null) ? !(sm < rp10 || sm > rp90) : null;
        const devPct = (sm != null && rmed != null && rmed > 0) ? Math.round((Math.abs(sm - rmed) / rmed) * 100) : null;
        // GATE = "within threshold% of the reality MEDIAN" (config-driven). inBand (p10–p90) stays as context.
        const gated = thPct != null && gatedHere && rmed != null && sm != null;
        const failed = !!(gated && devPct != null && devPct > thPct * 100);
        const vstr = rmed == null ? 'no capture' : sm == null ? 'no sim' : inBand ? 'in-band' : `${devPct}% ${sm < rp10 ? 'below' : 'above'}`;
        // DISPLAY the median-deviation the gate actually uses (so a "fails but in p10–p90" case is explained, not contradictory).
        const disp = rmed == null ? 'no capture' : sm == null ? 'no sim'
          : thPct == null ? `${vstr} · report-only`
          : `${devPct}% off med${inBand ? ' (in p10–p90)' : ''}  ${failed ? '❌ GATE (>' + Math.round(thPct * 100) + '%)' : '✅'}`;
        if (failed) failures.push({ content: cKey, champ: name, metric, sim: sm, median: rmed, devPct, msg: `[${cKey}] ${name} ${metric}: sim ${fmt(sm)} vs reality median ${fmt(rmed)} — ${devPct}% off (tol ${Math.round(thPct * 100)}%)` });
        console.log(`  ${name.slice(0, 9).padEnd(10)}${metric.padEnd(9)}${fmt(sm).padStart(9)}${fmt(rp10).padStart(10)}${fmt(rmed).padStart(10)}${fmt(rp90).padStart(10)}   ${disp}`);
        (historyContents[cKey].champs[name] ??= {})[metric] = { sim: sm, realMedian: rmed, verdict: vstr, inBand, devPct, gated, failed };
      }
    }
    // WIN-RATE + MEDIAN-TURNS gates (per content, from config thresholds)
    if (gatedHere && real.winRate != null) {
      const wrDiff = Math.abs(sim.winRate - real.winRate);
      const wrFail = wrDiff > th.winRatePctPoints;
      console.log(`  ${'WIN RATE'.padEnd(19)}sim ${sim.winRate}%  captured ${real.winRate}%  → Δ${wrDiff}pp (tol ${th.winRatePctPoints}pp)  ${wrFail ? '❌ GATE' : '✅'}`);
      if (wrFail) failures.push({ content: cKey, champ: '—', metric: 'winRate', msg: `[${cKey}] win rate: sim ${sim.winRate}% vs captured ${real.winRate}% — Δ${wrDiff}pp (tol ${th.winRatePctPoints}pp)` });
      historyContents[cKey].winRate = { sim: sim.winRate, captured: real.winRate, diffPP: wrDiff, tolPP: th.winRatePctPoints, pass: !wrFail };
    }
    if (gatedHere && real.medianTurns != null && sim.simTurnsMedian != null) {
      const tdev = real.medianTurns > 0 ? Math.abs(sim.simTurnsMedian - real.medianTurns) / real.medianTurns : 0;
      const tFail = tdev > th.medianTurnsPct;
      console.log(`  ${'MEDIAN TURNS'.padEnd(19)}sim ${sim.simTurnsMedian}  captured ${real.medianTurns}  → ${Math.round(tdev * 100)}% off (tol ${Math.round(th.medianTurnsPct * 100)}%)  ${tFail ? '❌ GATE' : '✅'}`);
      if (tFail) failures.push({ content: cKey, champ: '—', metric: 'medianTurns', msg: `[${cKey}] median turns: sim ${sim.simTurnsMedian} vs captured ${real.medianTurns} — ${Math.round(tdev * 100)}% off (tol ${Math.round(th.medianTurnsPct * 100)}%)` });
      historyContents[cKey].medianTurns = { sim: sim.simTurnsMedian, captured: real.medianTurns, devPct: Math.round(tdev * 100), tolPct: Math.round(th.medianTurnsPct * 100), pass: !tFail };
    }
    // DEFERRED-MECHANIC GATE (Mike 2026-08-03): the QA must NOT report green while the sim is not simulating
    // part of the team's kit — a pass on an incomplete model is a FALSE green. Any deferred mechanic on a
    // GATED team is a blocking failure; the per-champion list printed above names exactly what to wire.
    if (gatedHere && sim.deferred?.length) {
      const total = sim.deferred.reduce((s, d) => s + d.count, 0);
      console.log(`  ${'DEFERRED MECHANICS'.padEnd(19)}${total} unmodelled on this team  → ❌ GATE (QA cannot pass while the sim is incomplete)`);
      failures.push({ content: cKey, champ: '—', metric: 'deferredMechanics', count: total, msg: `[${cKey}] ${total} DEFERRED (unmodelled) mechanics — QA cannot pass while the sim is incomplete (see the per-champion list at the block header)` });
      historyContents[cKey].deferredMechanics = { count: total, byChampion: sim.deferred.map((d) => ({ champion: d.champion, count: d.count })) };
    }
    // integrity + attribution notes
    const badTaken = (sim.takenLedgerVsField || []).filter((x) => x.field > 0 && Math.abs(x.ledger - x.field) / x.field > 0.10).length;
    console.log(`  NOTES:`);
    console.log(`    · DEALT excludes REFLECT (~${fmt(sim.reflectPerFight)}/fight, unattributed in the ledger) → Pelops/Vergis dealt reads low by that much.`);
    console.log(`    · HEALING is report-only: excludes [Continuous Heal] (~${fmt(sim.chHealPerFight)}/fight, sourced to the string not the caster) and magma-reflection lifesteal (not ledgered).`);
    console.log(`    · TAKEN uses combatant.taken (the survival-oracle field = victory-screen blue bar). Ledger cross-check: ${(sim.takenLedgerVsField?.length || 0) - badTaken}/${sim.takenLedgerVsField?.length || 0} champ-fights AGREE with the field (boss hits now emit a 'damage' ledger event via dragon.js strike/scorchStrike). A gap here would mean a scripted-enemy path still bypasses recordEffect.`);
    perContentJson.push({ dungeon, stage, gated: gatedHere, capturedWins: real.n, simWinRate: sim.winRate });
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${failures.length === 0 ? '✅ all gated metrics within the acceptance thresholds (config/qa-thresholds.json)' : '❌ ' + failures.length + ' metric(s) outside the acceptance thresholds (config/qa-thresholds.json)'}`);
  for (const f of failures) console.log(`     ❌ ${f.msg}`);
  console.log('\nQA_JSON ' + JSON.stringify({ rung: 'per-hero-bands', pass: failures.length === 0 ? 1 : 0, fail: failures.length, seeds: N, thresholdsConfig: 'config/qa-thresholds.json', gatedMetrics: GATED, failures, contents: perContentJson }));

  // MEASUREMENT BACKBONE: append this run to data/qa-history.json (timestamp, commit, per-champ per-metric sim
  // median + verdict) so the file shows whether the sim is getting better or worse over time.
  try {
    appendQaHistory({ ts: nowIso(), commit: gitCommit(), rung: 'per-hero-bands', seeds: N, fail: failures.length, contents: historyContents });
    console.log('  · appended to data/qa-history.json');
  } catch (e) { console.error('  (qa-history append failed: ' + e.message + ')'); }

  process.exit(failures.length ? 1 : 0);
}

main();
