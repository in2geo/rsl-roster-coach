/**
 * whats-missing.mjs — "what are we missing?" over the captured battle log. For each battle it
 * re-evaluates the fielded team, runs lib/battle-gaps.js, and rolls the gaps up into a
 * frequency-ranked BACKLOG: the data to capture, checks to add, and contradictions to chase —
 * the running answer to "how do we improve the battle-review system?".
 *
 * Read-only. Usage:
 *   node --env-file=.env.local tools/whats-missing.mjs [--account <id>] [--verbose] [--latest]
 */
import { readBattleHistory, readGestalRoster } from '../lib/gestal-context.js';
import { groupAndEvaluateBattles } from '../lib/battle-pipeline.js';
import { normalizeBattle } from '../lib/clan-boss.js';
import { findBattleGaps } from '../lib/battle-gaps.js';
import { detectSynergies } from '../lib/synergies.js';
import { reviewGaps } from '../lib/gap-review.js';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Needs DB. Run: node --env-file=.env.local tools/whats-missing.mjs');
  process.exit(1);
}
const supabase = createClient(
  process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const latest = args.includes('--latest');
const accountArg = (() => { const i = args.indexOf('--account'); return i >= 0 ? args[i + 1] : null; })();

const all = readBattleHistory().map(normalizeBattle);
if (!all.length) { console.log('No battles logged yet.'); process.exit(0); }
const accountId = accountArg ?? [...all].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0].accountId ?? null;
let battles = all.filter(b => !accountId || b.accountId === accountId);
if (latest) battles = [[...battles].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0]];
const roster = readGestalRoster(accountId);

// Clan Boss chest-tier bands per difficulty (for the predicted-vs-actual chest gap).
const { data: tierRows } = await supabase.from('clan_boss_chest_tiers')
  .select('chest_name, sort_order, damage_min, damage_max, dungeon_stages(label, dungeons(name))');
const tiersByDiff = {};
for (const r of tierRows ?? []) {
  const d = r.dungeon_stages?.label;
  if (r.dungeon_stages?.dungeons?.name === 'Clan Boss' && d) (tiersByDiff[d] ??= []).push(r);
}
for (const d in tiersByDiff) tiersByDiff[d].sort((a, b) => a.sort_order - b.sort_order);

const { groups, evaluableCount } = await groupAndEvaluateBattles(battles, roster, supabase);
console.log(`\nWhat are we missing? — ${roster?.displayName ?? accountId ?? 'unknown'} — ${evaluableCount} evaluable battle(s)\n`);

const ICON = { data_missing: '📭', contradiction: '❗', unused_signal: '🧩', no_check: '🕳️' };
const backlog = new Map(); // "category:id" → { category, id, title, suggestion, count, samples[] }
const contradictions = []; // rich context for the LLM ask (won-despite-gap → candidate missing tags)

for (const g of groups) {
  if (g.evaluation && g.evaluation.seeded === false) continue; // unseeded stage — nothing to reconcile
  const tiers = tiersByDiff[g.difficulty] ?? null;
  // Fielded team with faction/role/tags — used for both synergy detection and the LLM context.
  const synTeam = (g.team ?? []).map(c => ({
    name: c.champion?.name ?? c.display_name,
    faction: c.champion?.faction,
    role: c.champion?.role,
    tags: (c.champion?.champion_tags ?? [])
      .filter(t => t.status === 'approved').map(t => t.tags?.name).filter(Boolean),
  }));
  const teamSynergies = detectSynergies(synTeam);
  // A team that WON a stage with an unmet goal is the richest missing-tag signal.
  if (g.wins > 0 && (g.evaluation?.gaps?.length ?? 0) > 0 && contradictions.length < 12)
    contradictions.push({
      content: `${g.dungeon} ${g.difficulty ?? ''} Stage ${g.stage}`.replace(/\s+/g, ' ').trim(),
      result: `${g.wins}W/${g.losses}L`,
      unmetGoals: g.evaluation.gaps,
      team: synTeam.map(({ name, role, tags }) => ({ name, role, tags })),
      synergies: teamSynergies.map(s => ({ id: s.id, members: s.members, effect: s.effect })),
      cbDamage: g.evaluation.cb_damage ?? null,
    });
  for (const b of g.battles) {
    const { gaps } = findBattleGaps(g.evaluation, b, tiers, synTeam);
    if (verbose && gaps.length) {
      console.log(`${g.dungeon} ${g.difficulty ?? ''} St${g.stage} [${g.names.join(', ')}] — ${b.result}`);
      for (const gap of gaps) console.log(`   ${ICON[gap.category] ?? '•'} [${gap.category}] ${gap.title}`);
      console.log('');
    }
    for (const gap of gaps) {
      const key = `${gap.category}:${gap.id}`;
      if (!backlog.has(key)) backlog.set(key, { ...gap, count: 0, samples: [] });
      const item = backlog.get(key);
      item.count++;
      if (item.samples.length < 3 && gap.detail) item.samples.push(gap.detail);
    }
  }
}

if (!backlog.size) { console.log('No gaps found (need seeded stages + captured battles).'); process.exit(0); }

// Ranked backlog — most frequent gaps first, grouped by category.
const order = ['data_missing', 'contradiction', 'unused_signal', 'no_check'];
const items = [...backlog.values()].sort((a, b) =>
  order.indexOf(a.category) - order.indexOf(b.category) || b.count - a.count);

console.log('BACKLOG — what to capture / check / fix, most frequent first:\n');
let lastCat = null;
for (const it of items) {
  if (it.category !== lastCat) { console.log(`${ICON[it.category]} ${it.category.toUpperCase().replace('_', ' ')}`); lastCat = it.category; }
  console.log(`   (${String(it.count).padStart(3)}×) ${it.title}`);
  console.log(`         → ${it.suggestion}`);
  for (const s of it.samples.slice(0, 2)) console.log(`           · ${s}`);
}
console.log('\n📭 capture more data   ❗ model contradicted (investigate)   🧩 captured-but-unused   🕳️ missing check');
console.log('Run after each play session; the top items are where the review system improves most.\n');

// ── LLM ask: reason over the data to surface NOVEL gaps the deterministic list misses ──
if (args.includes('--ask')) {
  if (!process.env.ANTHROPIC_API_KEY) { console.log('(--ask needs ANTHROPIC_API_KEY in .env.local)\n'); process.exit(0); }
  const backlogArr = items.map(it => ({ category: it.category, title: it.title, count: it.count, suggestion: it.suggestion }));
  const rosterNote = `${roster?.displayName ?? accountId ?? 'unknown'} — ${(roster?.champions ?? []).filter(c => !c.inStorage).length} champions owned`;
  console.log(`🧠 Asking "what are we missing?" — LLM review over ${contradictions.length} contradiction(s) + the backlog…\n`);
  try {
    const review = await reviewGaps({ backlog: backlogArr, contradictions, rosterNote });
    console.log(review);
    console.log('\n(hypotheses for human review — nothing is auto-applied; tag proposals still go through the normal review)\n');
  } catch (e) {
    console.error('LLM review failed:', e.message);
  }
}
