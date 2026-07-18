// tools/shadow-grade-dragon.mjs — the ranking test, for DRAGON. SHADOW, read-only.
//
// Same question as shadow-grade.mjs ("does the model ORDER real teams as reality did?") but with two
// changes that matter:
//   • REALITY = TIME, not damage. Dungeons are judged by clear speed (CLAUDE.md core principle), and
//     per-hero damage is not even captured outside Clan Boss. FASTER = BETTER.
//   • WINS ONLY. A loss is not a slow win; mixing them would reward teams that failed quickly.
// Group by account + STAGE (a stage-16 clear and a stage-20 clear are different problems).
//
// NOISE FLOOR — read this before believing any result: DonBrogni's most-run Dragon 20 team spans
// 163-246s across 4 runs (~50%), which is WIDER than the gap between most distinct teams (184-235s).
// So single-run teams are largely noise against each other. Pairs are only counted when both teams
// have a median built from >= MIN_RUNS runs, and when their medians differ by more than NOISE_PCT.
// Without those guards this test would mostly measure variance and report it as skill.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions } from '../lib/gestal-context.js';
import { mapRoster } from '../lib/match-engine.js';
import { scoreTeam } from './bucket-score.mjs';
import { DRAGON_ALLOCATION, DRAGON_BUCKETS, DEAD_ON_DRAGON } from '../lib/dragon-rubric.js';

const MIN_RUNS = 1;      // teams with fewer runs than this are excluded from PAIRS
const NOISE_PCT = 0.10;  // medians must differ by >10% to count as a real difference
const ACC_FLOOR = 130;   // Dragon 7-9 ~130 (CLAUDE.md placeholder floors); stage-specific later

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check))';
let db = []; for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let sk = []; for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; sk = sk.concat(d); if (d.length < 1000) break; }
const skillsByName = {}; for (const r of sk) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

const rosterByAccount = {};
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  if (!snap.accountId) continue;
  const { userChampions } = buildUserChampions(snap.champions ?? [], db);
  rosterByAccount[snap.accountId] = Object.fromEntries(mapRoster(userChampions, {}).mapped.map(c => [c.name, c]));
}

const log = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json'), 'utf8'));
const arr = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const groups = {};
for (const b of arr) {
  if (b.dungeon !== "Dragon's Lair") continue;
  if (b.result !== 'Victory') continue;                       // wins only
  if (!(b.durationSeconds > 0)) continue;                     // need a time
  if ((b.heroes ?? []).length !== 5) continue;                // full read only
  (groups[`${b.displayName} · stage ${b.stageNumber}`] ??= []).push(b);
}

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const cfg = { allocation: DRAGON_ALLOCATION, buckets: DRAGON_BUCKETS, dead: DEAD_ON_DRAGON, accFloor: ACC_FLOOR };

console.log('══ SHADOW GRADE — DRAGON. Does the model rank real teams by CLEAR TIME? ══');
console.log(`   wins only · faster = better · pairs need >${NOISE_PCT * 100}% median gap\n`);
let agreeAll = 0, totalAll = 0;
for (const [key, rs] of Object.entries(groups)) {
  const byTeam = {};
  for (const r of rs) { const k = r.heroes.map(h => h.name).sort().join(', '); (byTeam[k] ??= []).push(r); }
  const roster = rosterByAccount[rs[0].accountId];
  if (!roster) continue;
  const scored = [];
  for (const [names, list] of Object.entries(byTeam)) {
    if (list.length < MIN_RUNS) continue;
    const team = names.split(', ').map(n => roster[n]).filter(Boolean);
    if (team.length < 5) continue;
    scored.push({ names, n: list.length, med: median(list.map(x => x.durationSeconds)),
                  grade: scoreTeam(team, tagMeta, skillsByName, cfg).grade });
  }
  if (scored.length < 2) continue;
  console.log(`── ${key}`);
  for (const s of [...scored].sort((a, b) => a.med - b.med))
    console.log(`     ${String(s.med).padStart(4)}s (n=${s.n})  model ${s.grade.toFixed(1).padStart(6)}   ${s.names.slice(0, 70)}`);
  let agree = 0, tot = 0, skipped = 0;
  for (let i = 0; i < scored.length; i++) for (let j = i + 1; j < scored.length; j++) {
    const a = scored[i], b = scored[j];
    if (Math.abs(a.med - b.med) / Math.min(a.med, b.med) <= NOISE_PCT) { skipped++; continue; }
    tot++;
    const realBetter = a.med < b.med ? a : b;          // FASTER is better
    const modelBetter = a.grade > b.grade ? a : b;
    if (realBetter === modelBetter) agree++;
  }
  agreeAll += agree; totalAll += tot;
  console.log(`     → ${agree}/${tot} correct (${skipped} pairs skipped as within noise)\n`);
}
console.log(`══ DRAGON OVERALL: ${agreeAll}/${totalAll}` + (totalAll ? ` (${((agreeAll / totalAll) * 100).toFixed(0)}%)` : '') + ' — 50% is a coin flip.');
