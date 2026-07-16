// damage-mechanics.js — AUTHORITATIVE damage-source ⇄ debuff interaction rules.
//
// WHY THIS FILE EXISTS
// These are GAME FACTS (how Raid's damage formula works), not battle-calibrated
// numbers. They are the single source of truth for the question the contribution
// model must answer: "does debuff X actually multiply damage source Y?" Getting
// this wrong makes the engine credit a support for damage it never added — the
// exact error that produced a wrong explanation on 2026-07-14 (Uugo's 60%
// Decrease DEF was described as amplifying Xenomorph's Poison; it does NOT).
//
// Because these are facts (not calibration), they are allowed to become a MODEL
// RULE — CLAUDE.md reasoning-discipline #4 ("a single battle changes a tag-of-fact
// at most, never a model rule") does NOT block encoding a published mechanic. What
// #4 still blocks is tuning the nominal multiplier magnitudes below off a couple of
// runs; those stay nominal until calibrated against many captures.
//
// CONSUMERS: cb-damage-model.js (today, via `damageSourceIgnoresDef`) and the
// forthcoming granular contribution model (per-champion contribution = own damage
// + debuff multipliers it grants the team + sustain it grants the team).

// ---------------------------------------------------------------------------
// 1. DAMAGE SOURCE TAXONOMY — what each source scales off, and its DEF-dependence.
// ---------------------------------------------------------------------------
// `scalesOff` drives everything: only `atk_vs_def` sources run the attacker's ATK
// against the target's DEF, so ONLY those are affected by DEF shred / DEF-ignore.
// Everything that scales off the target's MAX HP is DEF-INDEPENDENT.
export const DAMAGE_SOURCES = {
  // %-of-enemy-MAX-HP damage-over-time and mastery damage. DEF-INDEPENDENT.
  poison:       { scalesOff: 'enemy_max_hp', defDependent: false, perTurn: true,  label: 'Poison' },
  hp_burn:      { scalesOff: 'enemy_max_hp', defDependent: false, perTurn: true,  label: 'HP Burn' },
  warmaster:    { scalesOff: 'enemy_max_hp', defDependent: false, perTurn: true,  label: 'Warmaster / Giant Slayer' },
  enemy_maxhp:  { scalesOff: 'enemy_max_hp', defDependent: false, perTurn: false, label: 'Enemy Max HP nuke' },
  // Direct-attack skill damage: attacker ATK vs target DEF. DEF-DEPENDENT — this is
  // the ONLY family that Decrease DEF / [DEF-ignore] / Weaken amplify.
  attack:       { scalesOff: 'atk_vs_def',   defDependent: true,  perTurn: false, label: 'Direct attack (ATK vs DEF)' },
  // Fixed / true damage: ignores DEF by definition.
  fixed:        { scalesOff: 'fixed',        defDependent: false, perTurn: false, label: 'Fixed / true damage' },
};

/** True if this damage source ignores DEF entirely (so DEF shred can NEVER boost it). */
export function damageSourceIgnoresDef(source) {
  const s = DAMAGE_SOURCES[source];
  return s ? !s.defDependent : false; // unknown source → assume DEF-independent (safer: don't over-credit shred)
}

// Map champion_tags damage tags → the source family above (shared vocabulary with
// cb-damage-model.js TAG_SOURCE; keep the two in sync).
export const TAG_TO_SOURCE = {
  'Poison': 'poison',
  'HP Burn': 'hp_burn',
  'Enemy Max HP Damage': 'enemy_maxhp',
  // AoE Damage / single-target nukes are `attack` unless the skill text says %maxHP.
  'AoE Damage': 'attack',
};

// ---------------------------------------------------------------------------
// 2. DEBUFF ⇄ DAMAGE-SOURCE INTERACTION MATRIX — the load-bearing rules.
// ---------------------------------------------------------------------------
// The rule that must factor into every team score: a debuff only multiplies the
// sources listed in `affects`. `magnitude` is NOMINAL (uncalibrated) — do not tune
// off a handful of runs. `affects: []` means the debuff adds ZERO damage (its value
// is elsewhere: CC, utility, protection).
export const DEBUFF_DAMAGE_INTERACTIONS = {
  // Decrease DEF: reduces target DEF → boosts ATK-vs-DEF attacks ONLY. ZERO effect
  // on Poison / HP Burn / Warmaster (all %maxHP). A poison/HP-burn team gets almost
  // nothing from it. Evidence: DonBrogni CB 2026-07-14 — team damage was Xenomorph
  // Poison+Warmaster (~5-7M) + Underpriest Brogni/Ninja HP Burn; Uugo's 60% Decrease
  // DEF touched only the small direct-attack slice (Ezio's hits, her own).
  'Decrease Defense': { affects: ['attack'], magnitude: 'high', note: '60% shred ≈ big multiplier on ATTACK damage; NIL on %maxHP DoT.' },
  // [DEF-ignore] on a skill: same family as Decrease DEF — attack only.
  'Ignore Defense':   { affects: ['attack'], magnitude: 'high', note: 'Attack damage only; does nothing to %maxHP DoT.' },
  // Weaken: increases damage the target RECEIVES. CONFIRMED for attack damage.
  // Its interaction with %maxHP DoT is NOT yet verified in-project — do NOT assume it
  // boosts Poison/HP Burn. Left out of `affects` for DoT until confirmed from skill/mechanic text.
  'Weaken':           { affects: ['attack'], magnitude: 'medium', note: 'Attack damage confirmed. Poison/HP-Burn interaction UNVERIFIED — do not credit against DoT yet.' },
  // Poison Sensitivity: increases damage the target takes FROM Poison debuffs (25%/stack
  // in our data; stacks). The poison analogue of Decrease DEF — a NON-DEF multiplier that
  // amplifies the %maxHP `poison` source, so it scales a poison team EVEN at the 10-stack
  // cap. This is the one mechanic that breaks "10 stacks = flat ceiling" (§6). Confirmed
  // 2026-07-14 from skill text (Da Vinci, Frozen Banshee line, Jaguar-types).
  'Poison Sensitivity': { affects: ['poison'], magnitude: 'medium', note: 'Amplifies %maxHP poison damage; scales a poison team at the stack cap. NON-DEF multiplier.' },
  // Debuffs with NO damage-multiplier role — value is utility, never a damage credit.
  'Decrease Attack':  { affects: [], magnitude: 'none', note: 'Defensive (cuts boss damage OUT), not a team damage multiplier.' },
  'Decrease Speed':   { affects: [], magnitude: 'none', note: 'Tempo/CC. No damage multiplier.' },
  'Block Buffs':      { affects: [], magnitude: 'none', note: 'Denies boss buffs. No damage multiplier.' },
};

const NOMINAL_MULT = { high: 1.5, medium: 1.25, low: 1.1, none: 1.0 };

// Structural enforcement of §1: a DEF-shred debuff must ONLY affect DEF-dependent
// sources. Because the matrix (not a runtime special case) carries this, a DEF-shred
// debuff can never multiply a %maxHP source, while a NON-DEF multiplier (Poison
// Sensitivity → poison) works naturally. Fails loud if the matrix ever violates it.
for (const defShred of ['Decrease Defense', 'Ignore Defense']) {
  const r = DEBUFF_DAMAGE_INTERACTIONS[defShred];
  if (r && r.affects.some(s => damageSourceIgnoresDef(s)))
    throw new Error(`damage-mechanics: ${defShred} must not affect a DEF-independent (%maxHP) source — violates §1.`);
}

/**
 * Nominal multiplier a set of active team debuffs grants to ONE damage source.
 * Returns 1.0 (no effect) unless a debuff explicitly `affects` this source. DEF
 * shred can't reach %maxHP sources because its `affects` never lists them.
 * Magnitudes are placeholders pending calibration — the STRUCTURE (which debuff
 * touches which source) is the authoritative part, the numbers are not.
 */
export function debuffDamageMultiplier(source, activeDebuffTags = []) {
  let m = 1;
  for (const d of activeDebuffTags) {
    const rule = DEBUFF_DAMAGE_INTERACTIONS[d];
    if (rule && rule.affects.includes(source)) m *= NOMINAL_MULT[rule.magnitude] ?? 1;
  }
  return m;
}

// ---------------------------------------------------------------------------
// 3. SUSTAIN IS MULTIPLICATIVE (not additive).
// ---------------------------------------------------------------------------
// Keeping the team alive N extra turns multiplies EVERY per-turn damage source
// (Poison / HP Burn / Warmaster and every extra attack turn) by those added turns.
// So a heal/cleanse/shield support's contribution ≈ (added survival turns) × (team
// per-turn output), which for a DoT team routinely dwarfs the support's own damage.
// This is the correct lens for the two-sided confidence calc: kill-speed vs
// survival-time, where a support shifts the survival side.
//
// EVIDENCE (DonBrogni CB, 2026-07-14):
//   Run A (Bad-el-Kazar, sustain support): 10.66M over 135 turns.
//   Run B (Ninja, damage, sustain removed):  9.19M over 115 turns.
//   The "stronger" damage swap did WORSE: −20 turns of survival cut ~2.17M of
//   Xenomorph Poison — more than Ninja's own damage added. Sustain > raw damage here.
export const SUSTAIN_IS_MULTIPLICATIVE = true;

/** Rough per-turn team output lost/gained by ±deltaTurns of survival. */
export function survivalDamageDelta(teamPerTurnDamage, deltaTurns) {
  return (teamPerTurnDamage ?? 0) * (deltaTurns ?? 0);
}

// ---------------------------------------------------------------------------
// 3b. SPEED / TURN-METER BUFFS ARE MULTIPLICATIVE — the TWIN of §3.
// ---------------------------------------------------------------------------
// Speed = turn frequency. A team-wide [Increase SPD] buff (and [Increase Turn Meter])
// gives every ally MORE TURNS over a time-budgeted fight, which multiplies EVERY
// per-turn source — poison applications, HP-Burn refreshes, attack turns — exactly the
// way surviving N extra turns does (§3). Sustain adds turns by keeping you alive; a
// speed buff adds turns by making them come faster. Both are team-turn multipliers.
// It also improves the SURVIVAL side (more turn-meter → act before the boss). So a
// pure-support speed-buffer (e.g. Apothecary: Bless = [Increase SPD] all allies) whose
// own damage bar reads ~1% can be worth a large share of the team's output — the §4
// "per-hero damage understates support value" trap, again.
//
// Coverage-scoring is blind to this: [Increase Speed] only counts where a goal happens
// to require it (Fire Knight shield-break), and earns NOTHING on Clan Boss / DoT dungeons
// where it is arguably most valuable. The contribution model must treat it as a
// team-turn multiplier and attribute the granted throughput back to the buffer.
//
// Buffs REFRESH, they don't stack — two allies both casting [Increase SPD] is not 2×, so
// count each turn-multiplier tag ONCE for the team (presence-based), not per-champion.
// Magnitudes NOMINAL (uncalibrated), like every other number in this file.
// NOMINAL throughput lift, NOT raw SPD %. A +30% [Increase SPD] buff does NOT become +30%
// damage — turn-order overlap, buff uptime, and the boss also acting eat into it — so the
// initial nominal is deliberately conservative (game-knowledge estimate, not battle-tuned).
// This is the PRIMARY calibration target for this mechanic; do not tune it off a few runs.
export const TURN_MULTIPLIER_TAGS = {
  'Increase Speed':      0.20, // team-turn throughput lift (nominal, conservative)
  'Increase Turn Meter': 0.10, // extra actions from TM fill (nominal; varies by kit)
};
export const TURN_MULTIPLIER_CAP = 0.35; // cap total team-turn lift (avoid runaway stacking)
export const SPEED_IS_MULTIPLICATIVE = true;

/**
 * Team-turn multiplier from the speed/turn-meter buffs PRESENT on the team, with the
 * providers of each tag (for attribution). Presence-based (buffs refresh, don't stack).
 * @returns {{ multiplier:number, lift:number, providers:Record<string,string[]> }}
 *   multiplier = 1 + capped lift; providers maps tag → owner names.
 */
export function teamTurnMultiplier(team = []) {
  const providers = {};
  for (const c of team) for (const tag of (c.tags ?? [])) {
    if (TURN_MULTIPLIER_TAGS[tag]) (providers[tag] ??= []).push(c.name);
  }
  let lift = 0;
  for (const tag of Object.keys(providers)) lift += TURN_MULTIPLIER_TAGS[tag];
  lift = Math.min(TURN_MULTIPLIER_CAP, lift);
  return { multiplier: 1 + lift, lift, providers };
}

// ---------------------------------------------------------------------------
// 4. PER-HERO DAMAGE UNDERSTATES SUPPORT VALUE.
// ---------------------------------------------------------------------------
// A support's contribution — debuff multipliers it grants, sustain it grants, CC —
// shows up in OTHER champions' damage bars, never its own. Ranking or judging a
// support by captured per-hero damage (Uugo ~2%, Bad-el-Kazar low) systematically
// undervalues it. The contribution model must attribute granted-multiplier and
// granted-survival back to the support, not read its raw bar. Corollary: the
// engine can pick a support for the RIGHT tag but the WRONG reason — e.g. Uugo
// picked for Decrease DEF on a Poison team, where her real value is her heal.
export const RAW_DAMAGE_UNDERSTATES_SUPPORT = true;

// ---------------------------------------------------------------------------
// 5. DEBUFF VALUE IS CONDITIONAL ON THE TEAM'S DAMAGE TYPE (headline rule).
// ---------------------------------------------------------------------------
// Team selection / explanation must weigh a damage-debuff by what the team's
// damage actually IS: Decrease DEF is a top-tier multiplier for an ATTACK/nuke
// team and near-worthless for a Poison/HP-Burn team. A DoT team scales instead
// with (a) more DoT stacks and (b) more survival turns (see §3), NOT DEF shred.
/**
 * How much a candidate debuff is worth to a team, given the team's damage-source mix.
 * @param {string} debuffTag e.g. 'Decrease Defense'
 * @param {string[]} teamDamageSources source families the team actually deals in, e.g. ['poison','hp_burn']
 * @returns {'high'|'medium'|'low'|'none'} nominal value class
 */
export function debuffValueForTeam(debuffTag, teamDamageSources = []) {
  const rule = DEBUFF_DAMAGE_INTERACTIONS[debuffTag];
  if (!rule || rule.affects.length === 0) return 'none';
  const hits = teamDamageSources.some(s => rule.affects.includes(s));
  return hits ? rule.magnitude : 'none'; // affects nothing this team deals → worthless HERE
}

// ---------------------------------------------------------------------------
// 6. DAMAGE-SOURCE SATURATION — stack caps make DoT throughput non-linear.
// ---------------------------------------------------------------------------
// Poison caps at 10 stacks per target; HP Burn does NOT stack (1 per target). So
// poison-throughput has a SATURATING value curve (steep until the team can hold
// ~10 stacks, ~flat after) and an Nth poisoner / 2nd HP-Burner past the maintenance
// point adds ~nothing to the DoT. THE EXCEPTION is Poison Sensitivity (see the
// matrix): it multiplies per-stack poison damage, so it scales a poison team even
// AT the cap — the one mechanic that breaks "10 stacks = flat ceiling".
export const SOURCE_STACK_CAP = { poison: 10, hp_burn: 1 };

/**
 * Saturating value multiplier for adding MORE of a stacking DoT source, given the
 * stacks the team can already reliably maintain. ~1 while below cap, →0 at cap.
 * Nominal shape; calibrate against captures. (Poison Sensitivity is modeled
 * separately as a multiplier, not here — it lifts the ceiling this function caps.)
 */
export function saturationValue(source, activeStacks = 0) {
  const cap = SOURCE_STACK_CAP[source];
  if (!cap) return 1;                 // not stack-limited
  if (activeStacks >= cap) return 0;  // saturated — more of this source adds nothing
  return (cap - activeStacks) / cap;
}

// ---------------------------------------------------------------------------
// 7. RELIABILITY × UPTIME — a debuff is only worth how often it lands and how
//    many turns it's active. This term multiplies EVERY debuff contribution in
//    the Layer 2 formula, and drives the Layer 1 reliability guardrail (§8).
//    reliability_factor = chance × (uptime_turns / fight_turns) × auto-reliability.
// ---------------------------------------------------------------------------
export const RELIABILITY_THRESHOLD = 0.35; // below this → "unreliable on auto" warning

/** Turns a debuff is active over a fight, from duration + cooldown. null if unknowable. */
export function estimateUptimeTurns({ durationTurns, cooldownTurns, fightTurns }) {
  if (fightTurns == null || durationTurns == null) return null;
  if (cooldownTurns == null || cooldownTurns <= durationTurns) return fightTurns; // ~permanent
  return fightTurns * (durationTurns / cooldownTurns);
}

/**
 * @returns {{factor:number|null, confidence:'measured'|'partial'|'unknown', missing:string[]}}
 * factor is null when it CAN'T be assessed (confidence 'unknown') — callers MUST NOT
 * silently treat that as 1.0 (that is the overvaluation this term exists to prevent).
 */
export function reliabilityFactor({ chance, durationTurns, cooldownTurns, fightTurns, autoReliable = null }) {
  const missing = [];
  if (chance == null) missing.push('chance');
  if (durationTurns == null) missing.push('duration');
  if (autoReliable == null) missing.push('auto_reliable');
  const uptime = estimateUptimeTurns({ durationTurns, cooldownTurns, fightTurns });
  if (chance == null || uptime == null || fightTurns == null)
    return { factor: null, confidence: 'unknown', missing };
  const autoPenalty = autoReliable === false ? 0.5 : 1; // nominal auto-cast penalty
  const factor = (chance / 100) * Math.min(1, uptime / fightTurns) * autoPenalty;
  return { factor, confidence: missing.length ? 'partial' : 'measured', missing };
}

// ---------------------------------------------------------------------------
// 8. LAYER 1 GUARDRAIL — audit a recommended team's damage-debuffs for
//    (a) damage-type mismatch (§2/§5) and (b) reliability (§7). Pure; degrades
//    gracefully: emits a 'reliability_unknown' finding where inputs aren't captured
//    (so the feedback loop tracks the data gap instead of silently full-crediting).
// ---------------------------------------------------------------------------
const MULTIPLIER_DEBUFFS = Object.entries(DEBUFF_DAMAGE_INTERACTIONS)
  .filter(([, r]) => r.affects.length > 0).map(([tag]) => tag);

/** The source families a team actually deals damage in, from its members' tags. */
export function teamDamageSources(team = []) {
  const s = new Set();
  for (const c of team) for (const t of (c.tags ?? [])) {
    const src = TAG_TO_SOURCE[t]; if (src) s.add(src);
  }
  return [...s];
}

/**
 * @param {Array} team [{ name, tags[], debuffMeta?: { [tag]: {chance,durationTurns,cooldownTurns,autoReliable} } }]
 * @param {object} opts { fightTurns?, damageSources? (override the tag-derived set) }
 * @returns {Array} [{ champion, tag, kind, detail, factor?, missing? }]
 *   kind: 'damage_type_mismatch' | 'low_reliability' | 'reliability_unknown'
 */
export function auditTeamDebuffs(team = [], { fightTurns = null, damageSources = null } = {}) {
  const sources = damageSources ?? teamDamageSources(team);
  const out = [];
  for (const c of (team ?? [])) {
    for (const tag of (c.tags ?? [])) {
      if (!MULTIPLIER_DEBUFFS.includes(tag)) continue;
      // (a) damage-type mismatch — this debuff multiplies nothing the team deals.
      if (debuffValueForTeam(tag, sources) === 'none') {
        out.push({ champion: c.name, tag, kind: 'damage_type_mismatch',
          detail: `${tag} multiplies ${DEBUFF_DAMAGE_INTERACTIONS[tag].affects.join('/')} damage, but this team deals ${sources.length ? sources.join('/') : 'no tagged'} damage — it adds ~nothing to the team's output here.` });
        continue; // worthless here → don't bother assessing its reliability
      }
      // (b) reliability × uptime.
      const rel = reliabilityFactor({ ...(c.debuffMeta?.[tag] ?? {}), fightTurns });
      if (rel.confidence === 'unknown')
        out.push({ champion: c.name, tag, kind: 'reliability_unknown', missing: rel.missing,
          detail: `Can't assess how reliably ${c.name} keeps ${tag} up (not captured: ${rel.missing.join(', ')}).` });
      else if (rel.factor != null && rel.factor < RELIABILITY_THRESHOLD)
        out.push({ champion: c.name, tag, kind: 'low_reliability', factor: rel.factor,
          detail: `${c.name}'s ${tag} is only ~${Math.round(rel.factor * 100)}% reliable (land-chance × uptime) — weak to lean on for this role on auto.` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 9. DAMAGE MITIGATION & PROTECTION — the survival side (what cuts incoming
//    damage, and how cuts combine). Feeds the SURVIVE problem / survival calc.
//    Facts distilled from the keyword glossary (data/keyword-glossary.json).
// ---------------------------------------------------------------------------
// The two load-bearing flags for team selection:
//   • damageType — WHICH incoming damage a mechanic actually mitigates. 'direct' =
//     instant attack hits ONLY; a direct-only mechanic does NOTHING against DoT
//     (Poison/HP Burn) or self-damage. 'all' = every source (incl. DoT).
//   • stacks — whether a 2nd copy adds value ('override' = only one matters).
// This is why a tag alone over-credits: `Ally Protection` reads as generic sustain,
// but it only helps vs DIRECT damage and does not stack — the glossary carries that.
export const PROTECTION_MECHANICS = {
  // Ally Protection: caster eats 25/50% of DIRECT damage to the protected ally. The
  // transfer is RAW (ignores the ally's DEF/passives/buffs/masteries) but is then cut
  // by the CASTER's own DEF — so a protector wants HIGH DEF/HP and crit stats are
  // WASTED. Poison/HP Burn/self-damage do NOT transfer. Does NOT stack (override).
  'Ally Protection': { damageType: 'direct', stacks: 'override', protectorBuild: 'high DEF/HP; crit wasted (transfer is raw)',
    note: 'Credit vs DIRECT-damage threats (Ice Golem Frigid Vengeance, Fyro nuke); ZERO vs a pure-DoT boss. A 2nd protector is wasted.' },
  'Shield':       { damageType: 'direct', stacks: 'override', note: 'Absorbs hits (unless ignored). Damage to the Shield ≠ damage to the champ (Lifesteal does not benefit).' },
  'Block Damage': { damageType: 'all',    stacks: 'refresh',  note: 'Immune to ALL damage for the duration (incl. DoT).' },
  'Unkillable':   { damageType: 'all',    stacks: 'refresh',  note: 'Cannot drop below 1 HP — outlasts even DoT for the duration.' },
};

// Damage-reduction sources COMBINE MULTIPLICATIVELY, not additively. Three Guardian
// Sets at 10% each = 0.9³ = 27.1% reduction (NOT 30%); position-ordered reductions
// (Guardian Set, Duchess Lilitu-style passives) compound the same way. Modeling them
// additively OVER-credits mitigation — the survival-side twin of the §1 over-credit trap.
export const MITIGATION_STACKS_MULTIPLICATIVELY = true;

/** Combine fractional damage reductions multiplicatively → net fraction of damage TAKEN. */
export function combinedDamageTaken(reductions = []) {
  return reductions.reduce((taken, r) => taken * (1 - (r ?? 0)), 1);
}

/**
 * Does a protection mechanic mitigate this incoming damage type?
 * @param {string} mechanicTag e.g. 'Ally Protection'
 * @param {'direct'|'dot'|'self'} incomingType
 * @returns {boolean|null} null when the mechanic is unknown (caller MUST NOT assume yes)
 */
export function mitigates(mechanicTag, incomingType) {
  const m = PROTECTION_MECHANICS[mechanicTag];
  if (!m) return null;
  if (m.damageType === 'all') return true;
  return incomingType === 'direct'; // direct-only mechanics don't touch DoT/self
}
