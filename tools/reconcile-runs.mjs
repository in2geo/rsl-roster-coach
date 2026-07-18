// ── tools/reconcile-runs.mjs ─────────────────────────────────────────────────
// Populates run_reconciliations sections ①–④ for every captured battle: re-runs
// the engine against the account's roster (PREDICTION), reads the capture
// (REALITY), and computes the derived classification. Section ⑤ (analysis) is
// left for the gap-review LLM + human — UPSERT preserves it on re-run.
//
// Read side: battle-log.json (has duration now) + Gestal snapshots. Skips content
// the engine can't scan (Event/Arena/Minotaur) and Clan Boss (chest-tier scored,
// not floor — separate follow-up).
//
// Usage:
//   node tools/reconcile-runs.mjs         — incremental: only re-predict NEW captures (fast)
//   node tools/reconcile-runs.mjs --all   — reprocess every battle (after an engine/data change)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.SUPABASE_URL = env.SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
process.env.SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_KEY;
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const KEY = env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const gc = await import('../lib/gestal-context.js');
const me = await import('../lib/match-engine.js');
const cb = await import('../lib/clan-boss.js'); // Clan Boss chest-tier reconciliation (isClanBoss/classifyClanBoss/clanBossVerdict)

const CONTENT_KEY = {
  "Ice Golem's Peak": 'ice_golem',
  "Fire Knight's Castle": 'fire_knight',
  "Spider's Den": 'spider',
  "Dragon's Lair": 'dragon',
};
const norm = (s) => String(s ?? '').trim().toLowerCase();
const BUDGET_SEC = 300; // ~5-min auto budget
// Incremental by default: only re-predict battles not already reconciled. Pass --all to
// reprocess every battle (do this after an engine/data change so old predictions refresh).
const FORCE_ALL = process.argv.includes('--all');
const keyOf = (accId, capturedAt) => capturedAt ? `${accId}|${new Date(capturedAt).getTime()}` : null;

// ── fetch the full champion catalog once (tags + base stats) ─────────────────
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,ascension_required,tags(name,is_debuff,bypasses_accuracy_check))';
let dbChampions = [];
for (let from = 0; ; from += 1000) {
  const d = await (await fetch(`${BASE}/rest/v1/champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${from}`, { headers: H })).json();
  if (!Array.isArray(d) || !d.length) break; dbChampions = dbChampions.concat(d); if (d.length < 1000) break;
}
// Leader auras — to apply the FIELDED leader's aura to the frozen effective stats. A leader aura
// (esp. flat ACC → debuff land-rate, INS-0019) materially changes team stats; frozen was aura-blind.
const auraRows = await (await fetch(`${BASE}/rest/v1/champion_auras?select=champion_id,aura_type,aura_value,aura_area,aura_restriction`, { headers: H })).json();
const auraById = {};
for (const a of (Array.isArray(auraRows) ? auraRows : [])) auraById[a.champion_id] ??= a; // one aura/champ
const idByName = Object.fromEntries(dbChampions.map(c => [norm(c.name), c.id]));
const cleanArea = (s) => String(s ?? '').toLowerCase().replace(/^in\s+/, '').trim();

// Clan Boss chest tiers grouped by difficulty — the chest-tier axis CB is graded on (clanBossVerdict).
const cbTierRows = await (await fetch(`${BASE}/rest/v1/clan_boss_chest_tiers?select=chest_name,sort_order,damage_min,damage_max,dungeon_stages(label)`, { headers: H })).json();
const cbTiersByDifficulty = {};
for (const t of (Array.isArray(cbTierRows) ? cbTierRows : [])) { const d = t.dungeon_stages?.label; if (d) (cbTiersByDifficulty[d] ??= []).push(t); }
const chestOrdinal = (tiers, chest) => chest ? (Number((tiers.find(t => String(t.chest_name).toLowerCase() === chest) || {}).sort_order) || null) : 0;

// ── per-account rosters (Gestal) + userChampions cache ───────────────────────
const OUT_DIR = path.join(REPO, 'gestal-sync', 'output');
const rosters = {};
for (const f of fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus'))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')); } catch { continue; }
  if (j.accountId) rosters[j.accountId] = j;
}
const ucCache = {};
function userChampionsFor(accountId) {
  if (ucCache[accountId]) return ucCache[accountId];
  const j = rosters[accountId]; if (!j) return null;
  const { userChampions } = gc.buildUserChampions(j.champions, dbChampions);
  return (ucCache[accountId] = { uc: userChampions, snap: j });
}

function accountMaturity(j) {
  const c = j.champions ?? [];
  return { level: j.accountLevel ?? null, champions: c.length,
    lvl60: c.filter(x => x.level === 60).length, ascensions: c.filter(x => (x.ascensionLevel ?? 0) > 0).length };
}
function specMarginOf(res) {
  const rs = (res.threshold_results ?? []).filter(t => t.estimated_value != null && t.threshold_value);
  if (!rs.length) return null;
  return Math.min(...rs.map(t => t.estimated_value / t.threshold_value));
}
function limitingFactor(res) {
  const rs = (res.threshold_results ?? []).filter(t => t.estimated_value != null && t.threshold_value);
  if (!rs.length) return (res.gaps ?? []).length ? `goal gap: ${res.gaps[0].description ?? res.gaps[0]}` : null;
  const b = rs.sort((a, c) => (a.estimated_value / a.threshold_value) - (c.estimated_value / c.threshold_value))[0];
  return `${b.stat} floor ${b.threshold_value} (est ${b.estimated_value})`;
}
// TIME decides grind vs real — floors are not gates ([[floors-are-not-gates]]), so a
// below-floor win is a grind if slow, a real clear if fast. NOTE: spec_margin here is at the
// RECOMMENDED stage (inflated — the actual-stage margin needs an engine hook; TODO), so it
// only ELEVATES a confirmed-fast (real-duration) win to 'overpower'; it never overrides time.
function classify(won, actual, rec, dur, turns, margin) {
  if (!won) return 'loss';
  if (actual == null || rec == null || actual <= rec) return 'on_spec';
  const slow = dur > 0 ? dur > BUDGET_SEC : (turns != null ? turns > 60 : false);
  if (slow) return 'grind_above_rec';                                  // slow win above rec = grind
  if (dur > 0 && dur <= BUDGET_SEC && margin != null && margin > 1.5) return 'overpower';
  return 'under_recommended';                                          // fast clear above rec = model too conservative
}

// ── reconcile every battle ───────────────────────────────────────────────────
const client = new pg.Client({ connectionString: env.SUPABASE_POOLER_URL });
await client.connect();
const log = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json'), 'utf8'));
// Load already-reconciled keys so a routine run skips them (no engine re-run).
const doneKeys = new Set();
if (!FORCE_ALL) {
  const { rows } = await client.query('select account_id, battle_captured_at from run_reconciliations');
  for (const r of rows) { const k = keyOf(r.account_id, r.battle_captured_at); if (k) doneKeys.add(k); }
}
let wrote = 0, skipped = 0, skippedDone = 0, skippedIncompleteCb = 0, skippedNoDamageCb = 0;
async function upsert(row) {
  const cols = Object.keys(row);
  const vals = cols.map(k => (row[k] !== null && typeof row[k] === 'object') ? JSON.stringify(row[k]) : row[k]);
  const ph = cols.map((_, i) => `$${i + 1}`).join(',');
  const upd = cols.filter(k => k !== 'account_id' && k !== 'battle_captured_at').map(k => `${k}=excluded.${k}`).join(',');
  await client.query(`insert into run_reconciliations (${cols.join(',')}) values (${ph}) on conflict (account_id, battle_captured_at) do update set ${upd}`, vals);
}
for (const b of (Array.isArray(log) ? log : [])) {
  // ── Clan Boss: chest-tier reconciliation (its own axis — damage → chest, not stage floor) ──
  if (cb.isClanBoss(b)) {
    const cls = cb.classifyClanBoss(b);
    if (!cls?.difficulty) { skipped++; continue; }          // stageId → difficulty unmapped; can't grade
    const k = keyOf(b.accountId, b.capturedAt);
    if (k && doneKeys.has(k)) { skippedDone++; continue; }
    const heroes = b.heroes ?? [];
    if (heroes.length < 5) { skippedIncompleteCb++; continue; } // a dropped hero → false-low total; don't grade
    const total = b.totalDamageDealt ?? (heroes.reduce((s, h) => s + (Number(h.damage) || 0), 0) || null);
    // QUICK BATTLES ARE NOT GRADEABLE — and must be counted, not silently dropped (Mike 2026-07-18).
    // CB per-hero damage is read from the live RESULT DIALOG's view-model; a quick battle never opens
    // that dialog, so damage comes back null. The chest verdict IS damage, so there is nothing to
    // grade. Previously this fell through to the generic `skipped` bucket labelled "unseeded/event/
    // unscannable/unmapped-CB", which made four Don$Gnut Brutal runs disappear without a trace and
    // sent us hunting a difficulty-specific reader bug that did not exist. Counted separately now so
    // "no damage captured" is visible in the summary instead of being indistinguishable from
    // unrelated skips. NOTE: this cannot yet tell a quick battle from a FAILED dialog read — both
    // surface as null. Recording that difference needs a reader-side flag (dialog_read vs
    // dialog_absent); until then this bucket means "no damage available", not "was a quick battle".
    if (total == null) { skippedNoDamageCb++; continue; }
    const tiers = cbTiersByDifficulty[cls.difficulty];
    const verdict = tiers ? cb.clanBossVerdict(tiers, total) : null;
    if (!verdict) { skipped++; continue; }                  // no tiers seeded for the difficulty
    await upsert({
      account_id: b.accountId, display_name: b.displayName, content: `Clan Boss ${cls.difficulty}`,
      auto_battle: b.manualSkillUsed === false,
      account_maturity: rosters[b.accountId] ? accountMaturity(rosters[b.accountId]) : null,
      battle_captured_at: b.capturedAt ?? null,
      // PREDICTION: the CB damage model is calibration-blocked, so no predicted chest yet (honest null).
      recommended_team: null, leader_name: null, leader_skill: null, recommended_floor: null,
      predicted_confidence_pct: null, verdict_band: null, predicted_chest: null,
      predicted_limiting_factor: verdict.earned_top ? null : `short of top ${verdict.top_chest} by ${(verdict.shortfall / 1e6).toFixed(2)}M`,
      gear_context: null,
      // REALITY (reliable — no calibration needed): chest earned from captured damage.
      successful: verdict.earned_top, actual_floor: chestOrdinal(tiers, verdict.earned_chest),
      earned_chest: verdict.earned_chest, floor_vs_recommended: null,
      duration_seconds: b.durationSeconds || null, turns: b.turns ?? null, battle_speed: b.battleSpeed ?? null,
      team_fielded: heroes.map(h => ({ name: h.name, survived: h.survived ?? null, damage: h.damage ?? null, is_leader: h.isLeader ?? null })),
      gestal_snapshot_ref: { account_id: b.accountId }, frozen_effective_stats: null,
      team_match: null, off_spec: null, spec_margin: verdict.margin,
      classification: verdict.earned_top ? 'cb_one_key' : 'cb_below_top', assumptions: null,
    });
    wrote++; continue;
  }
  const contentKey = CONTENT_KEY[b.dungeon];
  if (!contentKey) { skipped++; continue; }               // unseeded / event
  const k = keyOf(b.accountId, b.capturedAt);
  if (k && doneKeys.has(k)) { skippedDone++; continue; }  // already reconciled — skip the engine re-run
  const acc = userChampionsFor(b.accountId);
  if (!acc) { skipped++; continue; }
  let res;
  try { res = await me.matchRoster(acc.uc, contentKey, { account_development: 'fair' }); }
  catch { skipped++; continue; }                          // content not scannable (e.g. dragon key)

  const recFloor = res.stage_number_attempted ?? null;
  const actual = b.stageNumber ?? null;
  const won = b.result === 'Victory';
  const dur = b.durationSeconds ?? 0, turns = b.turns ?? null;
  const margin = specMarginOf(res);
  const recNames = new Set((res.team ?? []).map(c => norm(c.name)));
  // is_leader is kept per-hero inside the team_fielded jsonb (no schema change) — the FIELDED
  // leader (whose aura was actually active) is team_fielded.find(is_leader), which may differ from
  // the engine's recommended leader (leader_name). Calibration should apply THIS leader's aura.
  const fielded = (b.heroes ?? []).map(h => ({ name: h.name, survived: h.survived ?? null, damage: h.damage ?? null, is_leader: h.isLeader ?? null }));
  const teamMatch = fielded.filter(h => recNames.has(norm(h.name))).length;
  const floorVs = (actual == null || recFloor == null) ? null : actual > recFloor ? 'higher' : actual < recFloor ? 'lower' : 'same';
  // Apply the FIELDED leader's aura to the team before freezing (was aura-blind). The fielded
  // leader can differ from res.leader (the recommended one) — e.g. a player-chosen SPD vs ACC lead.
  const fieldedLeaderName = fielded.find(h => h.is_leader)?.name;
  const flAura = fieldedLeaderName ? auraById[idByName[norm(fieldedLeaderName)]] : null;
  let teamForFreeze = res.team ?? [];
  if (flAura && me.LEADER_AREA_APPLIES.dungeon(cleanArea(flAura.aura_area))) {
    teamForFreeze = me.applyLeaderAura(teamForFreeze, { aura_type: flAura.aura_type, aura_value: flAura.aura_value, restriction: flAura.aura_restriction });
  }
  const frozen = teamForFreeze.map(c => ({ name: c.name, gear_tier: c.gear_tier, effective_stats: c.estimated_stats }));

  const row = {
    account_id: b.accountId, display_name: b.displayName, content: b.stage ?? b.dungeon,
    auto_battle: b.manualSkillUsed === false, account_maturity: accountMaturity(acc.snap),
    battle_captured_at: b.capturedAt ?? null,
    recommended_team: (res.team ?? []).map(c => ({ name: c.name, gear_tier: c.gear_tier })),
    leader_name: res.leader?.name ?? null, leader_skill: res.leader?.aura?.description ?? res.leader?.aura?.text ?? null,
    recommended_floor: recFloor, predicted_confidence_pct: res.confidence_pct ?? null, verdict_band: res.verdict_band ?? null,
    predicted_limiting_factor: limitingFactor(res),
    gear_context: { account_gear: 'fair', great_hall: 'fair' },
    successful: won, actual_floor: actual, floor_vs_recommended: floorVs,
    duration_seconds: dur || null, turns, battle_speed: b.battleSpeed ?? null,
    team_fielded: fielded, gestal_snapshot_ref: { account_id: b.accountId, last_snapshot_at: acc.snap.lastSnapshotAt },
    frozen_effective_stats: frozen,
    team_match: teamMatch, off_spec: teamMatch < 3, spec_margin: margin,
    classification: classify(won, actual, recFloor, dur, turns, margin),
    assumptions: null,
  };

  await upsert(row);
  wrote++;
}
await client.end();
console.log(`reconciled ${wrote} battles${FORCE_ALL ? ' (--all: full reprocess)' : ` (incremental — ${skippedDone} already-done skipped; use --all to reprocess)`}, skipped ${skipped} (unseeded/event/unscannable/unmapped-CB), skipped ${skippedIncompleteCb} incomplete CB captures (<5 heroes — dropped-hero reads), skipped ${skippedNoDamageCb} CB captures with NO DAMAGE (quick battles / no result dialog — not gradeable)`);
