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
import { scoreTeam, ALLOCATION, BUCKETS, DEAD_ON_CB } from './bucket-score.mjs';
import { DRAGON_ALLOCATION, DRAGON_BUCKETS, DEAD_ON_DRAGON } from '../lib/dragon-rubric.js';
import { CB_ACC_FLOOR } from '../lib/cb-shadow-goals.js';
import { FK_STRATEGIES } from '../lib/fire-knight-rubric.js';
import { IG_STRATEGIES } from '../lib/ice-golem-rubric.js';
import { spiderStrategiesForStage } from '../lib/spider-rubric.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
// Usage:  node --env-file=.env.local tools/pool-select.mjs [content] [difficulty|stage]
//   content:  cb (default) | dragon | fire_knight | ice_golem | spider
//   3rd arg:  CB → difficulty (Easy|Normal|Hard|Brutal|Nightmare|Ultra Nightmare, default Brutal)
//             spider → STAGE NUMBER (default 15) — Spider's strategies are stage-gated
//
// SINGLE-ALLOCATION content passes `cfg`; MULTI-STRATEGY content passes `strategies` and the repair
// loop is run ONCE PER STRATEGY, then the best result wins. Comparing one team under two rulebooks is
// a different (and misleading) question — each strategy must build its own team.
const CONTENT    = (process.argv[2] || 'cb').toLowerCase();
const ARG3       = process.argv[3];
const DIFFICULTY = ARG3 || 'Brutal';
const STAGE      = Number(ARG3) || 15;
const CONTENT_CFG = {
  cb:          { cfg: { allocation: ALLOCATION, buckets: BUCKETS, dead: DEAD_ON_CB,
                        accFloor: CB_ACC_FLOOR[DIFFICULTY] ?? 150 }, label: `Clan Boss ${DIFFICULTY}` },
  dragon:      { cfg: { allocation: DRAGON_ALLOCATION, buckets: DRAGON_BUCKETS, dead: DEAD_ON_DRAGON,
                        accFloor: 130 }, label: "Dragon's Lair" },
  fire_knight: { strategies: FK_STRATEGIES, label: "Fire Knight's Castle" },
  ice_golem:   { strategies: IG_STRATEGIES, label: "Ice Golem's Peak" },
  spider:      { strategies: spiderStrategiesForStage(STAGE), label: `Spider's Den (stage ${STAGE})` },
};
const RUN_CFG = CONTENT_CFG[CONTENT];
if (!RUN_CFG) {
  console.error(`Unknown content "${CONTENT}". Use: cb | dragon | fire_knight | ice_golem | spider`);
  process.exit(1);
}

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
export function poolSelect(pool, tagMeta, skillsByName, { size = 5, maxSwaps = 12, trace = [], cfg = {} } = {}) {
  const ranked = [...pool].sort((a, b) => devScore(b) - devScore(a));
  let team = ranked.slice(0, size);
  let { grade, rows } = scoreTeam(team, tagMeta, skillsByName, cfg);
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
        const s = scoreTeam(next, tagMeta, skillsByName, cfg);
        // The swap must actually FIX THE SHORT BUCKET, not merely raise the total.
        const fixed = (s.rows.find(r => r.bucket === short.bucket)?.pct ?? 0) > short.pct;
        if (!fixed || s.grade <= grade + 1e-9) continue;
        // AND THE REPLACEMENT MUST BE ONE OF YOUR BEST CHAMPIONS TOO (Mike, 2026-07-18).
        // The seed respects development; the repair used to ignore it entirely and simply took
        // whichever candidate scored highest — which benched a maxed 6-star Legendary for a L40
        // Epic because the L40 touched two more buckets (Don$Gnut: Gnut -> Seeker on Dragon).
        // That is the "fields fodder" failure the whole seed-by-development design exists to stop,
        // sneaking back in through the repair step. GRADE is the FILTER (does this fix the gap);
        // DEVELOPMENT is the CHOOSER (who fixes it best). Among candidates that genuinely fix the
        // short bucket, take the most developed — a champion you have actually built.
        if (!best || devScore(cand) > devScore(best.cand)
                  || (devScore(cand) === devScore(best.cand) && s.grade > best.grade)) {
          best = { team: next, grade: s.grade, rows: s.rows, cand, inName: cand.name, outName: out.name };
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
  // Multi-strategy: build a team PER strategy, then take the best. Single-allocation: one run.
  let best, chosen = null;
  if (RUN_CFG.strategies) {
    if (!RUN_CFG.strategies.length) { console.log(`\n══ ${snap.displayName ?? f} — ${RUN_CFG.label}: no strategy viable`); continue; }
    /* GRADE FILTERS, DEVELOPMENT CHOOSES — applied ACROSS strategies, not just within one.
     *
     * Mike's correction #3 (2026-07-18) made the REPAIR step respect development: "repairs must come
     * FROM developed champions too — it benched a maxed 6-star Legendary for a L40 Epic because the
     * L40 touched two more buckets." That rule lived INSIDE poolSelect. Choosing BETWEEN strategies
     * sorted on raw grade alone, so the same failure walked straight back in one level up:
     * Don$Gnut / Spider 17 fielded Sunken Sentinel (L30 3*, 4,590 HP) over Narma (L50 5*, 13,605 HP)
     * for 2.2 points of grade.
     *
     * And a 2.2-point gap across DIFFERENT allocations is not a real difference — bucket sets differ,
     * so fillability differs, and the grades are only loosely comparable. Within TIE_BAND we therefore
     * treat strategies as equivalent and prefer the better-developed team. */
    const TIE_BAND = 5;
    const teamDev = t => t.reduce((a, c) => a + devScore(c), 0) / (t.length || 1);
    const runs = RUN_CFG.strategies.map(s => ({ s, sel: poolSelect(pool, tagMeta, skillsByName, { cfg: s }) }))
                                   .sort((a, b) => b.sel.grade - a.sel.grade);
    const topGrade = runs[0].sel.grade;
    const contenders = runs.filter(r => r.sel.grade >= topGrade - TIE_BAND)
                           .sort((a, b) => teamDev(b.sel.team) - teamDev(a.sel.team));
    best = contenders[0].sel; chosen = contenders[0].s;
    var alternatives = runs.filter(r => r.s.key !== chosen.key);
  } else {
    best = poolSelect(pool, tagMeta, skillsByName, { cfg: RUN_CFG.cfg });
  }
  const { team, grade, rows, trace } = best;

  console.log(`\n══ ${snap.displayName ?? f} — ${RUN_CFG.label} (pool ${pool.length}) ══`);
  if (chosen) console.log(`   PATH: ${chosen.name}`);
  for (const t of trace) console.log(`   ${String(t.grade.toFixed(1)).padStart(6)}  ${t.step}${t.because ? `  [${t.because}]` : ''}\n           ${t.team.join(', ')}`);
  console.log(`   FINAL: ${team.map(c => c.name).join(', ')}`);
  console.log(`   buckets: ${rows.map(r => `${r.bucket} ${(r.pct * 100).toFixed(0)}%`).join(' · ')}`);
  if (chosen && alternatives?.length)
    for (const a of alternatives) console.log(`   alt: ${a.s.key.padEnd(18)} ${a.sel.grade.toFixed(1)}   ${a.sel.team.map(c => c.name).join(', ')}`);
}
