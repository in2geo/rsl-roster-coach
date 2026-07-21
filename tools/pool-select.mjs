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
import { mapRoster, usabilityTier, pickLeaderFrom, applyLeaderAura } from '../lib/match-engine.js';
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
const ARGV       = process.argv.slice(2).filter(a => a !== '--no-affinity');
// `--no-affinity` disables the boss-affinity term, so the SAME run can be scored with and without it.
// This is the A/B control for landing affinity in gen 3 — vary one term, hold everything else.
const NO_AFFINITY = process.argv.includes('--no-affinity');
const CONTENT    = (ARGV[0] || 'cb').toLowerCase();
const ARG3       = ARGV[1];
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
export function poolSelect(pool, tagMeta, skillsByName, { size = 5, maxSwaps = 12, trace = [], cfg = {}, leaderCtx = null } = {}) {
  const ranked = [...pool].sort((a, b) => devScore(b) - devScore(a));
  let team = ranked.slice(0, size);
  let { grade, rows } = scoreTeam(team, tagMeta, skillsByName, cfg);
  trace.push({ step: 'seed (most developed)', team: team.map(c => c.name), grade });

  /* ── BUILD FLOOR — a seat must be held by a champion you have actually BUILT (Mike, 2026-07-19) ──
   * Level 50 minimum to be swapped in as a bucket fix.
   *
   * WHY: bucket fill is CAPABILITY-based, and `lib/bucket-magnitude.js` states the intended model as
   * `effect size × uptime × land rate × BUILD SCALE` while implementing "uptime × land rate only".
   * With build scale unimplemented, an UNGEARED L40 fills a bucket to exactly the same 100% a maxed
   * 6-star would. Observed on DonThor: Dark Elhain — level 40, 4-star, starter gear, **ZERO equipped
   * artifacts** — was swapped into the Spider team for `max_hp_damage was 0%`, because she is the only
   * champion in the pool carrying that capability. The existing "development chooses" rule could not
   * stop it: development only breaks TIES among candidates that fix the gap, it cannot VETO.
   *
   * The honest output is a NAMED GAP, not a pretend fill: "you have no MaxHP nuker" is actionable,
   * "here is an ungeared L40 holding that seat" is misleading. Unfilled buckets are returned as
   * `unfillable` and reported.
   *
   * DELIBERATELY NOT a fix for the underlying defect — implementing build scale is (INS-0031's
   * magnitude problem). This is a floor that stops the worst case while that stays blocked.
   * The floor applies to REPAIR candidates only; the seed is already development-ranked. */
  const BUILD_FLOOR_LEVEL = 50;
  const unfillable = [];

  for (let n = 0; n < maxSwaps; n++) {
    // REPAIR GAPS, DO NOT MAXIMISE GRADE (Mike's design: "see what gaps are not covered... if not,
    // who can cover it and what do we give up"). The two are identical until every bucket is filled,
    // then they diverge badly: a grade-maximising loop keeps trading real champions for marginal
    // bucket-stuffing. Observed 2026-07-18 — after the gaps were fixed it swapped Xenomorph (the
    // MEASURED 13.4M carry) out for Iudex Artor on two separate accounts, each time labelled
    // "grade improvement". Once nothing is short, STOP: the remaining differences are inside the
    // evaluator's noise and it has no business acting on them.
    //
    // Buckets already declared unfillable are skipped, and we walk the REMAINING short buckets in
    // order rather than stopping at the first failure — otherwise one unfillable gap would abandon
    // every other repair behind it (it used to `break`).
    const shorts = rows.filter(r => r.pct < 1 && !unfillable.some(u => u.bucket === r.bucket))
                       .sort((a, b) => a.pct - b.pct);
    if (!shorts.length) break;                          // no fixable gaps left

    let applied = null;
    for (const short of shorts) {
      let best = null, blockedBy = null;
      for (const cand of ranked) {
        if (team.includes(cand)) continue;
        for (const out of team) {
          const next = team.map(c => (c === out ? cand : c));
          const s = scoreTeam(next, tagMeta, skillsByName, cfg);
          // The swap must actually FIX THE SHORT BUCKET, not merely raise the total.
          const fixed = (s.rows.find(r => r.bucket === short.bucket)?.pct ?? 0) > short.pct;
          if (!fixed || s.grade <= grade + 1e-9) continue;
          // BUILD FLOOR — GEAR-AWARE (2026-07-20): a candidate can fill a bucket if it is actually
          // built, which is LEVEL >= 50 OR meaningful GEAR (good/endgame). Pure-level blocked geared
          // low-level champs whose contribution is real: Kael Lv27 5★ GOOD gear (a poisoner) was
          // recorded as "closest, level 27" and benched, while his poison actually cleared. Ungeared
          // low champs (Dark Elhain Lv40 / zero artifacts) still fail both and are correctly blocked.
          // Bar is FAIR gear (>=2), not good: Vergis (Lv40, FAIR gear) is demonstrably effective — he
          // is the 5th seat of Bambus's fastest Spider-13 clear (289s) — and a `good`-only bar blocked
          // him from being repaired back in, stranding the model on a worse team. What must stay out
          // is the ZERO-artifact case (Dark Elhain Lv40, starter/no gear), which fails gear>=2.
          const built = (cand.level ?? 0) >= BUILD_FLOOR_LEVEL || (GEARW[cand.gear_tier] ?? 1) >= 2;
          if (!built) {
            if (!blockedBy || (cand.level ?? 0) > (blockedBy.level ?? 0)) blockedBy = cand;
            continue;
          }
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
      if (best) { applied = { best, short }; break; }
      unfillable.push({ bucket: short.bucket, pct: short.pct,
                        blocked_by: blockedBy ? { name: blockedBy.name, level: blockedBy.level ?? 0 } : null });
    }
    if (!applied) continue;                             // everything short this pass was unfillable

    const { best, short } = applied;
    trace.push({ step: `swap: ${best.outName} → ${best.inName}`,
                 because: `${short.bucket} was ${(short.pct * 100).toFixed(0)}%`,
                 team: best.team.map(c => c.name), grade: best.grade });
    team = best.team; grade = best.grade; rows = best.rows;
  }

  /* ── LEADER AURA (ported from gen 1, 2026-07-19) ──────────────────────────────────────────────
   * In RSL only the LEADER's aura is live, so choosing a leader = choosing which aura to run. The
   * whole mechanism was solved 2026-07-12 in `match-engine.js` (`pickLeaderFrom` + `applyLeaderAura`,
   * `LEADER_AREA_APPLIES`) — this reuses those directly rather than re-deriving them. It was missing
   * here only because gen 1 folded the aura into the ENGINE's threshold path, never into the Gestal
   * `effective_stats` path that this tool reads.
   *
   * ORDERING — deliberately identical to gen 1: pick the leader FROM the already-selected five, then
   * fold the aura in and re-score. The aura does NOT feed back into the swap loop. Letting it would
   * make selection and leader mutually recursive (team → leader → ACC → gate → grade → team), which
   * is the same circularity gen 1 broke by deriving thresholdStats from the RAW threshold list.
   * Keeping the ordering identical is also what keeps the two generations comparable.
   *
   * WHY IT MATTERS HERE: the ACC gate reads `estimated_stats.acc`, which is exactly what
   * applyLeaderAura writes. ACC/RES auras are FLAT (+80 = +80 ACC for every ally), so on ACC-floored
   * content a single leader choice can move several champions across the floor at once. Measured on
   * Don$Gnut FK (floor 170): one champion clearly over it becomes three.
   *
   * Both grades are returned so the aura's effect stays ATTRIBUTABLE rather than baked into one number. */
  const finalize = t => {
    const g0 = scoreTeam(t, tagMeta, skillsByName, cfg);
    if (!leaderCtx) return { team: t, auraTeam: t, leader: null, grade: g0.grade, gradeBeforeAura: g0.grade, rows: g0.rows };
    const auraRows = t.flatMap(c => (leaderCtx.aurasByChampId?.[c.id] ?? [])
      .map(a => ({ ...a, champion_id: c.id })));
    const ldr = pickLeaderFrom(t, auraRows, {
      contentArea: leaderCtx.contentArea, thresholdStats: leaderCtx.thresholdStats,
      accFloor: leaderCtx.accFloor });
    if (!ldr) return { team: t, auraTeam: t, leader: null, grade: g0.grade, gradeBeforeAura: g0.grade, rows: g0.rows };
    const at = applyLeaderAura(t, ldr);
    const g1 = scoreTeam(at, tagMeta, skillsByName, cfg);
    return { team: t, auraTeam: at, leader: ldr, grade: g1.grade, gradeBeforeAura: g0.grade, rows: g1.rows };
  };

  const chosen = finalize(team);

  /* ── RUNNER-UP TEAMS ──────────────────────────────────────────────────────────────────────────
   * The repair loop is a greedy hill-climb: it evaluates every (bench-in × fielded-out) swap at each
   * step and DISCARDS all but the winner, so it returns one team and no ranking. That is fine for
   * recommending, and useless for TESTING — "what else would you field, and what does it cost?" is
   * exactly the question an A/B against real runs needs answered.
   *
   * So: at the converged team, re-evaluate every one-swap neighbour and keep the best few. Each is
   * put through the SAME finalize() as the chosen team — its own leader picked, its own aura folded
   * in — because a runner-up graded without an aura is not comparable to a winner graded with one.
   * One swap away is the deliberate scope: it is the smallest change a player can actually act on. */
  const alts = [];
  for (const cand of ranked) {
    if (team.includes(cand)) continue;
    for (const out of team) {
      const f = finalize(team.map(c => (c === out ? cand : c)));
      alts.push({ ...f, inName: cand.name, outName: out.name });
    }
  }

  /* RANK THEM THE WAY THE MODEL DECIDES — GRADE FILTERS, DEVELOPMENT CHOOSES (Mike, 2026-07-18).
   *
   * Sorting neighbours by raw grade is WRONG and was tried first: on Don$Gnut CB it returned Seeker
   * (L40, 12k HP, one tempo tag) as the #2 team at +1.3 grade — the exact fodder case this tool's
   * header documents, walking back in through the alternates list. The repair loop STOPS when no
   * bucket is short rather than maximising, so most higher-grade neighbours are bucket-stuffing, not
   * better teams.
   *
   * So: FILTER to neighbours that are genuinely fieldable (no bucket left short, and within TIE_BAND
   * of the chosen grade — beyond that they are solving a different problem), then ORDER BY DEVELOPMENT.
   * Same rule as the repair step and the cross-strategy choice, applied one level out. */
  const ALT_TIE_BAND = 5;
  const teamDev = t => t.reduce((a, c) => a + devScore(c), 0) / (t.length || 1);
  const fieldable = alts.filter(a => a.rows.every(r => r.pct >= 1)
                                  && a.grade >= chosen.grade - ALT_TIE_BAND);
  fieldable.sort((a, b) => teamDev(b.team) - teamDev(a.team));

  return { ...chosen, trace, unfillable, alts: fieldable.slice(0, 3).map(a => ({ ...a, dev: teamDev(a.team) })) };
}

// ── run it (CLI only — guarded so this file can be imported, e.g. by tools/pool-scan.mjs) ──
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await (async () => {
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
// champion_auras joined for the LEADER step — aura_area matters (a "Dungeons" aura is INERT on
// Clan Boss), and aura_restriction scales an affinity-locked aura by how much of the team it helps.
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check)),champion_auras(aura_type,aura_value,aura_area,aura_restriction,aura_summary)';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let sk = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; sk = sk.concat(d); if (d.length < 1000) break; }
const skillsByName = {};
for (const r of sk) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }
// Auras keyed by champion id, for the leader step. Clan Boss is NOT a "Dungeons" aura target
// (LEADER_AREA_APPLIES) — passing the right contentArea is what enforces that.
const aurasByChampId = Object.fromEntries(db.map(c => [c.id, c.champion_auras ?? []]));
const CONTENT_AREA = CONTENT === 'cb' ? 'clan_boss' : 'dungeon';

/* ── BOSS AFFINITY (2026-07-20) ───────────────────────────────────────────────────────────────
 * Gen 3 was BLIND to affinity while gen 1 has had it since INS-0015. It matters here mostly through
 * the PLACEMENT channel: attacking a stronger affinity, 35% of strikes are Weak Hits and a Weak Hit
 * cannot place an active-skill debuff — so a weak champion under-delivers into every debuff bucket
 * (see lib/bucket-magnitude.js). `dungeon_stage_affinities` is complete: 100 rows, four dungeons,
 * stages 1-25, and it validates against captured battles (FK 13 Force / 15 Magic / 16 Void).
 *
 * CLAN BOSS IS DELIBERATELY NULL. Its affinity rotates DAILY rather than being a property of the
 * content, `roster.js` hardcodes `boss_affinity = null` for CB, and `lib/battle-gaps.js` already
 * files the capture gap. Guessing a CB affinity would be worse than modelling none. */
const AFFINITY_DUNGEON = {
  dragon: "Dragon's Lair", fire_knight: "Fire Knight's Castle",
  ice_golem: "Ice Golem's Peak", spider: "Spider's Den",
};
let BOSS_AFFINITY = null;
if (!NO_AFFINITY && AFFINITY_DUNGEON[CONTENT]) {
  const dRow = (await rest(`dungeons?select=id,name&name=eq.${encodeURIComponent(AFFINITY_DUNGEON[CONTENT])}&game_id=eq.raid_shadow_legends`))?.[0];
  if (dRow) {
    const aff = await rest(`dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.${dRow.id}&stage_number=eq.${STAGE}`);
    BOSS_AFFINITY = aff?.[0]?.affinity ?? null;
  }
}
// Every cfg the scorer sees carries the affinity; `undefined`/null simply disables the term.
const withAffinity = cfg => ({ ...cfg, bossAffinity: BOSS_AFFINITY });
/* thresholdStats mirrors gen 1's rule: an aura whose stat the content actually FLOORS is worth more
 * (×1.5), so an ACC aura outranks a raw-SPD one exactly where ACC is the binding gate. Derived from
 * the rubric's declared accFloor — i.e. from the CONFIG, never from evaluated results, which is how
 * gen 1 avoids the leader↔threshold ordering cycle. */
const leaderCtxFor = cfg => ({
  aurasByChampId, contentArea: CONTENT_AREA,
  thresholdStats: cfg?.accFloor ? ['acc'] : [],
  accFloor: cfg?.accFloor ?? 0,   // INS-0005 Rule 1: an ACC aura is scored by the deficit it closes
});

/* ── ALIASES ARE REQUIRED, NOT OPTIONAL (2026-07-19) ──────────────────────────────────────────
 * `buildUserChampions(gestal, db, dbAliases = [])` — the third argument resolves any NAME FORM to
 * the champion. It defaults to [], and EVERY shadow tool was omitting it, so alias resolution was
 * silently OFF across the whole testing layer while the live paths (api/my-roster.js,
 * lib/battle-pipeline.js) passed it correctly.
 *
 * A champion is then invisible whenever their Gestal display name differs from `champions.name` AND
 * their `type_id` is null — the match tries baseTypeId first, then the name map. Found when Mike
 * asked why his BEST champion was on no team: "Thor Faehammer" → `champions.name` "Thor", type_id
 * null, so he never entered the roster. He is usabilityTier 3 with 8 tags including Multi-Hit A1 —
 * the PRIMARY Fire Knight shield_break tag. Recovers 5 champions on DonThor, 10 on GuapoDonni.
 *
 * The `= []` default is what made it silent: no error, just a quietly smaller roster. */
let aliasRows = [];
for (let f = 0; ; f += 1000) {
  const d = await rest(`champion_aliases?select=alias,champion_id&limit=1000&offset=${f}`);
  if (!Array.isArray(d) || !d.length) break;
  aliasRows = aliasRows.concat(d);
  if (d.length < 1000) break;
}

const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
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
    const runs = RUN_CFG.strategies.map(s => ({ s, sel: poolSelect(pool, tagMeta, skillsByName, { cfg: withAffinity(s), leaderCtx: leaderCtxFor(s) }) }))
                                   .sort((a, b) => b.sel.grade - a.sel.grade);
    const topGrade = runs[0].sel.grade;
    const contenders = runs.filter(r => r.sel.grade >= topGrade - TIE_BAND)
                           .sort((a, b) => teamDev(b.sel.team) - teamDev(a.sel.team));
    best = contenders[0].sel; chosen = contenders[0].s;
    var alternatives = runs.filter(r => r.s.key !== chosen.key);
  } else {
    best = poolSelect(pool, tagMeta, skillsByName, { cfg: withAffinity(RUN_CFG.cfg), leaderCtx: leaderCtxFor(RUN_CFG.cfg) });
  }
  const { team, grade, gradeBeforeAura, leader, rows, trace, alts, unfillable } = best;

  console.log(`\n══ ${snap.displayName ?? f} — ${RUN_CFG.label} (pool ${pool.length}) ══`);
  if (chosen) console.log(`   PATH: ${chosen.name}`);
  for (const t of trace) console.log(`   ${String(t.grade.toFixed(1)).padStart(6)}  ${t.step}${t.because ? `  [${t.because}]` : ''}\n           ${t.team.join(', ')}`);
  console.log(`   FINAL: ${team.map(c => c.name).join(', ')}`);
  // The leader is a REAL instruction to the player (only their aura fires), not list position —
  // the FINAL order above is just swap order and means nothing.
  if (leader)
    console.log(`   LEADER: ${leader.name}  [${leader.aura_type} ${leader.aura_value} — ${leader.aura_area}]`
              + `   grade ${gradeBeforeAura.toFixed(1)} → ${grade.toFixed(1)}`);
  else console.log(`   LEADER: none — no fielded champion has an aura that applies to ${CONTENT_AREA}`);
  console.log(`   buckets: ${rows.map(r => `${r.bucket} ${(r.pct * 100).toFixed(0)}%`).join(' · ')}`);
  // A NAMED GAP beats a pretend fill — say the roster can't cover this, and who could if developed.
  for (const u of unfillable ?? [])
    console.log(`   GAP: ${u.bucket} stuck at ${(u.pct * 100).toFixed(0)}% — no BUILT champion (level 50+ or fair gear) can fill it`
              + (u.blocked_by ? `  (closest: ${u.blocked_by.name}, level ${u.blocked_by.level})` : ''));
  // Next-best teams one swap from the chosen five — each with its OWN leader, so the grades compare.
  for (const [i, a] of (alts ?? []).entries())
    console.log(`   #${i + 2}: ${a.grade.toFixed(1).padStart(5)}  ${a.team.map(c => c.name).join(', ')}`
              + `\n        swap ${a.outName} → ${a.inName}${a.leader ? `, lead ${a.leader.name}` : ''}  (dev ${a.dev.toFixed(2)})`);
  if (chosen && alternatives?.length)
    for (const a of alternatives) console.log(`   alt: ${a.s.key.padEnd(18)} ${a.sel.grade.toFixed(1)}   ${a.sel.team.map(c => c.name).join(', ')}`);
}
})();
