// tools/pool-scan.mjs — PROTOTYPE: make the POOL model GENERATE the stage.
//
// The pool model (tools/pool-select.mjs) builds the best team + mechanical bucket coverage for a
// GIVEN stage but cannot pick one. This wraps it in a scan: for each stage it (a) gets the pool team
// and its tier bucket coverage, (b) compares the team's stats to THAT stage's floors, and (c) scores
// the stage as the WEAKEST LINK of the two — "stats pick the stage, buckets veto the tier".
//
// No hard lines (Mike): the highest stage at/above the recommend budget is the pick; higher stages
// ride along as `stretch`; stat shortfalls AND mechanical bucket gaps surface as notes.
//
// Run: node --env-file=.env.local tools/pool-scan.mjs <content> <accountId>
//   content: dragon | ice_golem | spider    (fire_knight/cb are strategy-based too; start with these)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapRoster, usabilityTier } from '../lib/match-engine.js';
import { buildUserChampions } from '../lib/gestal-context.js';
import { poolSelect, devScore } from './pool-select.mjs';
import { spiderStrategiesForStage } from '../lib/spider-rubric.js';
import { DRAGON_ALLOCATION, DRAGON_BUCKETS, DEAD_ON_DRAGON } from '../lib/dragon-rubric.js';
import { IG_STRATEGIES } from '../lib/ice-golem-rubric.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = (process.argv[2] || 'spider').toLowerCase();
const ACCOUNT = process.argv[3] || null;
const BUDGET = 55, STRETCH_MIN = 30;

const DUNGEON = { dragon: "Dragon's Lair", ice_golem: "Ice Golem's Peak", spider: "Spider's Den" }[CONTENT];
if (!DUNGEON) { console.error('content must be dragon | ice_golem | spider'); process.exit(1); }

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// ── setup (mirrors pool-select.mjs) ──
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check)),champion_auras(aura_type,aura_value,aura_area,aura_restriction,aura_summary)';
let db = []; for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let sk = []; for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; sk = sk.concat(d); if (d.length < 1000) break; }
const skillsByName = {}; for (const r of sk) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }
const aurasByChampId = Object.fromEntries(db.map(c => [c.id, c.champion_auras ?? []]));
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));
let aliasRows = []; for (let f = 0; ; f += 1000) { const d = await rest(`champion_aliases?select=alias,champion_id&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; aliasRows = aliasRows.concat(d); if (d.length < 1000) break; }

// ── per-stage stat floors for this dungeon (soft) ──
const dRow = (await rest(`dungeons?select=id&name=eq.${encodeURIComponent(DUNGEON)}`))[0];
const stageRows = await rest(`dungeon_stages?select=id,label,stage_number&dungeon_id=eq.${dRow.id}`);
const phaseRows = await rest('phases?select=id,dungeon_stage_id&limit=5000');
const checkRows = await rest('stat_threshold_checks?select=phase_id,stat,formula&limit=5000');
const affRows = await rest(`dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.${dRow.id}`);
const affByStage = Object.fromEntries(affRows.map(a => [a.stage_number, a.affinity]));
const stageIdByPhase = Object.fromEntries(phaseRows.map(p => [p.id, p.dungeon_stage_id]));
const stageById = Object.fromEntries(stageRows.map(s => [s.id, s]));
const evalFloor = (formula, stage) => { const n = Number(formula); if (Number.isFinite(n)) return n; const m = String(formula).match(/stage\s*\*\s*(\d+)/i); return m ? stage * Number(m[1]) : null; };
// stage -> [{stat, floor}]  (Spider floors sit on banded label rows, so match by the row's stage range)
const bandMatch = (label, stage) => { const m = String(label).match(/(\d+)\s*-\s*(\d+)/); return m && stage >= +m[1] && stage <= +m[2]; };
function floorsForStage(stage) {
  const out = [];
  for (const c of checkRows) {
    const st = stageById[stageIdByPhase[c.phase_id]]; if (!st) continue;
    const applies = st.stage_number === stage || (st.stage_number == null && bandMatch(st.label, stage));
    if (!applies) continue;
    const v = evalFloor(c.formula, stage); if (v != null) out.push({ stat: c.stat, floor: v });
  }
  return out;
}

// cfg per content/stage
const IG_STRATS = IG_STRATEGIES;
function cfgsForStage(stage, aff) {
  const withAff = c => ({ ...c, bossAffinity: aff });
  if (CONTENT === 'dragon') return [withAff({ allocation: DRAGON_ALLOCATION, buckets: DRAGON_BUCKETS, dead: DEAD_ON_DRAGON, accFloor: 130 })];
  if (CONTENT === 'ice_golem') return IG_STRATS.map(withAff);
  return spiderStrategiesForStage(stage).map(withAff);   // spider: tier-gated strategies
}
const leaderCtxFor = cfg => ({ aurasByChampId, contentArea: 'dungeon', thresholdStats: cfg?.accFloor ? ['acc'] : [], accFloor: cfg?.accFloor ?? 0 });
const soft = rel => 0.20 + 0.80 * Math.max(0, Math.min(1, rel));   // same shape as match-engine

// ── the scan, per account ──
const snaps = fs.readdirSync(path.join(REPO, 'gestal-sync/output'))
  .filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))
  .map(f => JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8')))
  .filter(s => !ACCOUNT || s.accountId === ACCOUNT);

for (const snap of snaps) {
  const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
  const mapped = mapRoster(userChampions, {}).mapped;
  const pool = mapped.filter(c => usabilityTier(c) >= 2);
  if (pool.length < 5) { console.log(`\n== ${snap.displayName}: pool < 5, skip`); continue; }

  const perStage = [];
  for (let stage = 1; stage <= 25; stage++) {
    const cfgs = cfgsForStage(stage, affByStage[stage]);
    if (!cfgs.length) continue;
    // pool team per viable strategy; take the best grade (dev-tiebreak within 5, like pool-select)
    const runs = cfgs.map(cfg => ({ cfg, sel: poolSelect(pool, tagMeta, skillsByName, { cfg, leaderCtx: leaderCtxFor(cfg) }) }))
                     .sort((a, b) => b.sel.grade - a.sel.grade);
    const top = runs[0].sel.grade;
    const teamDev = t => t.reduce((a, c) => a + devScore(c), 0) / (t.length || 1);
    const pick = runs.filter(r => r.sel.grade >= top - 5).sort((a, b) => teamDev(b.sel.team) - teamDev(a.sel.team))[0];
    const { team, rows, unfillable, grade } = pick.sel;
    const cfg = pick.cfg;

    // (b) capability VETO = the pool model's real gaps (buckets no developed champ can fill), NOT
    // every low bucket. A minor bucket at 0% (e.g. boss_damage on the AoE-nuke tier) is priced into
    // the weighted grade and must not zero the stage; an UNFILLABLE bucket (tm_lock 22%, "no champion
    // can fill it") is the genuine mechanical gate.
    const gaps = (unfillable ?? []).map(u => ({ bucket: u.bucket, rel: Math.min(1, u.pct) })).sort((a, b) => a.rel - b.rel);
    const bucketRel = gaps.length ? gaps[0].rel : 1;
    const bkt = gaps;

    // (c) stat floors at THIS stage vs the pool team's estimated stats
    const isCarrier = c => (c.tags ?? []).some(t => tagMeta[t]?.is_debuff && !tagMeta[t]?.bypasses_accuracy_check);
    const carriers = team.filter(isCarrier);
    const teamMin = k => Math.min(...team.map(c => c.estimated_stats?.[k] ?? 0));
    const bestCarrierAcc = carriers.length ? Math.max(...carriers.map(c => c.estimated_stats?.acc ?? 0)) : 0;
    const floors = floorsForStage(stage);
    // BLEND, not weakest-link (no veto): each floor's reliability feeds a reliability-weighted factor,
    // same as match-engine. worst dominates, doesn't cap; statLimit is kept only to NAME the binder.
    const relRows = [];
    for (const f of floors) {
      if (f.stat === 'acc' && carriers.length === 0) continue;   // pure-nuke team → ACC irrelevant
      const have = f.stat === 'acc' ? bestCarrierAcc : teamMin(f.stat);
      relRows.push({ stat: f.stat, have: Math.round(have), floor: f.floor, rel: f.floor > 0 ? Math.min(1, have / f.floor) : 1 });
    }
    // WEAKEST LINK across survival floors (survival = you die from your lowest one, not a veto — see
    // match-engine). Cross-axis (stats vs the pool grade) stays a PRODUCT below, which is the blend.
    const worst = relRows.slice().sort((a, b) => a.rel - b.rel)[0];
    const statRel = worst ? worst.rel : 1;
    const statLimit = worst ? { stat: worst.stat, have: worst.have, floor: worst.floor } : null;

    // Capability = the pool GRADE (weighted coverage), robust to a single tag-gap bucket reading 0%.
    // Difficulty RAMP comes from the stat floors (they scale with stage; the grade is ~tier-constant).
    const capRel = Math.max(0.20, Math.min(1, grade / 100));
    const conf = Math.round(100 * soft(statRel) * capRel);
    perStage.push({ stage, conf, team, grade, strat: cfg.name ?? cfg.key ?? 'default', bucketLimit: bkt[0], statLimit, bucketRel, statRel, capRel });
  }

  // pick highest stage >= budget; stretch = higher stages >= STRETCH_MIN; else best
  const meeting = perStage.filter(s => s.conf >= BUDGET);
  const rec = meeting.length ? meeting[meeting.length - 1] : [...perStage].sort((a, b) => b.conf - a.conf)[0];
  const stretch = perStage.filter(s => s.stage > (rec?.stage ?? 0) && s.conf >= STRETCH_MIN).slice(0, 4);

  console.log(`\n══ ${snap.displayName} — ${DUNGEON} ══`);
  if (!rec) { console.log('   no viable stage'); continue; }
  console.log(`   GENERATED STAGE: ${rec.stage}  @ ${rec.conf}%   [${rec.strat}]`);
  console.log(`   TEAM: ${rec.team.map(c => c.name).join(', ')}`);
  const binder = rec.statRel <= rec.bucketRel
    ? `stat: ${rec.statLimit ? `${rec.statLimit.stat.toUpperCase()} ${rec.statLimit.have} vs floor ${rec.statLimit.floor}` : 'ok'}`
    : `mechanic: ${rec.bucketLimit ? `${rec.bucketLimit.bucket} ${(rec.bucketLimit.rel * 100).toFixed(0)}%` : 'ok'}`;
  console.log(`   binding constraint: ${binder}`);
  console.log(`   stretch: ${stretch.map(s => `${s.stage}:${s.conf}%`).join('  ') || '(none)'}`);
  // per-stage confidence curve (compact)
  console.log('   curve: ' + perStage.map(s => `${s.stage}:${s.conf}`).join(' '));
}
