#!/usr/bin/env node
// tools/predict-from-tier.mjs — WHAT DOES THE APP PREDICT FROM ONLY WHAT A PLAYER TELLS US?
//
// The end-to-end test of the whole pipeline as a real (manual-entry) user experiences it:
//   inputs  = champion identities + level/stars + ONE gear tier + account-development setting
//   NO real gear is used. Base stats + the fitted per-type GEAR_TIERS_BY_TYPE do all the work.
// Then compare the predicted stage against what the account has DEMONSTRABLY cleared.
//
// This deliberately bypasses the Gestal shortcut: mapRoster prefers real effective_stats when a
// synced roster has them and never calls the estimator, so a straight matchRoster on a Gestal
// account would test the wrong path. Passing base-stat-only roster rows forces the estimator.
//
// Usage: node --env-file=.env.local tools/predict-from-tier.mjs [account] [content] [tier] [accountDev]
//   e.g. node --env-file=.env.local tools/predict-from-tier.mjs DonThor dragon good poor
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { matchRoster } from '../lib/match-engine.js';
import { estimateStats, championGearType } from '../lib/estimate-stats.js';

const ACCT = process.argv[2] || 'DonThor';
const CONTENT = process.argv[3] || 'dragon';
const TIER = process.argv[4] || 'good';
const DEV = process.argv[5] || 'poor';     // Great Hall + Arena bundle, LOWEST setting

const supabase = createClient((process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const { data: champs } = await supabase.from('champions')
  .select('id,name,type_id,rarity,role,faction,affinity,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check))')
  .eq('game_id', 'raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) { if (c.type_id != null) byType[c.type_id] = c; byName[norm(c.name)] = c; }
/* ALIASES ARE REQUIRED. Gestal's display name often differs from champions.name — "Thor Faehammer"
 * vs "Thor" — and without resolving it the champion is silently DROPPED from the team, which then
 * fails coverage goals for a reason that has nothing to do with the player's gear. This is the same
 * bug that hid DonThor's best champion from all 13 shadow tools (HANDOFF 2026-07-20 §1.3). */
const { data: aliasRows } = await supabase.from('champion_aliases').select('alias,champion_id');
const byId = Object.fromEntries(champs.map(c => [c.id, c]));
for (const a of aliasRows ?? []) if (byId[a.champion_id]) byName[norm(a.alias)] ??= byId[a.champion_id];

const file = fs.readdirSync('gestal-sync/output').find(f => norm(f).includes(norm(ACCT)));
const snap = JSON.parse(fs.readFileSync(`gestal-sync/output/${file}`, 'utf8'));

// the team actually being run on this content = most recent 5-hero victory
const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
const battles = (Array.isArray(log) ? log : (log.battles ?? log.entries ?? []))
  .filter(b => b.displayName === snap.displayName && b.result === 'Victory' && (b.heroes ?? []).length === 5
    && String(b.dungeon ?? '').toLowerCase().includes(CONTENT.split('_')[0]));
const stageNum = b => { const n = b.stageNumber ?? Number(String(b.stage ?? '').match(/Stage (\d+)/)?.[1]); return Number.isFinite(n) ? n : null; };
const cleared = battles.length ? Math.max(...battles.map(stageNum).filter(Number.isFinite)) : null;
const team = battles.sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))[0]?.heroes.map(h => h.name) ?? [];

const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3 };
const roster = [];
for (const nm of team) {
  const uc = (snap.champions ?? []).find(c => norm(c.name) === norm(nm));
  const champ = uc ? (byType[uc.baseTypeId] ?? byName[norm(uc.name)]) : byName[norm(nm)];
  if (!champ || !uc || !RANK[uc.rarity]) { console.log(`  (skipped ${nm})`); continue; }
  roster.push({ id: `${uc.heroId}`, level: uc.level, stars: uc.stars,
    ascension_level: uc.ascensionLevel ?? (uc.stars ? uc.stars - 1 : 0),
    gear_tier: TIER, mastery_tier: 'None', is_booked: uc.rarity === 'Rare',
    awakening_level: uc.awakenLevel ?? 0, champion: champ });
}

console.log(`\n══ ${snap.displayName} · ${CONTENT} · tier="${TIER}" · accountDev="${DEV}" ══`);
console.log(`team (${roster.length}): ${roster.map(r => r.champion.name).join(', ')}\n`);
console.log('  champion                  type      ESTIMATED  from base stats only');
console.log('                                        SPD  ACC  RES  CRIT     HP');
for (const r of roster) {
  const e = estimateStats(r.champion, r, { gearTier: TIER, accountDev: DEV });
  console.log(`  ${r.champion.name.padEnd(25)} ${String(championGearType(r.champion) ?? 'generic').padEnd(9)}`
    + `${String(Math.round(e.spd)).padStart(5)}${String(Math.round(e.acc)).padStart(5)}${String(Math.round(e.res)).padStart(5)}`
    + `${String(Math.round(e.crit_rate)).padStart(6)}${String(Math.round(e.hp)).padStart(8)}`);
}

const r = await matchRoster(roster, CONTENT, { gearTier: TIER, accountDev: DEV });
const predicted = r.stage_number_attempted ?? null;
console.log(`\n  ── PREDICTION ──`);
console.log(`  predicted stage : ${predicted ?? '—'}   (confidence ${r.confidence_pct ?? '?'}, band ${r.verdict_band ?? '?'})`);
console.log(`  ACTUALLY cleared: ${cleared ?? '—'}`);
if (predicted != null && cleared != null)
  console.log(`  Δ = ${cleared - predicted > 0 ? '+' : ''}${cleared - predicted}  ${cleared > predicted ? '(UNDER-recommends)' : cleared < predicted ? '(OVER-recommends)' : '(exact)'}`);
const worst = (r.threshold_results ?? []).map(t => ({ ...t, rel: t.acc_reliability ?? t.reliability }))
  .filter(t => typeof t.rel === 'number').sort((a, b) => a.rel - b.rel)[0];
if (worst) console.log(`  binding at the chosen stage: ${worst.stat?.toUpperCase()} ${worst.estimated_value ?? '?'}/${worst.threshold_value ?? '?'} = ${Math.round(worst.rel * 100)}%`);
if ((r.gaps ?? []).length) console.log(`  gaps: ${r.gaps.slice(0, 2).join(' | ')}`);
