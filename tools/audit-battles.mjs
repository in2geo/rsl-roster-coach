/**
 * audit-battles.mjs — run the assumption audit (lib/assumption-audit.js) over the captured
 * battle log. For each battle, re-evaluates the fielded team with the real matching engine,
 * reconciles the engine's assumptions against what actually happened, and prints per-battle
 * signals plus an aggregate (which assumptions are systematically confirmed vs refuted).
 *
 * Read-only (DB reads for the champion/dungeon knowledge base). Usage:
 *   node --env-file=.env.local tools/audit-battles.mjs [--account <id>] [--verbose]
 */
import { readBattleHistory, readGestalRoster } from '../lib/gestal-context.js';
import { groupAndEvaluateBattles } from '../lib/battle-pipeline.js';
import { normalizeBattle } from '../lib/clan-boss.js';
import { auditBattle, AUDIT_STATUS as S } from '../lib/assumption-audit.js';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Needs DB. Run: node --env-file=.env.local tools/audit-battles.mjs');
  process.exit(1);
}
const supabase = createClient(
  process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const accountArg = (() => { const i = args.indexOf('--account'); return i >= 0 ? args[i + 1] : null; })();

const all = readBattleHistory().map(normalizeBattle);
if (!all.length) { console.log('No battles in the log.'); process.exit(0); }
const accountId = accountArg ?? [...all].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0].accountId ?? null;
const battles = all.filter(b => !accountId || b.accountId === accountId);
const roster = readGestalRoster(accountId);

const { groups, evaluableCount } = await groupAndEvaluateBattles(battles, roster, supabase);
console.log(`\nAssumption audit — ${roster?.displayName ?? accountId ?? 'unknown'} — ${evaluableCount} evaluable battle(s), ${groups.length} team/stage combo(s)\n`);

// Aggregate signals across every battle in every group.
const agg = new Map(); // checkId → { assumption, counts:{status→n}, samples:[] }
const ICON = { [S.CONFIRMED]: '✅', [S.REFUTED]: '❌', [S.CONSERVATIVE]: '🟡', [S.NEEDS_DATA]: '·', [S.AGGREGATE]: '∑' };

for (const g of groups) {
  if (!g.evaluation?.seeded && g.evaluation?.reason) continue; // unseeded stage — nothing to reconcile
  for (const b of g.battles) {
    const checks = auditBattle(g.evaluation, b);
    if (verbose && checks.length) {
      console.log(`${g.dungeon} ${g.difficulty ?? ''} St${g.stage} [${g.names.join(', ')}] — ${b.result}${b.turns != null ? ` ${b.turns}t` : ''}`);
      for (const c of checks) console.log(`   ${ICON[c.status] ?? '?'} ${c.id}: ${c.signal}`);
      console.log('');
    }
    for (const c of checks) {
      if (!agg.has(c.id)) agg.set(c.id, { assumption: c.assumption, category: c.category, counts: {}, samples: [] });
      const a = agg.get(c.id);
      a.counts[c.status] = (a.counts[c.status] ?? 0) + 1;
      if ((c.status === S.REFUTED || c.status === S.CONSERVATIVE) && a.samples.length < 5) a.samples.push(c.signal);
    }
  }
}

if (!agg.size) { console.log('No assumptions to reconcile yet (need seeded stages + captured battles).'); process.exit(0); }

console.log('Aggregate (across all battles):\n');
for (const [id, a] of [...agg.entries()].sort((x, y) => (y[1].counts[S.REFUTED] ?? 0) - (x[1].counts[S.REFUTED] ?? 0))) {
  const parts = Object.entries(a.counts).map(([st, n]) => `${ICON[st] ?? st} ${n}`).join('  ');
  console.log(`[${a.category}] ${id}`);
  console.log(`   ${a.assumption}`);
  console.log(`   ${parts}`);
  for (const s of a.samples) console.log(`     ↳ ${s}`);
  console.log('');
}
console.log('Legend: ✅ confirmed  ❌ refuted  🟡 conservative(too strict)  · needs-data  ∑ aggregate-only');
console.log('One battle is noise; a check that is refuted across MANY battles is the calibration target.\n');
