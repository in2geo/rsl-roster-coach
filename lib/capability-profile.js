// lib/capability-profile.js — turn a champion's tags into a magnitude-aware CAPABILITY PROFILE.
//
// Stage 3 of the Archetype Selector (knowledge/ARCHETYPE_SELECTOR_SPEC.md §6). The bucket model
// summed six broad totals; archetypes instead ask "does this champ deliver capability X (e.g.
// decreaseAtk, poison, allyProtection) at coverage ≥ minScore?". This layer produces that per-champ
// map, keyed by CAPABILITY rather than by bucket.
//
// REFACTOR-AND-EXPAND, not rewrite: coverage reuses the validated bucket-magnitude primitives
// (buildScale, affinityPlacementFactor, SELF_SCOPE, tagDelivery). It PREFERS the per-skill
// champion_skill_tags rows (magnitude-carrying: magnitude_pct/stacks/duration/hits/chance) and FALLS
// BACK to the flat champion_tags via tagDelivery for tags not yet populated per-skill (the
// roster-population transition — CONTRIBUTION_MODEL_SPEC.md §6).
//
// INHERITED CONVENTIONS (do not silently break):
//   • coverage EXCLUDES land rate / ACC / gear (Mike 2026-08-01): selection picks by KIT + level;
//     "will the debuff LAND?" is a portable-gear CEILING question, reported as `accGated`, never a
//     coverage penalty. coverage = chance × uptime × affinity × buildScale × scope.
//   • SELF-only effects are discounted by SELF_SCOPE (0.2): they protect one seat, not five.
//   • absence of data ⇒ neutral (1.0), never 0 — a capture gap must not bench a champion.
//
// DELIBERATELY DEFERRED: absolute expected values (expectedHealing in HP, expectedPlacementsPerBoss-
// Turn) need effective stats + a turn model — that is a later enrichment. This layer returns coverage
// (0..1) + raw magnitude/stacks/duration, which is what archetype feasibility + the redundancy rule need.

import { buildScale, SELF_SCOPE, affinityPlacementFactor, tagDelivery } from './bucket-magnitude.js';

const num = (v) => { const m = String(v ?? '').match(/[\d.]+/); return m ? +m[0] : null; };

// ── Capability vocabulary: capabilityKey → the champion_tags/skill tag names that provide it ──
// camelCase keys match the archetype requirement vocabulary (ARCHETYPE_SELECTOR_SPEC.md §6). A few
// keys group several tags (shield ← Shield+AoE Shield; healing ← Healer+AoE Heal; directDamage ←
// Single Target Damage+Multi-Hit A1). `strengthen` is referenced by the protection archetype but is
// NOT a CB bucket tag, so it is only ever filled from the flat champion_tags fallback.
export const CAPABILITY_TAGS = {
  // damage engines
  poison: ['Poison'], hpBurn: ['HP Burn'], poisonCloud: ['Poison Cloud'], necrosis: ['Necrosis'],
  enemyMaxHpDamage: ['Enemy Max HP Damage'], poisonExplosion: ['Poison Explosion'],
  directDamage: ['Single Target Damage', 'Multi-Hit A1'], reflectDamage: ['Reflect Damage'],
  counterattack: ['Counterattack'], allyAttack: ['Ally Attack'],
  // amplification (of DoT or attack damage — the archetype decides which matters for its team type)
  decreaseDef: ['Decrease Defense', 'AoE Decrease Defense'], weaken: ['Weaken'],
  poisonSensitivity: ['Poison Sensitivity'], poisonExtension: ['Increase Debuff Duration'],
  poisonActivation: ['Debuff Activation'], increaseAtk: ['Increase Attack'],
  increaseCRate: ['Increase C.Rate'], increaseCDmg: ['Increase C.DMG'], increaseAcc: ['Increase ACC'],
  // boss-damage suppression / mitigation
  decreaseAtk: ['Decrease Attack'], decreaseCRate: ['Decrease C.Rate'], decreaseCDmg: ['Decrease C.DMG'],
  decreaseAcc: ['Decrease ACC'], fatigue: ['Fatigue'], taunt: ['Taunt'],
  increaseDefense: ['Increase Defense'], increaseRes: ['Increase RES'],
  // protection / sustain
  allyProtection: ['Ally Protection'], shield: ['Shield', 'AoE Shield'], blockDamage: ['Block Damage'],
  unkillable: ['Unkillable'], intercept: ['Intercept'], painLink: ['Pain Link'],
  stoneSkin: ['Stone Skin'], magmaShield: ['Magma Shield'],
  // recovery
  healing: ['Healer', 'AoE Heal'], continuousHeal: ['Continuous Heal'], leech: ['Leech'],
  revive: ['Revive', 'Revive on Death'],
  // stun-plan / cleanse
  cleanse: ['Cleanse'], blockDebuffs: ['Block Debuffs'],
  // tempo
  increaseSpeed: ['Increase Speed'], increaseTurnMeter: ['Increase Turn Meter'], fervor: ['Fervor'],
  resetCooldowns: ['Reset Cooldowns'], decreaseSpeed: ['Decrease Speed'],
  // buff not in CB buckets but named by the protection archetype (fallback-only)
  strengthen: ['Strengthen'],
};

// Capabilities delivered as a DEBUFF on the ENEMY (affinity-Weak-Hit gated; single boss ⇒ AoE scope
// is no better than single, so ally-scope discounting does NOT apply to these).
export const DEBUFF_CAPABILITIES = new Set([
  'poison', 'hpBurn', 'poisonCloud', 'necrosis', 'enemyMaxHpDamage', 'poisonExplosion',
  'decreaseDef', 'weaken', 'poisonSensitivity', 'poisonExtension', 'leech',
  'decreaseAtk', 'decreaseCRate', 'decreaseCDmg', 'decreaseAcc', 'fatigue', 'decreaseSpeed',
]);

export const TAG_TO_CAPABILITY = (() => {
  const m = {};
  for (const [cap, tags] of Object.entries(CAPABILITY_TAGS)) for (const t of tags) (m[t] ??= []).push(cap);
  return m;
})();

// Recipient scope from a skill_tag `condition` string → an ally-scope multiplier. Enemy-side
// capabilities always return 1 (single boss). Self-only ally effects are worth SELF_SCOPE; a
// single-ally target is worth less than an all-ally one.
function scopeFactor(cap, condition) {
  if (DEBUFF_CAPABILITIES.has(cap)) return 1;               // enemy target — boss is single, no discount
  const c = String(condition ?? '').toLowerCase();
  if (/\bself\b/.test(c) && !/all|ally|allies/.test(c)) return SELF_SCOPE;   // self-only buff
  if (/all allies|all all|team/.test(c)) return 1;
  if (/an ally|random ally|target ally|lowest.?hp ally|ally with/.test(c)) return 0.6;  // single ally
  return 1;                                                 // unqualified ⇒ assume team-wide
}

// Uptime for a specific skill slot: A1 / passive / no-cooldown ⇒ 1 (every-turn); else duration/cooldown.
function slotUptime(slot, duration, skillRows, assumeBooked) {
  const s = (slot || '').toString();
  if (/^A1/i.test(s) || /passive/i.test(s)) return 1;
  const row = skillRows.find(r => String(r.slot || '') === s);
  const cd = row ? num(assumeBooked ? (row.cooldown_booked ?? row.cooldown_base) : row.cooldown_base) : null;
  if (!cd) return 1;                                        // no cooldown data ⇒ neutral, never 0
  return Math.min(1, (num(duration) ?? 2) / cd);
}

/**
 * The magnitude-aware capability profile for one champion.
 *
 * @param {object} champ  - { name, affinity, level, stars, tags:[names], has_boss_mastery,
 *                            mastery_tier, book_fraction, is_booked, assume_booked }
 * @param {object} opts
 * @param {object[]} opts.skillTags  - champion_skill_tags rows: { tag, slot, magnitude_pct, stacks,
 *                                      duration_turns, hits, condition, chance_unbooked }
 * @param {object[]} opts.skillRows  - champion_skills rows: { slot, cooldown_base, cooldown_booked, skill_summary }
 * @param {object}   opts.tagMeta    - { [tagName]: { is_debuff, bypasses_accuracy_check } } (for affinity + accGated)
 * @param {string|null} opts.bossAffinity
 * @returns {Object<string, {coverage:number, magnitude:number|null, stacks:number|null,
 *          duration:number|null, hits:number|null, scope:string, accGated:boolean, source:string, tag:string}>}
 */
export function capabilityProfile(champ, { skillTags = [], skillRows = [], tagMeta = {}, bossAffinity = null } = {}) {
  const bs = buildScale(champ);
  const assumeBooked = champ?.assume_booked === true;
  const flatTags = new Set(champ?.tags ?? []);
  const stByTag = {};
  for (const r of skillTags) (stByTag[r.tag] ??= []).push(r);

  const affinityFactor = (tag) =>
    affinityPlacementFactor(tag, champ, tagMeta, { bossAffinity, skillRows });
  const isAccGated = (cap, tag) => {
    const meta = tagMeta?.[tag];
    if (meta) return !!(meta.is_debuff && !meta.bypasses_accuracy_check);
    return DEBUFF_CAPABILITIES.has(cap);                    // no tagMeta ⇒ infer from capability family
  };

  const profile = {};
  for (const [cap, tags] of Object.entries(CAPABILITY_TAGS)) {
    let best = null;
    // PRIMARY: magnitude-aware from champion_skill_tags — one candidate per slot, keep best coverage.
    for (const tag of tags) {
      for (const r of (stByTag[tag] ?? [])) {
        const chance = (num(r.chance_unbooked) ?? 100) / 100;
        const cov = chance * slotUptime(r.slot, r.duration_turns, skillRows, assumeBooked)
                  * affinityFactor(tag) * bs * scopeFactor(cap, r.condition);
        const cand = { coverage: Math.max(0, Math.min(1, cov)), magnitude: r.magnitude_pct ?? null,
                       stacks: r.stacks ?? null, duration: r.duration_turns ?? null, hits: r.hits ?? null,
                       scope: scopeLabel(cap, r.condition), accGated: isAccGated(cap, tag),
                       source: 'skill_tags', tag };
        if (!best || cand.coverage > best.coverage) best = cand;
      }
    }
    // FALLBACK: only when NO skill_tag exists for this capability. Skill_tags are AUTHORITATIVE when
    // present — a prose flat tag (uptime 1, no cooldown grounding) must NOT out-credit the accurate,
    // cd-limited skill_tag (e.g. flat "Healer" 1.00 beating the real A3 "AoE Heal" 0.33).
    if (!best) {
      for (const tag of tags) {
        if (!flatTags.has(tag)) continue;
        const d = tagDelivery(tag, champ, skillRows, tagMeta, { assumeBooked, bossAffinity });
        const cand = { coverage: Math.max(0, Math.min(1, d.delivery)), magnitude: null, stacks: null,
                       duration: null, hits: null, scope: 'unknown', accGated: isAccGated(cap, tag),
                       source: 'flat_tag', tag };
        if (!best || cand.coverage > best.coverage) best = cand;
      }
    }
    if (best) profile[cap] = best;
  }
  return profile;
}

function scopeLabel(cap, condition) {
  if (DEBUFF_CAPABILITIES.has(cap)) return 'enemy';
  const c = String(condition ?? '').toLowerCase();
  if (/\bself\b/.test(c) && !/all|ally|allies/.test(c)) return 'self';
  if (/all allies|all all|team/.test(c)) return 'all_allies';
  if (/an ally|random ally|target ally|lowest.?hp ally|ally with/.test(c)) return 'single_ally';
  return 'all_allies';
}

/** Convenience: does the champ meet `cap` at ≥ minScore? Used by archetype feasibility (Stage 4). */
export function meetsCapability(profile, cap, minScore = 0) {
  const v = profile?.[cap];
  return !!v && v.coverage >= minScore;
}
