// tools/pool-select.mjs — SELECTION by Mike's loop: seed with the BEST-BUILT five, then repair the
// short buckets. SHADOW. Read-only.
//
// MIKE'S DESIGN (2026-07-18): "the team building should start with the best built champions and see
// what gaps are not covered. so we would apply the best 5 champs and see how we look against the
// pool. do we have tempo covered? do we have mitigation covered? if not, who can cover it and what do
// we give up. and so on until we settle on 5 champs."
//
// WHY THIS AND NOT THE BRUTE FORCE: scoring all 3,003 combinations treats a L40 Epic and a maxed
// Legendary as equals if they carry the same tag. On Don$Gnut that put Seeker (L40, 12k HP, ONE tempo
// tag) into all five top teams while dropping Ezio — the measured amplification engine — entirely,
// and ranked the actual 23.46M GRANDMASTER team #90 of 3003. Starting from build quality makes that
// impossible: you begin with champions who can actually deliver, and only trade away from them when a
// bucket is genuinely short.
//
// This is also the fix for why `team-assembler.js` was shelved ("naive set-cover, fielded fodder") —
// same repair loop, but seeded by development instead of by coverage.
//
// Run: node --env-file=.env.local tools/pool-select.mjs [Difficulty]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions } from '../lib/gestal-context.js';
import { mapRoster, usabilityTier } from '../lib/match-engine.js';
import { scoreTeam, ALLOCATION } from './bucket-score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const DIFFICULTY = process.argv[2] || 'Brutal';

// ── DEVELOPMENT: how built is this champion? The term the bucket scorer completely lacked. ──
// Deliberately the same shape as shadow-cb's `cbQuality` (Mike: "DEVELOPMENT is primary — a maxed
// champ should beat an under-built one on level/gear/stars ALONE"). Rarity is the weakest signal and
// is only a tiebreaker: a maxed Epic beats an unbuilt Legendary.
const GEARW = { starter: 1, fair: 2, good: 3, endgame: 4 };
const RARW  = { Rare: 1, Epic: 2, Legendary: 3, Mythical: 4 };
export function devScore(c) {
  return 0.40 * (usabilityTier(c) / 3)
       + 0.25 * ((GEARW[c.gear_tier] ?? 1) / 4)
       + 0.20 * Math.min(1, (c.level ?? 0) / 60)
       + 0.10 * Math.min(1, (c.stars ?? 0) / 6)
       + 0.05 * ((RARW[c.rarity] ?? 1) / 4);
}

/** Which bucket is furthest below its target? Returns null when nothing is short. */
function shortestBucket(rows) {
  const short = rows.filter(r => r.pct < 1).sort((a, b) => a.pct - b.pct);
  return short.length ? short[0] : null;
}

/**
 * Mike's loop. Seed = the five most-developed. Then repeatedly: grade against the pool, find the
 * shortest bucket, and try every (bench-in × fielded-out) swap. Accept the best swap that IMPROVES
 * the grade; stop when none does.
 *
 * The swap step is where "what do we give up" gets answered — a swap is only taken if the total
 * grade rises, so losing coverage elsewhere is priced in automatically.
 */
export function poolSelect(pool, tagMeta, skillsByName, { size = 5, maxSwaps = 12, trace = [] } = {}) {
  const ranked = [...pool].sort((a, b) => devScore(b) - devScore(a));
  let team = ranked.slice(0, size);
  let { grade, rows } = scoreTeam(team, tagMeta, skillsByName);
  trace.push({ step: 'seed (most developed)', team: team.map(c => c.name), grade });

  for (let n = 0; n < maxSwaps; n++) {
    // REPAIR GAPS, DO NOT MAXIMISE GRADE (Mike's design: "see what gaps are not covered... if not,
    // who can cover it and what do we give up"). The two are identical until every bucket is filled,
    // then they diverge badly: a grade-maximising loop keeps trading real champions for marginal
    // bucket-stuffing. Observed 2026-07-18 — after the gaps were fixed it swapped Xenomorph (the
    // MEASURED 13.4M carry) out for Iudex Artor on two separate accounts, each time labelled
    // "grade improvement". Once nothing is short, STOP: the remaining differences are inside the
    // evaluator's noise and it has no business acting on them.
    const short = shortestBucket(rows);
    if (!short) break;                                  // no gaps — done, keep the developed team
    let best = null;
    for (const cand of ranked) {
      if (team.includes(cand)) continue;
      for (const out of team) {
        const next = team.map(c => (c === out ? cand : c));
        const s = scoreTeam(next, tagMeta, skillsByName);
        // The swap must actually FIX THE SHORT BUCKET, not merely raise the total.
        const fixed = (s.rows.find(r => r.bucket === short.bucket)?.pct ?? 0) > short.pct;
        if (fixed && s.grade > grade + 1e-9 && (!best || s.grade > best.grade)) {
          best = { team: next, grade: s.grade, rows: s.rows, inName: cand.name, outName: out.name };
        }
      }
    }
    if (!best) break;                                   // nothing can fix it — report the gap instead
    trace.push({ step: `swap: ${best.outName} → ${best.inName}`,
                 because: short ? `${short.bucket} was ${(short.pct * 100).toFixed(0)}%` : 'grade improvement',
                 team: best.team.map(c => c.name), grade: best.grade });
    team = best.team; grade = best.grade; rows = best.rows;
  }
  return { team, grade, rows, trace };
}

// ── run it ───────────────────────────────────────────────────────────────────
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check))';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let sk = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; sk = sk.concat(d); if (d.length < 1000) break; }
const skillsByName = {};
for (const r of sk) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  const { userChampions } = buildUserChampions(snap.champions ?? [], db);
  const mapped = mapRoster(userChampions, {}).mapped;
  const pool = mapped.filter(c => usabilityTier(c) >= 2);
  if (pool.length < 5) continue;
  const { team, grade, rows, trace } = poolSelect(pool, tagMeta, skillsByName);
  console.log(`\n══ ${snap.displayName ?? f} — ${DIFFICULTY} (pool ${pool.length}) ══`);
  for (const t of trace) console.log(`   ${String(t.grade.toFixed(1)).padStart(6)}  ${t.step}${t.because ? `  [${t.because}]` : ''}\n           ${t.team.join(', ')}`);
  console.log(`   FINAL: ${team.map(c => c.name).join(', ')}`);
  console.log(`   buckets: ${rows.map(r => `${r.bucket} ${(r.pct * 100).toFixed(0)}%`).join(' · ')}`);
}
