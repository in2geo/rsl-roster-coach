// tools/shadow-contribution.mjs — SHADOW the contribution model on REAL per-stage enemy HP,
// graded against the reconciled capture corpus. Read-only; changes nothing player-facing.
//
// THE CLAIM TO TEST. `dungeon_stage_enemies` has carried real boss stats for all four dungeons,
// stages 1-25, since seeds 131-135 — but nothing on the live path read it, and the contribution
// model was handed a hardcoded 15,000,000 (larger than EVERY real dungeon boss, identical at every
// stage). That is why the confidence curve was flat where reality has a cliff. Wiring the real
// ladder in should make the model's kill estimate track reality. This measures whether it does.
//
// METHOD. For every reconciled run we can rebuild — the team that ACTUALLY FOUGHT, at the stage it
// fought — compute killTurns against effectiveHp = bossHp x the dungeon's wave/add multiplier, then
// ask two questions the corpus can answer:
//   (1) SEPARATION  — do losses need more kill-turns than wins? (the model must rank a lost stage
//                     as harder than a won one, or it cannot place a wall)
//   (2) DISCRIMINATION — does killTurns rise with stage on ONE account+dungeon? (a flat curve is
//                     the exact failure the 15M constant caused)
// Both are ORDINAL. Absolute magnitudes stay nominal (DAMAGE coefficients are uncalibrated), so a
// raw killTurns figure is not claimed to be real turns — only its ORDER across stages is tested.
//
// Kill side only: enemy ATK overstates real incoming at high stages (INS-0016), so survival is not
// modeled here and a loss that was a SURVIVAL wall is expected to look winnable. That is a known
// blind spot, reported rather than hidden.
//
// Run: node --env-file=.env.local tools/shadow-contribution.mjs [--csv]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster, STAGE_EHP_MULTIPLIER } from '../lib/match-engine.js';
import { computeContributions } from '../lib/contribution-model.js';
import { buildRosterIndex, loadNameResolverRest } from '../lib/champion-names.js';
import { maxHpCapFor } from '../lib/damage-mechanics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CSV  = process.argv.includes('--csv');

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const norm = s => String(s ?? '').trim().toLowerCase();
const med  = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

// ── catalog ──────────────────────────────────────────────────────────────────
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check)),champion_skills(slot,skill_name,skill_summary,maxhp_effect_kind,maxhp_pct,maxhp_pct_boss,maxhp_pct_cap)';
let db = [];
for (let f = 0; ; f += 1000) {
  const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`);
  if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
}
const aliasRows = await fetchAliasRows(rest);
// Alias-aware hero-name lookup. A local trim+lowercase (what this file used first) misses 10 of
// the 64 distinct captured hero names vs 2 for the resolver — silently dropping runs that field
// e.g. "Bambus Fourleaf", who is in Don$Bambus's core five in EVERY run. See champion-names.js.
const nameResolver = await loadNameResolverRest(rest);

// ── real per-stage enemy magnitude ───────────────────────────────────────────
const dungeons = await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends');
const dungeonById = Object.fromEntries(dungeons.map(d => [d.id, d.name]));
const enemies = await rest('dungeon_stage_enemies?select=dungeon_id,stage_number,enemy_role,hp,atk');
const bossAt = {};   // "Dungeon|stage" -> { hp, atk }
for (const e of enemies) {
  if (e.enemy_role !== 'boss') continue;
  bossAt[`${dungeonById[e.dungeon_id]}|${e.stage_number}`] = { hp: Number(e.hp), atk: Number(e.atk) };
}

// ── rosters per account ──────────────────────────────────────────────────────
const rosterByAccount = {};
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  if (!snap.accountId) continue;
  const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
  rosterByAccount[snap.accountId] = buildRosterIndex(mapRoster(userChampions, {}).mapped, nameResolver);
}

// ── reconciled runs ──────────────────────────────────────────────────────────
const runs = await rest('run_reconciliations?select=account_id,display_name,content,successful,duration_seconds,turns,team_fielded&order=battle_captured_at.desc&limit=1000');

const rows = [];
const skipped = { no_roster: 0, no_stage: 0, no_boss: 0, no_team: 0, no_outcome: 0 };
for (const r of runs) {
  if (r.successful !== true && r.successful !== false) { skipped.no_outcome++; continue; }
  const m = String(r.content ?? '').match(/^(.*?)\s+Stage\s+(\d+)/i);
  if (!m) { skipped.no_stage++; continue; }
  const [, dungeon, stageStr] = m; const stage = +stageStr;
  const boss = bossAt[`${dungeon}|${stage}`];
  if (!boss) { skipped.no_boss++; continue; }
  const roster = rosterByAccount[r.account_id];
  if (!roster) { skipped.no_roster++; continue; }

  let tf = r.team_fielded; if (typeof tf === 'string') { try { tf = JSON.parse(tf); } catch { tf = []; } }
  const team = (tf ?? []).map(h => roster.get(h.name)).filter(Boolean);
  if (team.length < 3) { skipped.no_team++; continue; }   // partial rebuild would understate output

  const mult = STAGE_EHP_MULTIPLIER[dungeon] ?? 2.0;
  const effectiveHp = boss.hp * mult;
  const contribTeam = team.map(c => ({
    name: c.name, tags: c.tags, has_boss_mastery: c.has_boss_mastery,
    atk: c.estimated_stats?.atk, spd: c.estimated_stats?.spd, hp: c.estimated_stats?.hp,
    crit_rate: c.estimated_stats?.crit_rate ?? c.estimated_stats?.crate,
    crit_dmg:  c.estimated_stats?.crit_dmg  ?? c.estimated_stats?.cdmg,
    damage_multiplier_score: c.damage_multiplier_score,
    maxhp_damage: c.maxhp_damage ?? null,
  }));
  // Same content cap the engine applies (damage-mechanics §6b): Normal 21-25 and Hard clamp
  // an active Enemy-MAX-HP skill to 10% of boss MAX HP per hit.
  const res = computeContributions(contribTeam, { bossHp: effectiveHp, incomingDamagePerTurn: null,
                                                 maxHpCap: maxHpCapFor({ stageNumber: stage }) });
  rows.push({
    account: r.display_name ?? r.account_id, accountId: r.account_id, dungeon, stage,
    won: r.successful, seconds: r.duration_seconds ?? null, turns: r.turns ?? null,
    bossHp: boss.hp, effectiveHp,
    killTurns: isFinite(res.killTurns) ? res.killTurns : Infinity,
    confidence: res.confidence, teamSize: team.length,
  });
}

if (CSV) {
  console.log('account,dungeon,stage,won,seconds,turns,boss_hp,effective_hp,kill_turns,confidence');
  for (const r of rows) console.log([r.account, r.dungeon, r.stage, r.won, r.seconds, r.turns,
    r.bossHp, Math.round(r.effectiveHp), Math.round(r.killTurns), r.confidence].join(','));
  process.exit(0);
}

console.log(`\nrebuilt ${rows.length} runs  (skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(', ')})`);

// ── (1) SEPARATION: do losses need more kill-turns than wins? ────────────────
console.log('\n══ (1) SEPARATION — median predicted killTurns, wins vs losses ══');
console.log('dungeon                 wins  med(kill)   losses  med(kill)   separates?');
const byDungeon = {};
for (const r of rows) (byDungeon[r.dungeon] ??= []).push(r);
for (const [d, rs] of Object.entries(byDungeon).sort()) {
  const w = rs.filter(r => r.won).map(r => r.killTurns).filter(isFinite);
  const l = rs.filter(r => !r.won).map(r => r.killTurns).filter(isFinite);
  const mw = med(w), ml = med(l);
  const verdict = (mw == null || ml == null) ? 'n/a (need both)' : (ml > mw ? `YES  ${(ml / mw).toFixed(2)}x` : 'NO — inverted');
  console.log(String(d).padEnd(22), String(w.length).padStart(4), String(mw == null ? '-' : Math.round(mw)).padStart(10),
              String(l.length).padStart(8), String(ml == null ? '-' : Math.round(ml)).padStart(10), '  ' + verdict);
}

// ── (2) DISCRIMINATION: does killTurns climb with stage on one account+dungeon? ──
console.log('\n══ (2) DISCRIMINATION — killTurns across stages, per account+dungeon ══');
console.log('(the 15M constant made this FLAT; real HP should make it climb)\n');
const byAcctDungeon = {};
for (const r of rows) (byAcctDungeon[`${r.account}|${r.dungeon}`] ??= []).push(r);
for (const [k, rs] of Object.entries(byAcctDungeon).sort()) {
  const byStage = {};
  for (const r of rs) (byStage[r.stage] ??= []).push(r.killTurns);
  const stages = Object.keys(byStage).map(Number).sort((a, b) => a - b);
  if (stages.length < 2) continue;
  const pts = stages.map(s => ({ s, kt: med(byStage[s].filter(isFinite)) })).filter(p => p.kt != null);
  if (pts.length < 2) continue;
  const span = pts[pts.length - 1].kt / (pts[0].kt || 1);
  console.log(`  ${k}`);
  console.log('     ' + pts.map(p => `st${p.s}:${Math.round(p.kt)}`).join('  ') + `   → ${span.toFixed(1)}x across the range`);
}

// ── the headline the old constant could not produce ─────────────────────────
const allW = rows.filter(r => r.won).map(r => r.killTurns).filter(isFinite);
const allL = rows.filter(r => !r.won).map(r => r.killTurns).filter(isFinite);
console.log('\n══ OVERALL ══');
console.log(`  wins   n=${allW.length}  median killTurns ${Math.round(med(allW))}`);
console.log(`  losses n=${allL.length}  median killTurns ${Math.round(med(allL))}`);
console.log('\nNOTE: kill side only. A loss that was a SURVIVAL wall (Ice Golem especially — INS-0016)');
console.log('is expected to look winnable here; enemy ATK is not yet modeled. Magnitudes nominal —');
console.log('only the ORDER across stages and the win/loss separation are being claimed.');
