// sustain-profiles.js — SUSTAIN TAG RANKING config (Layer 1 support for the watchdog).
//
// WHY THIS FILE EXISTS
// All sustain tags were being treated as equivalent. They are not: Cleanse is
// materially weaker than AoE Shield / Ally Protection on Ice Golem, because a
// mechanism's value depends on the dungeon's THREAT PROFILE. This file holds the
// dungeon-specific tuning (mechanism→threat effectiveness matrix + per-dungeon threat
// severities) OUT of the match engine, so the engine just imports and calls
// `sustainContribution(tags, contentKey)`.
//
// STATUS: Layer 1 — ships without a validation gate. The numbers here are NOMINAL
// (same discipline as lib/damage-mechanics.js §2): the STRUCTURE — which mechanism
// counters which threat, and each dungeon's threat mix — is the authoritative part;
// the magnitudes are directional until calibrated against captured outcomes. The
// watchdog uses these for RELATIVE ranking (benched vs fielded), never as an
// absolute prediction, so nominal magnitudes are safe here.
//
// NOT MODELLED IN v1 (documented boundary): mitigation-family tags — Increase Defense,
// Decrease Attack (on the boss) — are deliberately EXCLUDED from sustain scoring. Their
// effectiveness is threat-MECHANIC-specific in a way the coarse spike/debuff/sustained
// threat types can't yet express: Increase DEF does NOTHING against a DEF-ignoring spike
// (e.g. Ice Golem's Frigid Vengeance), so crediting it against `spike_damage` would be
// exactly the kind of false credit this layer exists to prevent. Add them once threat
// profiles can encode "DEF-ignoring" as an attribute of the spike.

// ---------------------------------------------------------------------------
// 1. SUSTAIN MECHANISM HIERARCHY — strongest→weakest at NEUTRALIZING a threat.
// ---------------------------------------------------------------------------
// Ordering is the GENERAL hierarchy; the per-dungeon threat weighting (§3) is what
// makes it content-specific ("this hierarchy is not universal"). Prevention stops a
// threat before it lands; Recovery only acts after a champion is already dead.
export const MECHANISMS = ['prevention', 'absorption', 'restoration', 'removal', 'recovery'];

// Which sustain tags belong to which mechanism. Tag names match the live `tags` vocab.
// A tag can only map to ONE mechanism (its dominant character).
export const TAG_TO_MECHANISM = {
  // 1. Prevention — the threat never lands.
  'Block Debuffs': 'prevention',
  // 2. Absorption — a spike is soaked before HP is lost.
  'AoE Shield': 'absorption',
  'Shield': 'absorption',
  'Ally Protection': 'absorption',
  'Block Damage': 'absorption',
  'Unkillable': 'absorption',
  // 3. Restoration — HP repaired after damage lands.
  'Continuous Heal': 'restoration',
  'Heal': 'restoration',
  'AoE Heal': 'restoration',
  'Healer': 'restoration',
  'Leech': 'restoration',
  // 4. Removal — a debuff removed AFTER it lands (damage already done).
  'Cleanse': 'removal',
  // 5. Recovery — champion already dead.
  'Revive': 'recovery',
};

// ---------------------------------------------------------------------------
// 2. MECHANISM ⇄ THREAT-TYPE EFFECTIVENESS MATRIX (0..1).
// ---------------------------------------------------------------------------
// "If a dungeon's danger is of THREAT_TYPE, how well does MECHANISM neutralize it?"
// 1.0 = definitively neutralizes; ~0.1 = barely touches it. Reading the rows encodes
// the hierarchy: Prevention dominates `debuff`; Absorption dominates `spike_damage`;
// Restoration dominates `sustained_damage`; Removal (Cleanse) is a weaker `debuff`
// answer than Prevention (the debuff already landed); Recovery is reactive everywhere.
export const THREAT_TYPES = ['spike_damage', 'debuff', 'sustained_damage'];

export const MECHANISM_EFFECTIVENESS = {
  //             spike  debuff  sustained
  prevention:  { spike_damage: 0.15, debuff: 1.00, sustained_damage: 0.15 },
  absorption:  { spike_damage: 1.00, debuff: 0.20, sustained_damage: 0.70 },
  restoration: { spike_damage: 0.45, debuff: 0.10, sustained_damage: 1.00 },
  removal:     { spike_damage: 0.10, debuff: 0.65, sustained_damage: 0.25 },
  recovery:    { spike_damage: 0.40, debuff: 0.10, sustained_damage: 0.20 },
};

// ---------------------------------------------------------------------------
// 3. DUNGEON THREAT PROFILES — severity of each threat type per content (0..3).
// ---------------------------------------------------------------------------
// HIGH=3 / MEDIUM=2 / LOW=1 / NONE=0. These say WHAT KIND of danger each dungeon poses,
// which reweights the mechanism hierarchy for that content. Calibrate against captures.
const H = 3, M = 2, L = 1, N = 0;

export const THREAT_PROFILES = {
  // Ice Golem — Frigid Vengeance is a DEF-ignoring AoE spike (the primary kill vector);
  // minion debuffs (Freeze) are dangerous but blockable; little steady chip damage. So
  // Absorption (soaks the spike) and Prevention (blocks the Freeze) both rank high, while
  // Cleanse (Removal) is weak — it can't touch the spike and only clears debuffs post-hit.
  ice_golem:   { spike_damage: H, debuff: M, sustained_damage: L },
  // Spider's Den — primary damage is Poison (a DoT DEBUFF); spikes are minor. Cleanse
  // (Removal) is strong here because removing the poison directly cuts incoming damage —
  // the mechanism matches the threat, unlike on Ice Golem.
  spider:      { spike_damage: L, debuff: H, sustained_damage: M },
  // Fire Knight — the danger is the shield-break failure loop → compounding Max HP loss
  // (a sustained/attrition threat) plus his debuffs (Decrease ATK, Poison+Weaken). No
  // single one-shot spike on the team the way IG has.
  fire_knight: { spike_damage: L, debuff: M, sustained_damage: H },
  // Dragon's Lair — Scorch/Stun + the boss's debuffs (Decrease ATK, Poison, Weaken) are
  // the main danger (debuff-heavy); steady breath damage is a secondary attrition threat.
  dragon:      { spike_damage: M, debuff: H, sustained_damage: M },
  // Clan Boss — long attrition fight (steady AoE) is the dominant survival threat; its
  // debuffs matter but the fight is won/lost on outlasting sustained damage over many turns.
  clan_boss:   { spike_damage: M, debuff: M, sustained_damage: H },
  // Campaign / generic fallback — mild, balanced. Sustain matters little.
  campaign:    { spike_damage: L, debuff: L, sustained_damage: L },
  event_dungeon: { spike_damage: M, debuff: M, sustained_damage: M },
};

// Fallback profile for any content without an explicit entry — balanced-medium, so a
// support still earns some sustain credit rather than dropping to zero.
export const DEFAULT_THREAT_PROFILE = { spike_damage: M, debuff: M, sustained_damage: M };

export function threatProfileFor(contentKey) {
  return THREAT_PROFILES[contentKey] ?? DEFAULT_THREAT_PROFILE;
}

/**
 * How "sustain-hungry" a content is overall (0..1), = total threat severity / max
 * possible. The watchdog uses this to weight the sustain term UP on threatening
 * content and DOWN on easy content ("sustain weighted by content threat").
 */
export function contentThreatWeight(contentKey) {
  const p = threatProfileFor(contentKey);
  const total = THREAT_TYPES.reduce((s, t) => s + (p[t] ?? 0), 0);
  const max = THREAT_TYPES.length * H; // all-HIGH
  return max ? total / max : 0;
}

// ---------------------------------------------------------------------------
// 4. COMPOSITE SUSTAIN SCORE.
// ---------------------------------------------------------------------------
/**
 * sustain_contribution = Σ over the champ's sustain tags:
 *   Σ over threat types: effectiveness[mechanism][threat] × severity[content][threat]
 *
 * For each sustain tag a champion brings, sum how well its mechanism counters each of
 * the dungeon's threat types (weighted by how severe that threat is here). A champ with
 * Block Debuffs on Ice Golem scores high on the `debuff` term; a Cleanse-only champ on
 * Ice Golem scores low (its mechanism barely touches the dominant spike). Multiple
 * distinct mechanisms stack (they cover different threats); duplicate mechanisms are
 * counted once per DISTINCT mechanism to avoid double-crediting two heals as two roles.
 *
 * @param {string[]} tags champion_tags names
 * @param {string} contentKey e.g. 'ice_golem'
 * @returns {{ score:number, mechanisms:string[], byTag:Array<{tag,mechanism,value}> }}
 */
export function sustainContribution(tags = [], contentKey) {
  const profile = threatProfileFor(contentKey);
  const seenMechanisms = new Set();
  const byTag = [];
  let score = 0;
  for (const tag of tags) {
    const mech = TAG_TO_MECHANISM[tag];
    if (!mech) continue;
    // Count each DISTINCT mechanism once — a champ with two heal tags is one restorer,
    // not two. Different mechanisms (heal + shield) DO stack: they cover different threats.
    if (seenMechanisms.has(mech)) { byTag.push({ tag, mechanism: mech, value: 0 }); continue; }
    seenMechanisms.add(mech);
    const eff = MECHANISM_EFFECTIVENESS[mech];
    let value = 0;
    for (const t of THREAT_TYPES) value += (eff[t] ?? 0) * (profile[t] ?? 0);
    score += value;
    byTag.push({ tag, mechanism: mech, value });
  }
  return { score, mechanisms: [...seenMechanisms], byTag };
}

/** True if a tag is a sustain tag this module scores (used for role narration). */
export function isSustainTag(tag) {
  return Object.prototype.hasOwnProperty.call(TAG_TO_MECHANISM, tag);
}

// ---------------------------------------------------------------------------
// 5. CROWD CONTROL — survival by denying the ENEMY turns (INS-0004).
// ---------------------------------------------------------------------------
// CC is the third survival lever: sustain extends YOUR turns, speed buys them faster, CC
// REMOVES the enemy's. Fewer enemy actions = less incoming damage. The coverage engine
// already knows CC (goal requirements, checkCCSustain, the CB stun matrix); this gives the
// CONTRIBUTION/WATCHDOG composite the same awareness, so a pure control support (e.g. Lord
// Entertainer Fabian) stops scoring 0. Magnitudes nominal.
//
// TWO parts, deliberately split so CC-IMMUNITY survives normalization:
//   • controlStrength(tags) — content-INDEPENDENT: how much control the champ's kit brings.
//   • ccEffectiveness(content) — a per-content 0..1 factor applied as a WEIGHT, baking in boss
//     CC-IMMUNITY + presence of controllable adds. This is the key guardrail from INS-0004:
//     it discounts CC on single-target CC-immune content (Clan Boss ~0.15) while crediting it
//     where adds/minions matter (Spider spiderlings 0.8, Ice Golem reviving minions 0.7). Coarse
//     proxy for structured per-phase immunity — a future refinement, but enough to avoid the
//     false-positive of crediting CC against an immune boss.
export const CC_CONTROL_TAGS = {
  // AoE hard CC — controls the whole enemy side (strongest, esp. vs adds).
  'AoE Stun': 1.0, 'AoE Freeze': 1.0, 'AoE Sleep': 0.9,
  // Single-target hard CC — the target can't act (or acts against itself).
  'Stun': 0.6, 'Freeze': 0.6, 'Sleep': 0.55, 'Petrification': 0.6, 'True Fear': 0.6,
  'Provoke': 0.5, 'Fear': 0.5,
  // Soft control — slows rather than stops.
  'AoE Decrease Turn Meter': 0.5, 'AoE Decrease Turn Meter (Resistible)': 0.4, 'Decrease Turn Meter': 0.3,
};

export const CC_EFFECTIVENESS = {
  ice_golem: 0.70, spider: 0.80, fire_knight: 0.50, dragon: 0.40,
  clan_boss: 0.15, campaign: 0.70, event_dungeon: 0.50,
};
export const DEFAULT_CC_EFFECTIVENESS = 0.5;
export function ccEffectiveness(contentKey) {
  return CC_EFFECTIVENESS[contentKey] ?? DEFAULT_CC_EFFECTIVENESS;
}

/** Content-independent control strength from a champ's CC tags (distinct, capped). */
export function controlStrength(tags = []) {
  let s = 0; const seen = new Set();
  for (const t of tags) if (CC_CONTROL_TAGS[t] && !seen.has(t)) { seen.add(t); s += CC_CONTROL_TAGS[t]; }
  return Math.min(1.2, s); // stacking many CC tools has diminishing marginal control
}

export function isControlTag(tag) {
  return Object.prototype.hasOwnProperty.call(CC_CONTROL_TAGS, tag);
}
