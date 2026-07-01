// ── tools/upload-battles.js ──────────────────────────────────────────────────
// Battle data pipeline (Option: outcomes moat). Two phases:
//   1. UPLOAD  — battle-log.json → battle_history (resolving dungeon_stage_id and
//                profile_id where possible). Idempotent (dedup on account_id,captured_at).
//   2. PROCESS — for battles with a resolved, seeded stage, map heroes → team and
//                call evaluateTeam() (via the shared battle-pipeline), writing one
//                recommendation_outcomes row per battle (source='battle_reader').
//
// Usage: node --env-file=.env.local tools/upload-battles.js
import { createClient } from '@supabase/supabase-js';
import { readBattleHistory, readGestalRoster } from '../lib/gestal-context.js';
import { resolveDungeonStage } from '../lib/match-engine.js';
import { groupAndEvaluateBattles, stageOf } from '../lib/battle-pipeline.js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Needs DB access. Run: node --env-file=.env.local tools/upload-battles.js');
  process.exit(1);
}
const supabase = createClient(
  process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });

const battles = readBattleHistory();
console.log(`Read ${battles.length} battles from battle-log.json\n`);

// ── Phase 1: upload → battle_history ──────────────────────────────────────────
// Cache profile_id per gestal account id (via rsl_accounts). Most will be null
// (nothing imported yet) — that's fine, profile_id is nullable.
const profileCache = new Map();
async function profileIdFor(accountId) {
  if (!accountId) return null;
  if (profileCache.has(accountId)) return profileCache.get(accountId);
  const { data } = await supabase.from('rsl_accounts').select('profile_id').eq('account_id', accountId).maybeSingle();
  const pid = data?.profile_id ?? null;
  profileCache.set(accountId, pid);
  return pid;
}

let uploaded = 0, resolved = 0;
for (const b of battles) {
  const stage = stageOf(b);
  let dungeonStageId = null;
  if (b.dungeon && stage != null) {
    const { stage: st } = await resolveDungeonStage(supabase, b.dungeon, stage, b.difficulty ?? null);
    dungeonStageId = st?.id ?? null;
  }
  if (dungeonStageId) resolved++;

  const row = {
    profile_id:       await profileIdFor(b.accountId),
    account_id:       b.accountId ?? null,
    display_name:     b.displayName ?? null,
    captured_at:      b.capturedAt,
    dungeon:          b.dungeon ?? null,
    stage_number:     stage,
    difficulty:       b.difficulty ?? null,
    dungeon_stage_id: dungeonStageId,
    result:           b.result ?? null,
    finish_cause:     b.finishCause ?? null,
    turns:            typeof b.turns === 'number' ? b.turns : null,
    heroes:           b.heroes ?? [],
    source:           'battle_reader',
  };
  const { error } = await supabase.from('battle_history')
    .upsert(row, { onConflict: 'account_id,captured_at', ignoreDuplicates: true });
  if (error) { console.error(`  upload error (${b.capturedAt}):`, error.message); continue; }
  uploaded++;
}
console.log(`Phase 1 — battle_history: ${uploaded} uploaded, ${resolved} resolved to a dungeon_stage_id`);

// ── Phase 2: process → recommendation_outcomes ────────────────────────────────
// Process per account (each account's Gestal roster maps its battles' hero names).
const byAccount = new Map();
for (const b of battles) { const k = b.accountId ?? '(none)'; (byAccount.get(k) ?? byAccount.set(k, []).get(k)).push(b); }

// Existing battle_reader outcomes → skip set (idempotent re-runs).
const { data: existing } = await supabase.from('recommendation_outcomes')
  .select('user_id, dungeon_stage_id, created_at').eq('source', 'battle_reader');
const seen = new Set((existing ?? []).map(r => `${r.user_id}|${r.dungeon_stage_id}|${new Date(r.created_at).getTime()}`));

let outcomes = 0, seededGroups = 0;
for (const [accountId, accBattles] of byAccount) {
  const roster = readGestalRoster(accountId === '(none)' ? null : accountId);
  const { groups } = await groupAndEvaluateBattles(accBattles, roster, supabase);
  for (const g of groups) {
    if (!g.evaluation?.seeded) continue;
    seededGroups++;
    const ev = g.evaluation;
    const verdict = ev.actionable_goals ? (ev.gaps.length === 0 ? 'ready' : 'not_ready') : null;
    for (const b of g.battles) {
      const key = `${accountId}|${ev.dungeon_stage_id}|${new Date(b.capturedAt).getTime()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const outcome = b.result === 'Victory' ? 'cleared' : b.result === 'Defeat' ? 'failed' : null;
      const { error } = await supabase.from('recommendation_outcomes').insert({
        user_id:          accountId,
        game_id:          'raid_shadow_legends',
        dungeon_stage_id: ev.dungeon_stage_id,
        recommended_team: g.names,
        outcome,
        verdict,
        verdict_band:     ev.verdict_band ?? null,
        confidence_pct:   ev.confidence_pct ?? null,
        source:           'battle_reader',
        created_at:       b.capturedAt,
      });
      if (error) { console.error('  outcome insert error:', error.message); continue; }
      outcomes++;
    }
  }
}
console.log(`Phase 2 — recommendation_outcomes: ${outcomes} rows written (${seededGroups} seeded team/stage group(s))`);
console.log(`\nSUMMARY: ${battles.length} battles read → ${uploaded} uploaded → ${resolved} dungeon_stage resolved → ${outcomes} outcomes.`);
