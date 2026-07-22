/**
 * whats-missing.mjs — "what are we missing?" over the captured battle log. For each battle it
 * re-evaluates the fielded team, runs lib/battle-gaps.js, and rolls the gaps up into a
 * frequency-ranked BACKLOG: the data to capture, checks to add, and contradictions to chase —
 * the running answer to "how do we improve the battle-review system?".
 *
 * Read-only. Usage:
 *   node --env-file=.env.local tools/whats-missing.mjs [--account <id>] [--verbose] [--latest]
 *                                                     [--all] [--out <file.md>] [--quiet]
 *
 * `--all` rolls up EVERY account with a roster snapshot (one account's backlog is one account's
 * blind spots); `--out` writes the ranked backlog to a markdown file so it is standing rather than
 * scrollback; `--quiet` prints only the header and the top items. watch-reconcile runs
 * `--all --out knowledge/gap-backlog.md` on a throttle — this classifier had already found the
 * team-min HP defect 10× while it was being rediscovered by hand, which is what "built but never
 * called" costs.
 */
import fs from 'fs';
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
const ALL_ACCOUNTS = args.includes('--all');
const QUIET = args.includes('--quiet');
const accountArg = (() => { const i = args.indexOf('--account'); return i >= 0 ? args[i + 1] : null; })();
const OUT = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i + 1] : null; })();

const all = readBattleHistory().map(normalizeBattle);
if (!all.length) { console.log('No battles logged yet.'); process.exit(0); }
const newest = [...all].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0];
const accountIds = ALL_ACCOUNTS
  ? [...new Set(all.map(b => b.accountId).filter(Boolean))]
  : [accountArg ?? newest.accountId ?? null];

// Clan Boss chest-tier bands per difficulty (for the predicted-vs-actual chest gap).
const { data: tierRows } = await supabase.from('clan_boss_chest_tiers')
  .select('chest_name, sort_order, damage_min, damage_max, dungeon_stages(label, dungeons(name))');
const tiersByDiff = {};
for (const r of tierRows ?? []) {
  const d = r.dungeon_stages?.label;
  if (r.dungeon_stages?.dungeons?.name === 'Clan Boss' && d) (tiersByDiff[d] ??= []).push(r);
}
for (const d in tiersByDiff) tiersByDiff[d].sort((a, b) => a.sort_order - b.sort_order);

const ICON = { data_missing: '📭', contradiction: '❗', unused_signal: '🧩', no_check: '🕳️' };
const backlog = new Map(); // "category:id" → { category, id, title, suggestion, count, samples[] }
const contradictions = []; // rich context for the LLM ask (won-despite-gap → candidate missing tags)
const covered = [];        // per-account "<name> (N)" for the header
const rosters = [];        // roster snapshots actually used (the --ask context)
let totalEvaluable = 0;

for (const accountId of accountIds) {
let battles = all.filter(b => !accountId || b.accountId === accountId);
if (latest && !ALL_ACCOUNTS) battles = [[...battles].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0]];
const roster = readGestalRoster(accountId);
if (!roster) continue;   // no snapshot → nothing to rebuild the fielded team from
rosters.push(roster);

const { groups, evaluableCount } = await groupAndEvaluateBattles(battles, roster, supabase);
totalEvaluable += evaluableCount;
covered.push(`${roster?.displayName ?? accountId ?? 'unknown'} (${evaluableCount})`);

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
}

console.log(`\nWhat are we missing? — ${covered.join(', ') || 'no account with a roster snapshot'} — ${totalEvaluable} evaluable battle(s)\n`);
if (!backlog.size) { console.log('No gaps found (need seeded stages + captured battles).'); process.exit(0); }

// Ranked backlog — most frequent gaps first, grouped by category.
const order = ['data_missing', 'contradiction', 'unused_signal', 'no_check'];
const items = [...backlog.values()].sort((a, b) =>
  order.indexOf(a.category) - order.indexOf(b.category) || b.count - a.count);

const shown = QUIET ? items.slice(0, 5) : items;
console.log(QUIET ? `BACKLOG — top ${shown.length} of ${items.length} (full list: ${OUT ?? 'run without --quiet'}):\n`
                  : 'BACKLOG — what to capture / check / fix, most frequent first:\n');
let lastCat = null;
for (const it of shown) {
  if (it.category !== lastCat) { console.log(`${ICON[it.category]} ${it.category.toUpperCase().replace('_', ' ')}`); lastCat = it.category; }
  console.log(`   (${String(it.count).padStart(3)}×) ${it.title}`);
  if (QUIET) continue;
  console.log(`         → ${it.suggestion}`);
  for (const s of it.samples.slice(0, 2)) console.log(`           · ${s}`);
}
if (!QUIET) {
  console.log('\n📭 capture more data   ❗ model contradicted (investigate)   🧩 captured-but-unused   🕳️ missing check');
  console.log('Run after each play session; the top items are where the review system improves most.\n');
}

// ── standing artifact ────────────────────────────────────────────────────────
// Written, not printed, because the whole point is that a cold-starting session can READ the
// backlog instead of re-deriving it. Regenerated in full each time — no state to drift.
if (OUT) {
  const md = `# Gap Backlog — what the model doesn't yet capture, check, or explain\n\n`
    + `**Machine-generated by \`tools/whats-missing.mjs\` (lib/battle-gaps.js + lib/assumption-audit.js).\n`
    + `Do not edit by hand — it is overwritten on every run.** Regenerated ${new Date().toISOString()}\n`
    + `over ${totalEvaluable} evaluable battle(s) across: ${covered.join(', ')}.\n\n`
    + `Counts are OCCURRENCES across battles, so the ranking is "how often reality hit this gap",\n`
    + `not how important it feels. \`contradiction\` rows are the model being WRONG about a specific\n`
    + `battle — those are the ones that can move \`tools/battle-suite.mjs\`.\n\n`
    + order.filter(cat => items.some(i => i.category === cat)).map(cat =>
        `## ${ICON[cat]} ${cat.replace('_', ' ')}\n\n`
        + items.filter(i => i.category === cat).map(it =>
            `- **${it.count}× — ${it.title}**\n  - → ${it.suggestion}\n`
            + it.samples.slice(0, 2).map(s => `  - _${s}_\n`).join('')).join('')
      ).join('\n');
  fs.writeFileSync(OUT, md);
  console.log(`  → wrote ${OUT} (${items.length} distinct gaps)\n`);
}

// ── LLM ask: reason over the data to surface NOVEL gaps the deterministic list misses ──
if (args.includes('--ask')) {
  if (!process.env.ANTHROPIC_API_KEY) { console.log('(--ask needs ANTHROPIC_API_KEY in .env.local)\n'); process.exit(0); }
  const backlogArr = items.map(it => ({ category: it.category, title: it.title, count: it.count, suggestion: it.suggestion }));
  const rosterNote = rosters.map(r => `${r?.displayName ?? 'unknown'} — ${(r?.champions ?? []).filter(c => !c.inStorage).length} champions owned`).join(' · ');
  console.log(`🧠 Asking "what are we missing?" — LLM review over ${contradictions.length} contradiction(s) + the backlog…\n`);
  try {
    const review = await reviewGaps({ backlog: backlogArr, contradictions, rosterNote });
    console.log(review);
    console.log('\n(hypotheses for human review — nothing is auto-applied; tag proposals still go through the normal review)\n');
  } catch (e) {
    console.error('LLM review failed:', e.message);
  }
}
