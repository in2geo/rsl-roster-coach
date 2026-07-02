// ── tools/upload-battles.js ──────────────────────────────────────────────────
// Battle data pipeline (calibration moat). Manual sync — run after a play session.
//   Phase 1 UPLOAD  — battle-log.json → battle_history (resolve dungeon_stage_id +
//                     profile_id; user_id nullable). Idempotent via the
//                     (account_id, captured_at) unique index.
//   Phase 2 PROCESS — for each battle_history row with dungeon_stage_id not null and
//                     outcome_recorded = false: map heroes → team (shared roster
//                     mapper), evaluateTeam(), write ONE recommendation_outcomes row
//                     (source='battle_log'), then mark outcome_recorded = true.
//                     Skips Draw/Unknown (only cleared/failed are labeled outcomes).
//
// Usage: node --env-file=.env.local tools/upload-battles.js
import { createClient } from '@supabase/supabase-js';
import { readBattleHistory, readGestalRoster } from '../lib/gestal-context.js';
import { evaluateTeam, resolveDungeonStage } from '../lib/match-engine.js';
import { buildRosterMapper, lookupHero, stageOf } from '../lib/battle-pipeline.js';
import { normalizeBattle } from '../lib/clan-boss.js';

// Clan Boss outcomes are per-difficulty (the calibration solutions differ by tier),
// so an outcome row needs a confirmed difficulty. The reader now captures the full
// 5-champion team and identifies the run as Clan Boss, but the file alone doesn't
// carry difficulty — it's sourced from the in-memory stageId (4019xxx → tier, see
// lib/clan-boss.js), which only some captures resolve. A CB battle only reaches
// Phase 2 with a dungeon_stage_id when its difficulty is already known (difficulty
// IS the stage number for CB), so hold ONLY the difficulty-unknown rows and let the
// confirmed ones through. Set to false to release even difficulty-unknown CB rows.
const HOLD_CLAN_BOSS_UNKNOWN_DIFFICULTY = true;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Needs DB access. Run: node --env-file=.env.local tools/upload-battles.js');
  process.exit(1);
}
const supabase = createClient(
  process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });

const RESULTS = new Set(['Victory', 'Defeat', 'Draw', 'Unknown']);
// Normalize Clan Boss battles (battleKindId=3) → dungeon "Clan Boss" + difficulty so
// they resolve to a dungeon_stage_id instead of falling through as null.
const battles = readBattleHistory().map(normalizeBattle);
console.log(`Read ${battles.length} battles from battle-log.json\n`);

// ── Phase 1: upload → battle_history ──────────────────────────────────────────
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
  if (!b.accountId || !b.capturedAt) continue; // account_id + captured_at are the dedup key / required
  const stage = stageOf(b);
  let dungeonStageId = null;
  if (b.dungeon && stage != null) {
    const { stage: st } = await resolveDungeonStage(supabase, b.dungeon, stage, b.difficulty ?? null);
    dungeonStageId = st?.id ?? null;
  }
  if (dungeonStageId) resolved++;

  const { error } = await supabase.from('battle_history').upsert({
    user_id:           null,                    // hybrid: unattributed at capture time
    profile_id:        await profileIdFor(b.accountId),
    game_id:           'raid_shadow_legends',
    account_id:        b.accountId,
    display_name:      b.displayName ?? null,
    captured_at:       b.capturedAt,
    dungeon_name:      b.dungeon ?? null,
    stage_number:      stage,
    difficulty:        b.difficulty ?? null,
    result:            RESULTS.has(b.result) ? b.result : 'Unknown',
    turns:             typeof b.turns === 'number' ? b.turns : null,
    finish_cause:      b.finishCause ?? null,
    manual_skill_used: !!b.manualSkillUsed,
    heroes:            b.heroes ?? [],
    dungeon_stage_id:  dungeonStageId,
  }, { onConflict: 'account_id,captured_at', ignoreDuplicates: true });
  if (error) { console.error(`  upload error (${b.capturedAt}):`, error.message); continue; }
  uploaded++;
}
console.log(`Phase 1 — battle_history: ${uploaded} upserted, ${resolved} resolved to a dungeon_stage_id`);

// ── Phase 2: process battle_history → recommendation_outcomes ─────────────────
const { data: pending, error: pErr } = await supabase.from('battle_history')
  .select('id, account_id, user_id, dungeon_name, stage_number, difficulty, dungeon_stage_id, result, heroes, captured_at')
  .not('dungeon_stage_id', 'is', null).eq('outcome_recorded', false);
if (pErr) { console.error('pending query failed:', pErr.message); process.exit(1); }

// Roster mapper per account (maps this account's battle hero names → user_champions).
const mapperByAccount = new Map();
async function mapperFor(accountId) {
  if (mapperByAccount.has(accountId)) return mapperByAccount.get(accountId);
  const roster = readGestalRoster(accountId);
  const m = await buildRosterMapper(roster, supabase);
  mapperByAccount.set(accountId, m);
  return m;
}

let outcomes = 0, processed = 0, heldClanBoss = 0;
for (const row of pending ?? []) {
  // Hold only difficulty-unknown Clan Boss rows — leave outcome_recorded=false so they
  // flow automatically once difficulty is sourced (memory stageId recovers, or a
  // per-difficulty file signature is added). Confirmed-difficulty CB rows pass through.
  if (HOLD_CLAN_BOSS_UNKNOWN_DIFFICULTY && row.dungeon_name === 'Clan Boss' && !row.difficulty) { heldClanBoss++; continue; }
  processed++;
  const outcome = row.result === 'Victory' ? 'cleared' : row.result === 'Defeat' ? 'failed' : null;
  if (outcome) {
    const ucByName = await mapperFor(row.account_id);
    const team = (row.heroes ?? []).map(h => lookupHero(ucByName, h)).filter(Boolean);
    const ev = await evaluateTeam(team, row.dungeon_name, row.stage_number, row.difficulty);
    const { error } = await supabase.from('recommendation_outcomes').insert({
      user_id:                row.user_id ?? row.account_id,   // hybrid: fall back to in-game account id
      game_id:                'raid_shadow_legends',
      dungeon_stage_id:       row.dungeon_stage_id,
      recommended_team:       row.heroes,                       // the team actually fielded (not app-recommended)
      roster_snapshot:        row.heroes,                       // only what they fielded is known
      verdict:                ev.seeded ? ev.verdict : null,       // ready|borderline|not_ready
      verdict_band:           ev.seeded ? ev.verdict_band : null,  // all_goals_strong_gear|…|multi_goal_gap
      confidence_pct:         ev.seeded ? ev.confidence_pct : null,
      outcome,
      failure_reason:         null,                             // stays specific to player-submitted feedback
      stage_number_attempted: row.stage_number,
      source:                 'battle_log',
      created_at:             row.captured_at,
    });
    if (error) { console.error('  outcome insert error:', error.message); continue; }
    outcomes++;
  }
  // mark processed either way (cleared/failed written; Draw/Unknown intentionally skipped)
  await supabase.from('battle_history').update({ outcome_recorded: true }).eq('id', row.id);
}
console.log(`Phase 2 — recommendation_outcomes: ${outcomes} written (${processed} battle_history row(s) processed)`);
if (heldClanBoss) console.log(`         held ${heldClanBoss} Clan Boss battle(s) — difficulty unknown (not yet sourced)`);
console.log(`\nSUMMARY: ${battles.length} battles read → ${uploaded} uploaded → ${resolved} dungeon_stage resolved → ${outcomes} outcomes.`);
