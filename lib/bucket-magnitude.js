// lib/bucket-magnitude.js — MAGNITUDE of a champion's delivery per bucket (SHADOW, Layer: evaluation).
//
// WHY: capability-based fill cannot grade a team. Every captured Don$Gnut team "covers" mitigation, so
// the bucket scorer returned ~the same number for a GRANDMASTER team and a team 3M behind it
// (INS-0031). What separates them is HOW MUCH of each job actually gets done — Pelops lands his
// Decrease ATK at ACC 214, Gnut lands the SAME debuff at ACC 20.
//
// THE MODEL (INS-0031):   delivery = effect size × uptime × land rate × build scale
//
// THIS FILE IS THE INTERIM CUT: **uptime × land rate only.** Effect size is deliberately deferred —
// extracting per-(champion,tag) magnitudes from skill text needs LLM extraction + advisor review
// (~1/3 of Decrease-ATK skills resist a naive regex: conditional, random-pool, multi-debuff prose).
// Uptime and land rate alone already separate Pelops from Gnut, which is the discrimination we need to
// test whether the pool model works at all. Add effect size only if this proves insufficient.
//
// PRIOR ART REUSED (do not rebuild): lib/power-model.js already had `dotLandRate` and
// `dotUptimeFromSkills` — calibrated against real battles and never wired into selection. This
// generalises that uptime idea from DoT-only to any tag, and keeps its conventions.
//
// CONVENTION INHERITED FROM power-model: **absence of data ⇒ 1.0, never 0.** A missing cooldown or
// unparseable skill text is a CAPTURE GAP, not evidence the champion is bad. Zero-crediting on absence
// would silently bench champions for our own data problems (the exact failure that made `?? 0` zero a
// whole team from one null champ).

import { affinityMatchup } from './formulas.js';

/** Bracket forms as they appear in Plarium skill text, keyed by our tag name. Only tags that appear
 *  as [Brackets] need an entry; prose capabilities (Healer, Multi-Hit A1, Ally Attack) fall back to
 *  the default uptime and are not chance-gated. */
const TAG_BRACKET = {
  'Decrease Attack': 'Decrease ATK', 'Decrease Defense': 'Decrease DEF',
  'AoE Decrease Defense': 'Decrease DEF', 'Decrease Speed': 'Decrease SPD',
  'Decrease C.Rate': 'Decrease C\\. ?RATE', 'Decrease C.DMG': 'Decrease C\\. ?DMG',
  'Decrease ACC': 'Decrease ACC', 'Increase Defense': 'Increase DEF',
  'Increase RES': 'Increase RES', 'Increase Attack': 'Increase ATK',
  'Increase Speed': 'Increase SPD', 'Increase ACC': 'Increase ACC',
  'Increase C.Rate': 'Increase C\\. ?RATE', 'Increase C.DMG': 'Increase C\\. ?DMG',
  'Continuous Heal': 'Continuous Heal', 'Shield': 'Shield', 'AoE Shield': 'Shield',
  'Ally Protection': 'Ally Protection', 'Block Damage': 'Block Damage',
  'Unkillable': 'Unkillable', 'Block Debuffs': 'Block Debuffs', 'Strengthen': 'Strengthen',
  'Poison': 'Poison', 'HP Burn': 'HP Burn', 'Necrosis': 'Necrosis', 'Weaken': 'Weaken',
  'Provoke': 'Provoke', 'Taunt': 'Taunt', 'Counterattack': 'Counterattack',
  'Perfect Veil': 'Perfect Veil', 'Fatigue': 'Fatigue', 'Poison Sensitivity': 'Poison Sensitivity',
  'Heal Reduction': 'Heal Reduction', 'Magma Shield': 'Magma Shield', 'Stone Skin': 'Stone Skin',
  'Fervor': 'Fervor', 'Intercept': 'Intercept', 'Pain Link': 'Pain Link',

  /* ── CC / control debuffs, added 2026-07-20 ────────────────────────────────────────────────
   * WHY: `tagPlacementSource` can only trace a tag that has a bracket entry, so every tag missing
   * here returned 'unknown' and could never be recognised as passive-placed. 33 of 49 debuff tags
   * were missing — including Stun, Fear, Block Revive — which is most of the CC vocabulary and
   * therefore most of the `crowd_control` / `tm_lock` / `revive_control` buckets.
   *
   * DERIVED FROM THE CORPUS, NOT FROM MEMORY: every form below was extracted from real
   * `champion_skills.skill_summary` text with an occurrence count (Stun x231, Freeze x182,
   * Sleep x105, True Fear x126, Block Buffs x95, Fear x95, Hex x79, Block Active Skills x70,
   * Bomb x49, Petrification x47, Block Revive x22, Decrease RES x20, Sheep x20, Enfeeble x8,
   * Ensnare x7, Block Passive Skills x7, Deathbrand x6, Berserk x4, Infest x2, Nullify x2,
   * Seal x2, Hunter's Gaze x2, Smite x1). Tier-1 skill text is the source, per CLAUDE.md.
   *
   * AoE VARIANTS SHARE THE BASE BRACKET. Plarium writes [Stun] whether it hits one enemy or all —
   * the AoE-ness lives in the surrounding prose ("all enemies"), never in the token. So
   * 'AoE Stun' maps to 'Stun'; a separate '[AoE Stun]' token does not exist and would never match.
   *
   * DELIBERATELY ABSENT (verified to have NO bracket anywhere in the corpus — they are prose
   * effects, and inventing a token would be dead regex): Decrease Turn Meter, AoE Decrease Turn
   * Meter, AoE Decrease Turn Meter (Resistible), Block Cooldowns, Increase Enemy Cooldowns,
   * Increase Debuff Duration, Master Seal. Turn-meter reduction is instant ("decreases the Turn
   * Meter by 30%"), not a debuff that sits on the target. These keep returning 'unknown'. */
  'Stun': 'Stun', 'AoE Stun': 'Stun',
  'Freeze': 'Freeze', 'AoE Freeze': 'Freeze',
  'Sleep': 'Sleep', 'AoE Sleep': 'Sleep',
  'Fear': 'Fear', 'True Fear': 'True Fear',   // NB: 'Provoke' / 'Taunt' are already mapped above
  'Block Revive': 'Block Revive', 'Block Buffs': 'Block Buffs',
  'Block Active Skills': 'Block Active Skills', 'Block Passive Skills': 'Block Passive Skills',
  'Hex': 'Hex', 'Bomb': 'Bomb', 'Petrification': 'Petrification', 'Enfeeble': 'Enfeeble',
  'Sheep': 'Sheep', 'Berserk': 'Berserk', 'Deathbrand': 'Deathbrand', 'Decrease RES': 'Decrease RES',
  'Ensnare': 'Ensnare', 'Infest': 'Infest', 'Nullify': 'Nullify', 'Seal': 'Seal', 'Smite': 'Smite',
  // Apostrophe is permissive: the corpus carries a straight quote, but skill text elsewhere is
  // HTML-escaped in places (e.g. the skill NAME "Death&#x27;s Caress"), so accept either form.
  "Hunter's Gaze": "Hunter['’]s Gaze",
};

const num = (m) => (m ? Number(m[1]) : null);

/**
 * UPTIME for one tag on one champion: what fraction of the fight is this effect actually up?
 *   • placed by an A1 or a passive, or by a skill with no cooldown → 1.0 (every-turn engine)
 *   • otherwise duration ÷ cooldown, capped at 1
 * Takes the BEST provider if several skills place it. Returns 1.0 when nothing parses (capture gap).
 *
 * Books: `assumeBooked` picks `cooldown_booked` over `cooldown_base` where present. Books shorten
 * cooldowns materially (Fahrakin's A3: 6 unbooked → 4 booked = +50% uptime), so this is not cosmetic.
 * Boolean by design — the mobile audience can only supply one "fully booked" checkbox (INS-0033).
 */
export function tagUptime(tag, skillRows = [], { assumeBooked = false } = {}) {
  const bracket = TAG_BRACKET[tag];
  if (!bracket) return 1;                                  // prose capability — not duration-limited
  const re = new RegExp(`\\[${bracket}\\]`, 'i');
  let best = 0, found = false;
  for (const s of skillRows) {
    const txt = s.skill_summary || '';
    if (!re.test(txt)) continue;
    found = true;
    const slot = String(s.slot || '');
    const cd = Number((assumeBooked ? s.cooldown_booked : null) ?? s.cooldown_base) || null;
    if (/^A1/i.test(slot) || /passive/i.test(slot) || !cd) return 1;   // every-turn source
    const dur = num(txt.match(/for (\d+) turns?/)) ?? 2;
    best = Math.max(best, Math.min(1, dur / cd));
  }
  return found ? (best || 1) : 1;                          // absence ⇒ 1.0, never 0
}

/**
 * CHANCE the effect applies at all, from "has a NN% chance of placing a [X]" phrasing.
 * Returns 1 when no chance is stated (guaranteed placement) or nothing parses.
 */
export function tagChance(tag, skillRows = []) {
  const bracket = TAG_BRACKET[tag];
  if (!bracket) return 1;
  const re = new RegExp(`(\\d+)% chance[^.]{0,120}?\\[${bracket}\\]`, 'i');
  let best = 0, found = false;
  for (const s of skillRows) {
    const m = (s.skill_summary || '').match(re);
    if (!m) continue;
    found = true;
    best = Math.max(best, Number(m[1]) / 100);
  }
  return found ? best : 1;
}

/**
 * LAND RATE: does an ACC-gated debuff actually stick? Buffs, heals and shields always apply.
 * Floor of 0.15 mirrors team-constructor — a badly-built champion still contributes something.
 */
export function landRate(tag, champ, tagMeta, accFloor) {
  const meta = tagMeta?.[tag];
  const gated = meta?.is_debuff && !meta?.bypasses_accuracy_check;
  if (!gated || !accFloor) return 1;
  const acc = champ.estimated_stats?.acc ?? champ.acc ?? 0;
  return Math.max(0.15, Math.min(1, acc / accFloor));
}

// ── AFFINITY: the PLACEMENT channel ──────────────────────────────────────────
// GAME FACT (Mike, 2026-07-20; see also lib/formulas.js affinityMatchup). Attacking an enemy of a
// STRONGER affinity: every strike takes a flat 20% damage cut, AND 35% of strikes are "Weak Hits".
// A Weak Hit cannot crit and **cannot place any active-skill debuff** — Poison and HP Burn included.
//
// SO AFFINITY IS NOT A DAMAGE-ONLY TERM. Its biggest effect on this model is that a weak champion
// simply FAILS TO APPLY debuffs on 35% of strikes. That is the same channel as `landRate` ("does the
// debuff actually stick?") and an INDEPENDENT failure mode: a Weak Hit places nothing regardless of
// ACC, and a resisted debuff fails regardless of hit type. Hence multiplied, not merged.
//
// EARLIER WRONG MODEL (recorded so it is not re-derived): Claude first scoped affinity to ATTACK
// damage only, reasoning that a Poison TICK is not an attack and so cannot weak-hit. The tick is
// indeed immune — but the debuff has to be PLACED by a skill hit first, and that placement is
// exactly what a Weak Hit denies. Scoping affinity to damage buckets would have left every DoT
// strategy (Spider poison_explosion / hp_burn, the CB poison teams) untouched by the mechanic that
// hurts them most.
//
// DAMAGE CHANNEL IS DELIBERATELY NOT HERE. Its multiplier is crit-dependent
// (0.196 + 0.52·[(1−c′)+c′·d], c′ = crit−0.15) which ranges ~0.57 (fully crit-built carrier) to
// ~0.72 (no crit) — and crit rate is one of the stats the two stat-ID maps get WRONG (HANDOFF
// 2026-07-20 §4.1: bonus-space id7 is CRATE being routed to `res`). The placement channel below
// touches no corrupted stat, so it ships now; the damage channel waits on the stat-map fix.
export const WEAK_HIT_CHANCE = 0.35;
export const AFFINITY_PLACEMENT_WEAK = 1 - WEAK_HIT_CHANCE; // 0.65

/**
 * Is this tag placed by an ACTIVE skill (weak-hit gated) or a PASSIVE (exempt)?
 * RULED (Mike, 2026-07-20): a passive that places debuffs when an ally/self is ATTACKED — Narma's
 * poisons — never runs an active offensive skill, so no Weak-Hit check occurs. It bypasses affinity
 * entirely and is subject only to ACC vs RES.
 *
 * ATTRIBUTION IS DERIVED, NOT STORED. `champion_tags` has no skill reference (columns are
 * champion_id/tag_id/status/ascension_required/target_type/chance_* — no skill_id), so we recover
 * the source the same way `tagUptime` already does: find the skills whose text carries the tag's
 * bracket and read their `slot`. The proper fix is a `champion_tags.skill_id` column — a gap that
 * has ALREADY bitten once elsewhere (tag policy #15's 2026-07-18 scope note, the Venus/Cupidus
 * seed-182 audit), so it is worth fixing for its own sake, not just for affinity.
 *
 * MIXED IS THE COMMON CASE, NOT AN EDGE CASE (measured 2026-07-20). Both canonical poison champions
 * place the debuff BOTH ways:
 *   • Narma the Returned — A3 Toxin Trance (active, 3 stacks @75%) AND Caustic Rebuttal
 *     (passive, 5% Poison @25% whenever an ally is attacked)
 *   • Xenomorph — A1 Tail Stab (active) AND Caustic Blood (passive, on being attacked)
 * Their ACTIVE copy is weak-hit gated and their PASSIVE copy is exempt, so the truthful factor lies
 * between 0.65 and 1.0 at a ratio we cannot compute: `tagUptime` takes the BEST provider rather than
 * summing per-skill contributions, so there is no per-source share to weight by.
 *
 * RULED HANDLING: `mixed` is penalised as `active` (0.65) — the conservative direction — and reported
 * SEPARATELY from `unknown`, because they are different epistemic states. `mixed` is a case where we
 * KNOW we are over-penalising; `unknown` is one where we cannot tell. Inventing a blend ratio would
 * be exactly the uncalibrated-magnitude habit this codebase keeps flagging.
 *
 * RESIDUAL RISK (bracket matching, the policy #16/#19/#20 error class): a passive that merely
 * MENTIONS a debuff ("immune to [Poison]", "heals when an enemy is under [HP Burn]") matches the
 * regex without placing anything. Mitigated but not eliminated — the champion only reaches this code
 * if the tag layer already decided they DO place the debuff, so a lone passive bracket is very likely
 * the real source. It is not proof.
 *
 * @returns {'active'|'passive'|'mixed'|'unknown'}
 */
export function tagPlacementSource(tag, skillRows = []) {
  const bracket = TAG_BRACKET[tag];
  if (!bracket) return 'unknown';            // prose capability — no bracket to trace
  const re = new RegExp(`\\[${bracket}\\]`, 'i');
  let sawActive = false, sawPassive = false;
  for (const s of skillRows) {
    if (!re.test(s.skill_summary || '')) continue;
    if (/passive/i.test(String(s.slot || ''))) sawPassive = true; else sawActive = true;
  }
  if (sawActive && sawPassive) return 'mixed';
  if (sawActive) return 'active';
  if (sawPassive) return 'passive';          // sole source is a passive ⇒ exempt
  return 'unknown';
}

/**
 * AFFINITY PLACEMENT FACTOR for one tag: 0.65 when a WEAK champion places an active-skill debuff,
 * else 1. Buffs/heals/shields are untouched (a Weak Hit denies DEBUFF placement).
 *
 * CONSERVATIVE ON `unknown` (the file's "absence ⇒ 1.0" convention is DELIBERATELY not followed
 * here, and this is the one place it inverts): an unattributed debuff is assumed ACTIVE, i.e. it
 * IS penalised. Assuming `passive` would silently exempt most of the roster from a 35% mechanic.
 * Callers should surface the assumption rather than hide it — see `affinityPlacementGaps`.
 */
export function affinityPlacementFactor(tag, champ, tagMeta, { bossAffinity = null, skillRows = [] } = {}) {
  if (!bossAffinity) return 1;
  const meta = tagMeta?.[tag];
  if (!meta?.is_debuff) return 1;                                  // only debuff PLACEMENT is denied
  if (affinityMatchup(champ.affinity, bossAffinity) !== 'weak') return 1;
  return tagPlacementSource(tag, skillRows) === 'passive' ? 1 : AFFINITY_PLACEMENT_WEAK;
}

/**
 * How much of `tag` this champion actually DELIVERS, 0..1.
 * SCOPE (Mike, 2026-07-18): a self-only effect protects one seat where a team-wide one protects five,
 * so it is worth ~0.2 of the team-wide equivalent. This is what correctly discounts Gnut's 1.39M of
 * SELF-healing (the team died sooner with him) without anyone having to catch it by hand.
 */
export const SELF_SCOPE = 0.2;

export function tagDelivery(tag, champ, skillRows, tagMeta,
                            { accFloor = null, assumeBooked = false, bossAffinity = null } = {}) {
  const up = tagUptime(tag, skillRows, { assumeBooked });
  const ch = tagChance(tag, skillRows);
  const lr = landRate(tag, champ, tagMeta, accFloor);
  // Affinity placement is a SEPARATE failure mode from land rate — a Weak Hit places nothing
  // whatever the ACC, so the two multiply rather than one superseding the other.
  const af = affinityPlacementFactor(tag, champ, tagMeta, { bossAffinity, skillRows });
  const matchup = bossAffinity ? affinityMatchup(champ.affinity, bossAffinity) : null;
  return {
    uptime: up, chance: ch, land: lr, affinity: af,
    // Reported so callers can NAME the assumption (see affinityPlacementGaps) rather than let a
    // 35% penalty land on an unattributed debuff invisibly.
    affinityMatchup: matchup,
    placementSource: af < 1 ? tagPlacementSource(tag, skillRows) : null,
    delivery: up * ch * lr * af,
  };
}

/**
 * The affinity assumptions a scored team is resting on, for surfacing to the player/advisor.
 * Emits one entry per tag we penalised WITHOUT being able to prove the debuff is active-placed —
 * i.e. every case where a missing `champion_tags.skill_id` may have cost a champion 35% unfairly.
 * Narma-shaped champions (passive placers) are the ones this protects.
 */
export function affinityPlacementGaps(deliveries = []) {
  const pct = d => Math.round((1 - d.affinity) * 100);
  return deliveries
    .filter(d => d.affinity < 1 && (d.placementSource === 'unknown' || d.placementSource === 'mixed'))
    .map(d => d.placementSource === 'mixed'
      ? { champion: d.champion, tag: d.tag, factor: d.affinity, kind: 'mixed',
          why: `${d.champion} places ${d.tag} from BOTH an active skill and a passive. The active `
             + `copy is denied by Weak Hits, the passive copy is not — but we cannot compute the `
             + `split, so the whole delivery takes the ${pct(d)}% penalty. This is KNOWN to be too `
             + `harsh; the true factor is between ${AFFINITY_PLACEMENT_WEAK} and 1.` }
      : { champion: d.champion, tag: d.tag, factor: d.affinity, kind: 'unattributed',
          why: `${d.champion}'s ${d.tag} is assumed placed by an ACTIVE skill, so it is penalised `
             + `${pct(d)}% for the weak affinity matchup. If it is actually placed by a PASSIVE it `
             + `is exempt and this is too harsh — tag→skill attribution is not stored `
             + `(champion_tags has no skill_id).` });
}
