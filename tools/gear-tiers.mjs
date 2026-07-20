#!/usr/bin/env node
// tools/gear-tiers.mjs — DEFINE GEAR TIERS AS A PRIORITY LADDER, measured from real clears.
//
// THE PRINCIPLE (Mike, 2026-07-20, worked through on Fahrakin): you build SPEED, then ACCURACY,
// then CRIT — because you fund PRECONDITIONS before MULTIPLIERS, ordered by how much each gates:
//   SPD  gates whether the turn happens in a useful order  -> gates everything downstream
//   ACC  gates whether the effect lands at all             -> gates that skill's whole contribution
//   CRIT only scales something that already landed         -> gates nothing
// So a gear TIER is not one number. It is HOW FAR DOWN THAT CHAIN THE ACCOUNT CAN AFFORD TO FUND.
//   can't hit speed                      -> starter
//   speed funded, accuracy short         -> fair
//   speed + accuracy funded, crit partial-> good
//   all three funded                     -> endgame
//
// ANCHORED TO PROGRESSION, NOT PERCENTILES (Mike's §3.6 ruling): "'good' = clears dungeon 20".
// Percentiles were rejected because they define "good" as whatever the synced rosters happen to
// hold. So each band below is derived from teams that DEMONSTRABLY CLEARED that stage range.
//
// EACH STAT IS MEASURED ON THE CHAMPIONS IT APPLIES TO, never team-wide:
//   SPD   — everyone (the one genuinely universal stat; measured at 152-195 across every role)
//   ACC   — ONLY champions carrying an ACC-gated debuff. A healer at ACC 17 is correctly built,
//           not under-built, and must not drag the requirement down (§3.6: "'is a debuffer' as a
//           champion-level boolean is USELESS — 80 of 96 carry some debuff tag").
//   CRIT  — ONLY champions whose damage is ATK-multiplier based. Crit is a dead stat on a %maxHP
//           DoT carrier (damage-mechanics.js §1: poison/HP-burn cannot crit).
//
// Usage: node tools/gear-tiers.mjs
import fs from 'fs';
import { effectiveStats } from '../lib/effective-stats.js';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async p => { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { headers: H }); return r.ok ? r.json() : []; };

const champs = await rest('champions?select=id,name,role,champion_tags(status,tags(name,is_debuff,bypasses_accuracy_check))&game_id=eq.raid_shadow_legends&limit=2000');
const aliases = await rest('champion_aliases?select=alias,champion_id&limit=2000');
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const idToName = Object.fromEntries(champs.map(c => [c.id, c.name]));
const nameKey = {};
for (const c of champs) nameKey[norm(c.name)] = c.name;
for (const a of aliases) if (idToName[a.champion_id]) nameKey[norm(a.alias)] = idToName[a.champion_id];

// DoT sources cannot crit; ATK-multiplier tags can. A champion needs CRIT only if some of their
// damage is attack-based — so "crit applies" = has an attack-damage tag.
const DOT = new Set(['Poison', 'HP Burn', 'Necrosis', 'Enemy Max HP Damage']);
const ATK = new Set(['AoE Damage', 'Single Target Damage', 'Multi-Hit A1']);
const needsAcc = {}, critApplies = {};
for (const c of champs) {
  const t = (c.champion_tags ?? []).filter(x => x.status === 'approved');
  needsAcc[norm(c.name)] = t.some(x => x.tags?.is_debuff && !x.tags?.bypasses_accuracy_check);
  critApplies[norm(c.name)] = t.some(x => ATK.has(x.tags?.name));
}

const statsByAcct = {};
for (const f of fs.readdirSync('gestal-sync/output').filter(x => x.endsWith('.json') && !/gear-corpus/.test(x))) {
  const s = JSON.parse(fs.readFileSync(`gestal-sync/output/${f}`, 'utf8'));
  const m = {};
  for (const c of s.champions ?? []) { const r = effectiveStats(c); if (r?.effective) m[norm(c.name)] = r.effective; }
  statsByAcct[s.displayName] = m;
}

const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
const battles = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const stageNum = b => { const n = b.stageNumber ?? Number(String(b.stage ?? '').match(/Stage (\d+)/)?.[1]); return Number.isFinite(n) ? n : null; };

const BANDS = [
  { label: '1-9   (early)',   lo: 1,  hi: 9 },
  { label: '10-14 (fair)',    lo: 10, hi: 14 },
  { label: '15-19 (good)',    lo: 15, hi: 19 },
  { label: '20-25 (endgame)', lo: 20, hi: 25 },
];
const med = a => a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : null;
const p25 = a => a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * 0.25)] : null;

console.log('\n══ GEAR TIERS AS A PRIORITY LADDER — measured from teams that actually cleared ══');
console.log('   SPD  = every champion         ACC = only ACC-gated debuffers      CRIT = only attack-damage champions\n');
console.log('   band                 clears  champs |    SPD          ACC          CRIT     ');
console.log('                                       |  p25  median  p25  median  p25  median');
for (const band of BANDS) {
  const seen = new Set();
  const spd = [], acc = [], crit = [];
  let clears = 0;
  for (const b of battles) {
    const st = stageNum(b);
    if (b.result !== 'Victory' || st == null || st < band.lo || st > band.hi) continue;
    if (/retreat/i.test(b.finishCause ?? '') || (b.heroes ?? []).length !== 5) continue;
    const acctStats = statsByAcct[b.displayName]; if (!acctStats) continue;
    clears++;
    for (const h of b.heroes) {
      const canon = nameKey[norm(h.name)] ?? h.name;
      const key = `${b.displayName}|${canon}|${band.label}`;
      if (seen.has(key)) continue;                     // one champion per account per band
      const stt = acctStats[norm(h.name)] ?? acctStats[norm(canon)];
      if (!stt) continue;
      seen.add(key);
      spd.push(stt.spd ?? 0);
      if (needsAcc[norm(canon)]) acc.push(stt.acc ?? 0);
      if (critApplies[norm(canon)]) crit.push(stt.crate ?? 0);
    }
  }
  const f = (v) => String(v ?? '—').padStart(5);
  console.log(`   ${band.label.padEnd(20)} ${String(clears).padStart(5)}  ${String(seen.size).padStart(5)}  |`
    + `${f(p25(spd))} ${f(med(spd))}  ${f(p25(acc))} ${f(med(acc))}  ${f(p25(crit))} ${f(med(crit))}`);
}
console.log('\n   p25 = the 25th percentile — closer to "what you actually need" than the median,');
console.log('   since half of any clearing population is over-built for the stage they are on.');
