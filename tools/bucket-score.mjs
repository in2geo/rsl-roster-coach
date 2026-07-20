// tools/bucket-score.mjs — FIRST CUT of the POOL/BUCKET grade (Mike's model, 2026-07-18).
// SHADOW ONLY. Read-only. Touches no live path, no DB writes.
//
// THE MODEL (see knowledge/cb-bucket-taxonomy-DRAFT.md):
//   The pool is 100% of what a team can be, split into six buckets by how much each job matters.
//   Champions FILL buckets. Grade = how well actual fill matches the target allocation — "all the
//   parts make a whole." Replaces the ordinal weights whose 0.25x saturation cliff produced three
//   wrong benchings in one session (a Revive-only champ satisfying all of sustain; Tagoar priced
//   0.25x then measured delivering 28% of team healing; Gnut discarded despite carrying the
//   top-weighted need).
//
// THE SEAT ARITHMETIC (Mike's, and the reason no constants are invented here):
//   5 champions = 100%, so ONE SEAT = 20% of the pool. A champion's single seat is divided across
//   the buckets they actually cover — that is what makes a multi-role champion (Pallas: tempo +
//   3 sustain mechanisms + cleanse) worth more than the sum of the parts, and it is why the
//   allocation sums to exactly 5.0 seats.
//
// ACC GATE: a bucket filled by DEBUFFS only counts as much as those debuffs LAND (champ ACC vs the
// difficulty floor). Mike's ruling: a champion's own ACC is a GATE, not a bucket. Buffs/heals/shields
// are never ACC-gated.
//
// v1 LIMITS — deliberately crude, stated so nobody over-reads the output:
//   • Fill is CAPABILITY-based (which buckets a champ covers), not MAGNITUDE-based. It cannot yet
//     tell a big heal from a small one — the healing/defense columns landed in the capture today and
//     are not wired in.
//   • Over-fill is CAPPED FLAT at 100% (Mike has not ruled flat-vs-declining past a full bucket).
//   • Equal split across covered buckets. A champion who is 90% a healer and incidentally buffs
//     speed is treated as splitting evenly. Wrong, but not arbitrarily wrong.
//   • No masteries/gear term, no synergy term, no leader aura.
// Run: node --env-file=.env.local tools/bucket-score.mjs [Difficulty]   (default Brutal)

import fs from 'fs';
import path from 'path';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster } from '../lib/match-engine.js';
import { CB_ACC_FLOOR } from '../lib/cb-shadow-goals.js';
import { tagDelivery } from '../lib/bucket-magnitude.js';

const DIFFICULTY = process.argv[2] || 'Brutal';
const ACC_FLOOR = CB_ACC_FLOOR[DIFFICULTY] ?? 150;

// ── The allocation — RULED by Mike 2026-07-18. Sums to 100 / exactly 5.0 seats. ──
export const ALLOCATION = {
  mitigation: 20, damage: 20, tempo: 20, sustain: 15, amplification: 15, cleanse: 10,
};

// ── Bucket membership — every entry is a Mike ruling or follows from one (see the taxonomy doc). ──
export const BUCKETS = {
  mitigation: ['Decrease Attack', 'Decrease C.Rate', 'Decrease C.DMG', 'Decrease ACC', 'Fatigue',
               'Taunt', 'Increase Defense', 'Increase RES'],
  // Redirect family stays here (RULED): Ally Protection / Intercept / Pain Link redistribute damage
  // that is ALREADY incoming — the boss still picks its target and still swings. `Taunt` is the
  // outlier in Mitigation because it changes WHO THE BOSS TARGETS, i.e. it acts before the swing.
  sustain:    ['Shield', 'AoE Shield', 'Ally Protection', 'Block Damage', 'Unkillable', 'Intercept',
               'Pain Link', 'Stone Skin', 'Magma Shield', 'Life Barrier', 'Total Guard', 'Fortify',
               'Immutable', 'Healer', 'AoE Heal', 'Continuous Heal', 'Leech', 'Revive',
               'Revive on Death'],
  // BOUNDARY (RULED 2026-07-18, after review): DAMAGE **generates** damage; AMPLIFICATION **makes
  // existing damage bigger**. `Counterattack` and `Ally Attack` therefore belong HERE, not in
  // amplification — they produce attacks. Counterattack is the same mechanic as `Reflect Damage`
  // (damage on being hit), which was already ruled into Damage, so the two were split across
  // buckets. That loose boundary also inflated amplification, which was running 182-220% on every
  // team while damage carried the teams that actually won.
  damage:     ['Poison', 'HP Burn', 'Poison Cloud', 'Necrosis', 'Enemy Max HP Damage',
               'Poison Explosion', 'Single Target Damage', 'AoE Damage', 'Multi-Hit A1',
               'Reflect Damage', 'Counterattack', 'Ally Attack'],
  amplification: ['Decrease Defense', 'AoE Decrease Defense', 'Weaken', 'Poison Sensitivity',
               'Increase Debuff Duration', 'Debuff Activation',
               'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'Increase ACC'],
  cleanse:    ['Cleanse', 'Block Debuffs'],
  tempo:      ['Increase Speed', 'Increase Turn Meter', 'Fervor', 'Reset Cooldowns', 'Decrease Speed'],
};

// Tags that do NOTHING on Clan Boss — they must not earn pool share. RULED by Mike 2026-07-18.
// The boss is immune to this whole CC family, so it is dead weight regardless of how well built the
// champion is: ~a third of Gnut's kit (Freeze + Decrease Turn Meter), and part of Pelops's (Stun,
// Provoke, Petrification — including the Petrification his passive places on attackers, though the
// HP Burn half of that same passive is very much alive).
// Previously these scored zero only by ACCIDENT — they were simply absent from every CB need — so the
// engine reached the right answer with no rule behind it. Now it is explicit.
export const DEAD_ON_CB = new Set(['Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Stun', 'AoE Stun',
  'Provoke', 'Fear', 'True Fear', 'Sheep', 'Petrification', 'Ensnare', 'Seal', 'Master Seal', 'Hex',
  'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'Block Revive', 'Buff Strip', 'Steal Buffs']);

/* A bucket's membership is EITHER a plain array of tags (every tag weight 1) OR an object
 * { tag: weight } for per-tag weighting WITHIN the bucket. Both forms are supported so every existing
 * rubric keeps working untouched.
 *
 * WHY WEIGHTS EXIST (Mike, 2026-07-19, on Fire Knight's shield_break): the Divine Shield loses one
 * stack per HIT, so `Multi-Hit A1` is worth materially more than `AoE Damage` there — "Coldheart's A1
 * is the reason she trivialises FK. If both tags score equally under shield_break, the selector can't
 * find her." Ruled AGAINST adding a real hit-count data source for now ("fewer variables with high
 * confidence") — hit-count-per-ability is not in the schema. This is the approximation that replaces it. */
const bucketMembers = spec => (Array.isArray(spec) ? spec : Object.keys(spec ?? {}));
const tagWeightIn  = (tag, spec) => (Array.isArray(spec) ? 1 : (spec?.[tag] ?? 1));
const bucketOf = (tag, buckets = BUCKETS) =>
  Object.keys(buckets).find(b => bucketMembers(buckets[b]).includes(tag)) ?? null;

// Each ADDITIONAL champion covering an already-covered bucket adds this fraction of the target.
// Mike, 2026-07-18: "you would give ONE spot for mitigation. any more is bonus from another champ's
// kit. you wouldn't give 2 seats for mitigation." So the FIRST (best) coverer fills the bucket; the
// rest are genuine but secondary. NOT the old 0.25x saturation cliff — that punished the 2nd coverer
// of a need the team still needed; this says the need is already MET and more is surplus.
const BONUS_COVERER = 0.30;

/** How well this champion DELIVERS each bucket they touch (0..1). Independent of how many other
 *  buckets they cover — a champion who does four jobs does each of them fully (that is exactly why
 *  multi-role champions are coveted). The five-seat limit is a SEPARATE constraint, not a divisor.
 *  The earlier "split one seat across covered buckets" rule had it backwards: it made Pallas cleanse
 *  at 50% because she also buffs speed.
 *
 *  MAGNITUDE (lib/bucket-magnitude.js): delivery is now uptime × chance × land-rate, not a bare
 *  "has the tag". This is what separates Pelops landing Decrease ATK at ACC 214 from Gnut landing the
 *  SAME debuff at ACC 20 — the distinction capability-based fill could not see (INS-0031). */
/* TWO OUTPUTS, NOT ONE BLENDED SCORE (Mike, 2026-07-19).
 *   • `buckets` — delivery WITH land rate blended in. This is the RANKING signal and is unchanged:
 *     it is what separates Pelops landing Decrease ATK at ACC 214 from Gnut landing it at ACC 20
 *     (INS-0031), and removing it would undo that discrimination.
 *   • `gates`   — the SAME ACC shortfall surfaced SEPARATELY, so the player can be told "this champion
 *     needs more ACC" instead of silently receiving a lower score they cannot interpret.
 * Mike's framing (on Ice Golem's revive_control): the bucket is a CHALLENGE dimension; ACC is a
 * CHAMPION-LEVEL viability check on whoever fills the role. The check never lowers the dimension's
 * weight — it flags the fill.
 *
 * THE GATE ONLY BINDS WHERE A CHAMPION CARRIES GATED CAPABILITY — `landRate()` returns 1 for anything
 * that is not a debuff needing ACC, so a pure buffer/healer is never flagged. That is the ruled
 * behaviour (Glorious Pallas at ACC 30 is IRRELEVANT, not broken) and it falls out for free. */
function championDelivery(champ, tagMeta, skillsByName, cfg) {
  const { buckets = BUCKETS, dead = DEAD_ON_CB, accFloor = ACC_FLOOR, harmful = null,
          bossAffinity = null } = cfg ?? {};
  const rows = skillsByName[champ.name] ?? [];
  const out = {};
  const gates = [];
  const warnings = [];
  const affinityNotes = [];

  /* HARMFUL ≠ DEAD (Ice Golem, 2026-07-19). ICE_GOLEM_REVIEW.md: "avoid Counterattack/Reflect
   * (chain-triggers Frigid Vengeance)". A DEAD tag contributes nothing; these make the fight WORSE by
   * firing the boss's threshold retaliation more often.
   * CURRENT HANDLING: contribute ZERO (same as dead) + raise an explicit WARNING. A true NEGATIVE term
   * that docks the grade is deliberately NOT implemented — that is a scoring change with no validation
   * behind it, and "fewer variables with high confidence" applies. Consequence to be aware of: the
   * selector will not AVOID a Counterattack champion here, it just won't credit them. */
  const allTags = champ.tags ?? [];
  if (harmful) {
    for (const t of allTags)
      if (harmful.has(t))
        warnings.push({ champion: champ.name, tag: t, kind: 'harmful',
                        why: 'chain-triggers the boss retaliation — contributes nothing and adds risk' });
  }
  const tags = allTags.filter(t => !dead.has(t) && !(harmful?.has(t)));
  for (const t of tags) {
    const b = bucketOf(t, buckets); if (!b) continue;
    // `assume_booked` is the field mapRoster actually exposes (NOT `is_booked` — that is the raw
    // user_champions/Gestal field one layer down). It folds in the Rare-books-are-cheap heuristic
    // (INS-0003) on top of the real flag. Reading the wrong name silently disabled books entirely.
    // BUG FIX 2026-07-19: this passed the module-level ACC_FLOOR (CB Brutal = 150) instead of the
    // destructured `accFloor` from cfg — so EVERY content scored at Clan Boss's floor. Dragon's 130
    // and CB's per-difficulty floors (Easy 40 … Ultra Nightmare 200) were computed and discarded.
    const { delivery, land, affinity, placementSource } = tagDelivery(t, champ, rows, tagMeta,
      { accFloor, assumeBooked: champ.assume_booked === true, bossAffinity });
    // Best-delivered tag in that bucket represents the champ, scaled by that tag's weight WITHIN the
    // bucket (1 unless the rubric declares otherwise).
    out[b] = Math.max(out[b] ?? 0, delivery * tagWeightIn(t, buckets[b]));

    // Viability flag. `land < 1` can ONLY happen for an ACC-gated debuff (landRate returns 1
    // otherwise), so this fires exactly where the gate genuinely binds.
    if (land < 1) {
      const acc = champ.estimated_stats?.acc ?? champ.acc ?? 0;
      gates.push({ champion: champ.name, tag: t, bucket: b, land,
                   acc, accFloor, shortfall: Math.max(0, (accFloor ?? 0) - acc) });
    }

    // AFFINITY placement penalty — reported, never silent. `placementSource === 'unknown'` means we
    // could not prove the debuff is active-placed and penalised it anyway (see affinityPlacementGaps).
    if (affinity < 1)
      affinityNotes.push({ champion: champ.name, tag: t, bucket: b, factor: affinity,
                           affinity: champ.affinity, bossAffinity, placementSource });
  }
  return { buckets: out, gates, warnings, affinityNotes };
}

// Credit for a bucket given how much filled it. RULED (Mike, 2026-07-18): "anything over 100% is
// DECLINING." Full credit up to the target; surplus still earns something, but progressively less.
//
// DECLINING TOWARD ZERO, NOT NEGATIVE. In a fixed 100% budget across 5 seats, surplus in one bucket
// necessarily means a SHORTFALL in another — and the grade already docks you there. Making the
// over-filled bucket go negative would penalise the same seat twice.
//
// NOTE ON AN EARLIER WRONG OBJECTION: Claude argued against declining because it ranked the BEST
// captured team LAST (Tagoar had the most over-fill: 58.9 vs 43.4 / 45.0). That was an artifact of
// CAPABILITY-based fill, where "over-fill" only meant counting more tags — noise, not surplus. Under
// MAGNITUDE fill it means genuinely surplus delivery (e.g. the measured 2.7x overheal), which should
// indeed stop paying. Do not re-litigate this using capability-fill numbers.
const SURPLUS_DECAY = 0.15;   // log-scale: 2x fill earns ~+10%, 3x ~+16%. Nominal until calibrated.

/* `overfill` (optional, per bucket) makes surplus ACTIVELY COST instead of merely paying less.
 *
 * WHY (Mike ruled a true negative, 2026-07-19): Spider's Den spawns 2 Spiderlings at the start of
 * EACH of your champions' turns, and Skavag consumes them to heal 3% MaxHP and gain +10% ATK
 * PERMANENTLY. So team speed is genuinely DOUBLE-EDGED there — you need turns to clear the spawns,
 * but every turn you take creates more of them. Spider is the only content where a bucket has a
 * downside, and no amount of re-weighting expresses that: a lower weight says "this matters less",
 * not "past a point this hurts."
 *
 * Pass e.g. `overfill: { tempo: -1 }` — beyond target, each surplus unit SUBTRACTS one unit of credit.
 * Omitted buckets keep the default diminishing-returns curve. */
function bucketCredit(got, target, overfill = null) {
  if (target <= 0) return 0;
  const ratio = got / target;
  if (ratio <= 1) return got;                                   // linear up to a full bucket
  if (overfill != null) return target + overfill * (got - target);
  return target * (1 + SURPLUS_DECAY * Math.log(ratio));        // diminishing past it
}

export function scoreTeam(team, tagMeta, skillsByName = {}, cfg = {}) {
  const allocation = cfg.allocation ?? ALLOCATION;
  const fill = Object.fromEntries(Object.keys(allocation).map(b => [b, 0]));
  const per = [];
  // Gather every champion's delivery per bucket, then fill each bucket: best coverer fills it,
  // additional coverers add BONUS_COVERER of the target each.
  const byBucket = Object.fromEntries(Object.keys(allocation).map(b => [b, []]));
  const gates = [];
  const warnings = [];
  const affinityNotes = [];
  for (const c of team) {
    const { buckets: d, gates: g, warnings: w, affinityNotes: a } =
      championDelivery(c, tagMeta, skillsByName, cfg);
    for (const [b, rel] of Object.entries(d)) byBucket[b].push({ name: c.name, rel });
    per.push({ name: c.name, nBuckets: Object.keys(d).length, covered: d });
    gates.push(...g);
    warnings.push(...(w ?? []));
    affinityNotes.push(...(a ?? []));
  }
  for (const [b, target] of Object.entries(allocation)) {
    const cov = byBucket[b].sort((x, y) => y.rel - x.rel);
    if (!cov.length) { fill[b] = 0; continue; }
    fill[b] = target * cov[0].rel;                                   // dedicated seat fills it
    for (const extra of cov.slice(1)) fill[b] += target * extra.rel * BONUS_COVERER;
  }
  let grade = 0;
  const rows = [];
  for (const [b, target] of Object.entries(allocation)) {
    const got = fill[b];
    const pct = target ? got / target : 0;
    grade += bucketCredit(got, target, cfg.overfill?.[b] ?? null);
    rows.push({ bucket: b, target, got, pct, waste: Math.max(0, got - target) });
  }

  /* HARMFUL TAGS now dock the grade (Mike ruled the true negative, 2026-07-19) rather than merely
   * contributing zero. Ice Golem: "avoid Counterattack/Reflect — chain-triggers Frigid Vengeance."
   * Zero-credit meant the selector had no reason to AVOID such a champion; a penalty gives it one.
   * `harmfulPenalty` is grade points per harmful tag carried by a fielded champion. Nominal until
   * calibrated — same status as SURPLUS_DECAY. */
  const harmfulPenalty = cfg.harmfulPenalty ?? 0;
  if (harmfulPenalty) grade -= harmfulPenalty * warnings.filter(w => w.kind === 'harmful').length;
  // `gates` is the SECOND output — viability flags, deliberately NOT folded into `grade`.
  // Worst-first so the binding constraint reads off the top.
  gates.sort((a, b) => a.land - b.land);
  // `affinityNotes` is a THIRD output, same rationale as `gates`: the penalty is already inside
  // `grade` (a weak champion genuinely delivers less), but the player needs to be told WHY and
  // which seat it cost — "bring a Void or same-affinity carrier here", not a silently lower score.
  return { grade, rows, per, gates, warnings, affinityNotes };
}

/**
 * Score a team against SEVERAL strategies for one content and return the BEST FIT.
 *
 * WHY (Mike, 2026-07-19): dungeons are multi-PATH. Fire Knight's TM-LOCK and SURVIVE are explicit
 * substitutes ("you need one, not both"); Ice Golem has three (DoT race / Block Revive / out-sustain).
 * A single flat allocation is wrong for every path but one — set survive high and you penalise a lock
 * team, set it low and you penalise a grind team. Scoring per strategy and taking the best fit also
 * produces a genuinely useful statement: "this is a DoT-race team, 85% of the way there."
 *
 * Single-strategy content (Clan Boss, Dragon) passes a one-element list and this reduces EXACTLY to
 * scoreTeam — which is the regression guarantee: those baselines must not move.
 *
 * ⚠ KNOWN RISK — BEST-OF-N INFLATES. max() over several noisy scores beats any single one, so grades
 * rise and clear-vs-wipe separation can shrink as strategies are added. Watch `shadow-grade-clears`
 * per content. If discrimination drops, the fix is FEWER, MORE DISTINCT strategies — not abandoning
 * the split.
 */
/* `opts` carries per-RUN context that is not part of a strategy's rulebook — currently just
 * `bossAffinity`, which belongs to the STAGE being played, not to the strategy chosen. Without this
 * the multi-strategy contents (Fire Knight, Ice Golem, Spider) silently dropped the affinity term
 * while single-allocation contents kept it, which would have made any A/B incomparable across
 * contents. Merged UNDER the strategy so a rubric could still pin its own value if one ever needs to. */
export function scoreBestStrategy(team, tagMeta, skillsByName = {}, strategies = [], opts = {}) {
  const scored = strategies
    .map(s => ({ strategy: s, ...scoreTeam(team, tagMeta, skillsByName, { ...opts, ...s }) }))
    .sort((a, b) => b.grade - a.grade);
  return { ...scored[0], all: scored };
}

// ── run it against the real captured teams ───────────────────────────────────
// Guarded: this file is BOTH a module (scoreTeam is imported by pool-select / shadow-grade /
// shadow-grade-dragon) and a CLI report. Without this guard the report ran on every import and
// polluted every other tool's output.
const RUN_DIRECTLY = /bucket-score\.mjs$/.test(process.argv[1] ?? '');
if (RUN_DIRECTLY) {
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
// ALIASES ARE REQUIRED (2026-07-19) — omitting them silently drops champions whose Gestal
// display name differs from champions.name (e.g. "Thor Faehammer" -> "Thor"). See gestal-context.js.
const aliasRows = await fetchAliasRows(rest);
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,ascension_required,tags(name,is_debuff,bypasses_accuracy_check)),champion_auras(aura_type,aura_value,aura_area)';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
// Skill rows WITH cooldowns — mapRoster carries {slot,name,summary} but not cooldowns, and uptime
// needs them. Fetched here rather than widening the live mapRoster carry.
let skillRows = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; skillRows = skillRows.concat(d); if (d.length < 1000) break; }
const skillsByName = {};
for (const r of skillRows) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }

const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const snapF = fs.readdirSync(path.join(REPO, 'gestal-sync/output')).find(f => /Gnut/i.test(f) && f.endsWith('.json'));
const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', snapF), 'utf8'));
const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
const mapped = mapRoster(userChampions, {}).mapped;
const byName = Object.fromEntries(mapped.map(c => [c.name, c]));

// The three CAPTURED Brutal teams, with what actually happened.
const RUNS = [
  { label: 'Tagoar   (23.46M, GRANDMASTER, 268t)', names: ['Ezio Auditore', 'Pelops the Victor', 'Narma the Returned', 'Glorious Pallas', 'Tagoar'] },
  { label: 'Fahrakin (21.54M, master,      210t)', names: ['Ezio Auditore', 'Pelops the Victor', 'Narma the Returned', 'Glorious Pallas', 'Fahrakin the Fat'] },
  { label: 'Gnut     (20.20M, master,      177t)', names: ['Gnut', 'Pelops the Victor', 'Narma the Returned', 'Glorious Pallas', 'Fahrakin the Fat'] },
];

console.log(`══ POOL/BUCKET GRADE — Clan Boss ${DIFFICULTY} (ACC floor ${ACC_FLOOR}) ══`);
console.log(`allocation: ${Object.entries(ALLOCATION).map(([b, v]) => `${b} ${v}%`).join(' · ')}\n`);
for (const run of RUNS) {
  const team = run.names.map(n => byName[n]).filter(Boolean);
  if (team.length < 5) { console.log(`${run.label}: MISSING ${run.names.filter(n => !byName[n]).join(', ')}\n`); continue; }
  const { grade, rows, per } = scoreTeam(team, tagMeta, skillsByName);
  console.log(`── ${run.label}`);
  console.log(`   GRADE ${grade.toFixed(1)} / 100`);
  for (const r of rows) {
    const bar = '█'.repeat(Math.round(Math.min(r.pct, 2) * 10)).padEnd(20);
    console.log(`   ${r.bucket.padEnd(14)} target ${String(r.target).padStart(2)}  got ${r.got.toFixed(1).padStart(5)}  ${(r.pct * 100).toFixed(0).padStart(4)}%  ${bar}${r.waste > 0.5 ? ` waste ${r.waste.toFixed(1)}` : ''}`);
  }
  console.log(`   seats: ${per.map(p => `${p.name}(${p.nBuckets})`).join(', ')}\n`);
}
}
