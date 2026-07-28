// tools/turn-verify.mjs — TURN-BY-TURN OUTCOME VERIFIER (CLI, one battle).
//
// The gap this closes: the recordEffect ledger checks fired-vs-consumed at the MOMENT an effect happens. It
// cannot see a mechanic that lands correctly and then silently does NOTHING downstream — e.g. [Petrification]
// placed (fired+consumed) that expires before it can skip a turn. No event is emitted for a consequence that
// never occurs, so fired-vs-consumed is blind to it. This tool tracks every PLACED effect through to its
// INTENDED CONSEQUENCE, turn by turn, and flags any that were INERT. Shares its contracts with the QA rung
// (tools/model-turn-verify.mjs) via tools/verify-core.mjs, so the CLI and the gate can never disagree.
//
// Run:  node --env-file=.env.local tools/turn-verify.mjs [seed] [fixture]
//   TURNS=lo-hi   limit the printed per-turn ledger      QUIET=1  scorecard only
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { runOne, scoreOutcomes } from './verify-core.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// DEFAULT: no seed → DETERMINISTIC verify mode (every chance lands, crit = EV) — verify the mechanics.
// Pass a numeric seed as the first arg for a stochastic (representative) run.
const seed = (process.argv[2] != null && process.argv[2] !== '') ? Number(process.argv[2]) : null;
const FIXTURE = process.argv[3] || 'dragon16-donbambus-current.json';
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test/golden', FIXTURE), 'utf8'));
if (!process.env.SUPABASE_URL) { console.log('needs the DB — run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const one = await runOne({ rest, fixture, repoRoot: REPO, seed });
if (one.skip) { console.log('skipped:', one.skip); process.exit(0); }
const { fx, orderViolations, turnActor, actedAt, res } = one;
const nf = (n) => n == null ? '' : Math.round(n).toLocaleString();

// ── per-turn ledger ──────────────────────────────────────────────────────────
const [lo, hi] = process.env.TURNS ? String(process.env.TURNS).split('-').map(Number) : [1, 9999];
if (!process.env.QUIET) {
  const byTurn = {}; for (const e of fx) (byTurn[e.turn] ??= []).push(e);
  console.log(`\n══ TURN-BY-TURN — ${fixture.id} · ${seed == null ? 'DETERMINISTIC (every chance lands, crit=EV)' : 'seed ' + seed} — ${res.won ? 'WIN' : 'LOSS'} in ${res.turns} turns ══`);
  for (const t of Object.keys(byTurn).map(Number).sort((a, b) => a - b).filter(t => t >= lo && t <= hi)) {
    const es = byTurn[t]; console.log(`\n── t${String(t).padStart(3)} [${es[0]?.phase ?? ''}] ${turnActor[t] ?? ''} ──`);
    for (const e of es) {
      const miss = e.consumed === false ? `  ✗ ${e.note || 'NOT CONSUMED'}` : '';
      const amt = e.amount != null ? ` ${nf(e.amount)}` : '';
      const tag = e.kind === 'cc' ? 'CC-skip' : e.kind;
      console.log(`     ${String(tag).padEnd(8)} ${e.source ? e.source + ' → ' : ''}${e.target ?? ''}${e.subtype ? ` [${e.subtype}]` : ''}${amt}${miss}`);
    }
  }
}

// ── turn-order + outcome scorecard (shared contracts) ─────────────────────────
console.log(`\n\n══ TURN-ORDER CHECK ══  ${orderViolations.length === 0 ? `✅ 0 violations across ${res.turns} turns` : `❌ ${orderViolations.length} violation(s)`}`);
for (const v of orderViolations.slice(0, 8)) console.log(`     t${v.turn}: picked ${v.picked} (TM ${v.pickedTM.toFixed(2)}) but ${v.maxUnit} had ${v.maxTM.toFixed(2)}`);

const { rows, firedNotConsumed } = scoreOutcomes(fx, actedAt);
console.log(`\n══ OUTCOME SCORECARD (placed → did it do its job?) ══`);
console.log(`  MECHANIC            placed  opps   consequence          verdict`);
let inert = 0; const placementOnly = [];
for (const r of rows) {
  let obs, verdict;
  if (r.contract === 'skip') { obs = `${r.consequence} skip(s)`; verdict = r.consequence > 0 ? '✅ WORKS' : r.selfOnly ? '· n/a (self-applied CC — owner-controlled)' : r.opps > 0 ? `❌ INERT (${r.opps} live, 0 skips)` : '· n/a (targets died first)'; }
  else if (r.contract === 'tick') { obs = `${r.consequence} dmg-event(s)`; verdict = r.consequence > 0 ? '✅ WORKS (tick/activate)' : r.opps > 0 ? `❌ INERT (${r.opps} live, 0 damage)` : '· n/a (targets died first)'; }
  else if (r.contract === 'heal') { obs = `${r.consequence} heal tick(s)`; verdict = r.consequence > 0 ? '✅ WORKS' : r.opps > 0 ? `❌ INERT (${r.opps} turns, 0 heals)` : '· n/a (no turns while buffed)'; }
  else if (r.contract === 'reactive') { obs = `${r.consequence} soak/reflect`; verdict = r.consequence > 0 ? '✅ WORKS' : r.opps > 0 ? `❌ INERT (hit ${r.opps}×, 0 soak)` : '· n/a (buffed unit never hit)'; }
  else if (r.contract === 'targeting') { obs = `${r.consequence}/${r.opps} picks steered`; verdict = r.opps === 0 ? '· n/a (no mob single-target picks)' : r.consequence > 0 ? '✅ WORKS' : `❌ INERT (${r.opps} picks, buff ignored)`; }
  else { obs = 'stat/damage pipe'; verdict = '· PLACEMENT-ONLY (outcome not yet verified)'; placementOnly.push(r.mechanic); }
  if (r.inert) inert++;
  console.log(`  ${r.mechanic.padEnd(20)}${String(r.placed).padStart(4)}  ${String(r.opps ?? '—').padStart(4)}   ${obs.padEnd(20)} ${verdict}`);
}
console.log(`\n  fired-but-not-consumed (unexplained): ${firedNotConsumed.length}`);
for (const e of firedNotConsumed.slice(0, 8)) console.log(`     ✗ t${e.turn} ${e.kind} ${e.subtype ?? ''} → ${e.target} ${e.note ? '(' + e.note + ')' : ''}`);
console.log(`\n══ VERDICT ══`);
console.log(`  turn order:       ${orderViolations.length === 0 ? '✅ verified' : '❌ ' + orderViolations.length + ' violations'}`);
console.log(`  inert mechanics:  ${inert === 0 ? '✅ none' : '❌ ' + inert}`);
console.log(`  placement-only:   ${placementOnly.length} not yet outcome-verified (coverage gap): ${placementOnly.join(', ')}`);
