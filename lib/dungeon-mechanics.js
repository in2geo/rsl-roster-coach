// lib/dungeon-mechanics.js — the MECHANICAL-PROBLEM model of each dungeon (Mike 2026-07-16).
//
// CORE PRINCIPLE: a dungeon is a set of PROBLEMS; a champion is a bundle of ABILITIES. There are
// MANY ways to solve each problem — hundreds of champs, different kits. The app's job is to look at a
// roster and find EVERY champ that can contribute to EACH problem, then report which problems the
// roster can cover and how. NEVER gate a dungeon on a specific champion list or one canonical comp.
//
// A tag in a problem's `tags` list means "this ability can CONTRIBUTE to solving this problem." A
// roster COVERS a problem if it fields ≥1 champ with any of those tags (count = breadth of options).
// AMPLIFIERS make a solution faster/stronger but never GATE the dungeon (kept separate so the model
// never mistakes an amplifier for the wall). `(?)` marks a game-mechanic assumption to confirm.
//
// Retention: this is the durable home of the knowledge (see knowledge/dungeon-mechanics-model.md).
// Validated: Fire Knight (vs GuapoDonni's real FK16 clear) + Dragon's Lair (vs his real Dragon-20 clear —
// the winning team covers all 5 problems; the model's "cleanse/RES support near-mandatory" prediction held,
// he fielded two). Both 2026-07-16. Draft (pending Mike review — see each model's `review`): Ice Golem, Spider.
// Dragon is the INVERSE of FK: TM-lock is immune, it's a burst + debuff-control fight (built from ayumilove).
// Clan Boss = VALIDATED from Mike's Demon Lord kit (2026-07-16). NOT a dungeon (damage/chest-tier race,
// not a kill). KEY CORRECTION: INFERNAL RESILIENCE DAMPENS Poison/HP-Burn + %maxHP damage (DoT is not free),
// so CB damage = an accumulation grind (10-debuff cap) leaning on Warmaster/Giant Slayer masteries. Gathering
// Fury ramps from turn 10/20 and AT TURN 50 ignores Unkillable+Block-Damage & adds Block Revive (the hard wall).
// KEY: for CB, problem-COVERAGE != clear - it's a magnitude race, so it needs cb-damage-model + survival on top.
//
// GLOSSARY-AWARE (2026-07-16): a SURVIVE problem carries `threat` (the boss's incoming-damage type:
// 'direct' | 'dot' | 'mixed'). The scorer consults the keyword glossary's modelFlags (via
// damage-mechanics.js PROTECTION_MECHANICS/mitigates) so DIRECT-ONLY protection (Ally Protection,
// Shield) is NOT credited against a pure-DoT threat, and is flagged as partial on a mixed threat —
// the Ally-Protection insight, applied. This is how the semantic layer changes model behaviour.
import { PROTECTION_MECHANICS, mitigates } from './damage-mechanics.js';

export const MODELS = {
  fire_knight: {
    name: 'Fire Knight',
    boss: "Fyro — SOLO boss (1v5, NO minions in the boss room; the trash mobs are the separate WAVE gate). Divine Shield (5/7/10/12 stacks by stage) stripped by HITS before he acts, or he heals + AoE-nukes MAX HP. Fyro is CC-IMMUNE (universal dungeon-boss rule) but TM reduction WORKS on him — that's the lock. THE META: break the shield, then keep his Turn Meter down so he NEVER acts (Coldheart/Alure are cheat codes). TM-LOCK and SURVIVE are SUBSTITUTES — you need one, not both.",
    // Exemplar "cheat-code" champs that make a problem trivial — but each has an ACTIVATION CONDITION
    // (stat floor / booking / survivability). The app must surface the champ AND how to build it, or the
    // advice is misleading. (General concept: an exemplar carries caveats, not just a name.)
    exemplars: {
      'TM-LOCK': [
        { champ: 'Coldheart', rarity: 'Rare', caveat: 'very SQUISHY — needs defensive gear or a protector to survive Fyro; and must be BOOKED for the full TM reduction (easy — Rare books are cheap; INS-0003 defaults Rares to booked)' },
        { champ: 'Alure', rarity: 'Epic', caveat: 'her TM reduction only fires on a CRITICAL hit → build her to ~100% crit rate or the lock is unreliable (crit-conditional, policy #4)' },
      ],
    },
    problems: [
      { key: 'SHIELD-HITS', name: 'Strip the Divine Shield (accumulate HITS)',
        why: 'The shield loses one stack per HIT (not per damage) — many small hits beat few big ones.',
        tags: ['Multi-Hit A1', 'AoE Damage', 'Counterattack', 'Reflect Damage', 'Ally Attack', 'Stormcall', 'Bomb', 'Deathbrand', 'Smite'] },
      { key: 'DAMAGE', name: 'Deal damage once the shield is down (attacks + DoTs)',
        why: "CORRECTED (Mike 2026-07-16): the shield blocks debuffs while UP, so you can't LAND a DoT on Fyro, and a DoT never helps BREAK the shield (not a hit). BUT once you break it, you apply Poison/HP Burn and those ticks PERSIST and help KILL him — so DoT is a real FK damage tool, gated behind the break, not useless. FK damage = burst ATTACKS in the broken window + DoTs landed after it. Decrease DEF amplifies the attack portion; Poison Sensitivity / Increase Debuff Duration amplify the DoT portion.",
        tags: ['AoE Damage', 'Single Target Damage', 'Enemy Max HP Damage', 'Poison', 'HP Burn', 'Poison Explosion', 'Smite'] },
      { key: 'TM-LOCK', name: "Deny Fyro his turn (Turn-Meter lock — THE meta)", meta: true,
        why: "The dominant strategy: after the shield breaks, keep Fyro's Turn Meter down so he NEVER acts → his AoE nuke + self-heal never happen. Coldheart (Rare!) & Alure are cheat codes because their TM reduction hard-locks him. SUBSTITUTES for SURVIVE — solve this and the survive problem nearly vanishes. Needs enough team SPEED (TEMPO) to re-apply it every cycle.",
        tags: ['Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)', 'Decrease Speed'] },
      { key: 'SURVIVE', name: "Survive Fyro's turn (the FALLBACK to TM-lock)", threat: 'direct',
        why: "The other way to handle his nuke: if you can't TM-lock him, outlast the AoE MAX-HP hit + self-heal. Sustain is multiplicative. (GuapoDonni took THIS harder path — 105-turn grind — precisely because they own no Coldheart/Alure.)",
        tags: ['Continuous Heal', 'AoE Heal', 'Healer', 'Shield', 'AoE Shield', 'Block Damage', 'Unkillable', 'Revive', 'Revive on Death', 'Ally Protection', 'Total Guard', 'Life Barrier', 'Magma Shield', 'Stone Skin', 'Fortify', 'Veil', 'Perfect Veil', 'Decrease Attack', 'Weaken', 'Decrease C.Rate', 'Decrease C.DMG', 'Fatigue', 'Block Debuffs', 'Cleanse', 'Nullify', 'Immutable', 'HP Aura', 'DEF Aura', 'RES Aura', 'Increase Defense', 'Increase RES'] },
      { key: 'TEMPO', name: 'Team speed (get your turns — enables the shield-break + TM-lock cycle)',
        why: 'You must move enough to strip the shield every turn AND keep re-applying the TM lock. Not a kill by itself — it enables SHIELD-HITS and TM-LOCK.',
        tags: ['Increase Speed', 'SPD Aura', 'Increase Turn Meter', 'Fervor'] },
    ],
    amplifiers: {
      // DoT amps (Poison Sensitivity / Increase Debuff Duration) matter because DoT IS a FK damage tool
      // post-shield; Shatter = +Ignore DEF (attack amp). Leech = heal-on-attack (minor sustain).
      'faster kill': ['Decrease Defense', 'AoE Decrease Defense', 'Decrease RES', 'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'ATK Aura', 'C.Rate Aura', 'Strengthen', 'Berserk', "Hunter's Gaze", 'Hex', 'Enfeeble', 'ACC Aura', 'Increase ACC', 'Poison Sensitivity', 'Increase Debuff Duration', 'Shatter', 'Leech'],
      'utility': ['Buff Strip', 'Steal Buffs', 'Buff Spread', 'Debuff Spread', 'Reset Cooldowns', 'Block Buffs', 'Block Passive Skills', 'Block Revive', 'Heal Reduction', 'Increase Enemy Cooldowns', 'Decrease ACC', 'Decrease Buff Duration', 'Single Target Damage'],
    },
    open: [], // Infest + Intercept RESOLVED (2026-07-16) — both excluded below with reasons.
    // Deliberately EXCLUDED (NOT an FK-boss path), by reason:
    //  • Offensive CROWD CONTROL — Fyro is CC-IMMUNE (universal boss rule) AND the boss room has NO
    //    minions (single boss, seed 135), so there's nothing to CC and Taunt/Provoke can't redirect him.
    //  • Infest — death-explosion, capped at 10% MAX HP vs bosses/minions and needs DYING enemies →
    //    useless on a lone boss (an Arena / multi-enemy tool). Necrosis likewise needs enemy DEATHS to
    //    stack → nothing to stack on a solo boss.
    //  • Intercept — defensive anti-CC; Fyro deals no CC to your team, so there's nothing to intercept.
    //  • Poison Cloud / Pain Link — boss-specific (Hydra) mechanics, not a player FK damage tool.
    //  NOTE: DoT (Poison/HP Burn/Poison Explosion) is NOT excluded — it's a real DAMAGE tool post-shield
    //  (see DAMAGE problem). It just can't be LANDED while the shield is up and never breaks it.
    excluded: ['Poison Cloud', 'Necrosis', 'Pain Link',
      'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Provoke', 'Fear', 'True Fear', 'Sheep', 'Petrification', 'Ensnare', 'Seal', 'Master Seal', 'Taunt', 'Block Cooldowns', 'Block Active Skills',
      'Infest', 'Intercept'],
  },

  ice_golem: {
    name: 'Ice Golem',
    boss: "Klyssus — FRIGID VENGEANCE: direct/burst damage on the BOSS triggers retaliation (freeze/damage). Reviving minions. Minions apply Heal Reduction. Boss is CC-immune; minions are not. DRAFT — review.",
    problems: [
      { key: 'DOT-RACE', name: 'Bring Klyssus down WITHOUT triggering Frigid Vengeance',
        why: 'DoT / %MAX-HP damage does NOT trip his passive (?), so a poison/HP-burn race is the safe kill. (Burst nukers are the risky alt — only if you can outlast the retaliation.)',
        tags: ['Poison', 'HP Burn', 'Poison Explosion', 'Poison Cloud', 'Enemy Max HP Damage', 'Necrosis', 'Shatter', 'Pain Link', 'Leech', 'Increase Debuff Duration'] },
      { key: 'MINIONS', name: 'Stop the reviving minions',
        why: 'Block Revive + one-shot so they stay dead, OR CC-lock them, OR AoE-clear each wave.',
        tags: ['Block Revive', 'AoE Damage', 'Enemy Max HP Damage', 'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Provoke', 'Fear', 'True Fear', 'Sheep', 'Petrification', 'Ensnare', 'Seal', 'Master Seal', 'Decrease Turn Meter', 'AoE Decrease Turn Meter'] },
      { key: 'SURVIVE', name: 'Outlast Frigid Vengeance + minion damage', threat: 'direct',
        why: 'Sustain through the retaliation and minion hits; Cleanse the minions’ Heal Reduction so your healing works.',
        tags: ['AoE Heal', 'Continuous Heal', 'Healer', 'Shield', 'AoE Shield', 'Block Damage', 'Unkillable', 'Revive', 'Revive on Death', 'Ally Protection', 'Total Guard', 'Life Barrier', 'Magma Shield', 'Stone Skin', 'Fortify', 'Veil', 'Perfect Veil', 'Cleanse', 'Block Debuffs', 'Nullify', 'Immutable', 'Decrease Attack', 'Weaken', 'Decrease C.Rate', 'Decrease C.DMG', 'Taunt', 'HP Aura', 'DEF Aura', 'RES Aura', 'Increase Defense', 'Increase RES'] },
    ],
    amplifiers: {
      // NOTE: for the DoT-race, Decrease DEF does NOTHING (DEF shred only boosts ATTACK damage — see
      // lib/damage-mechanics.js §1). The DoT amplifiers are MORE stacks + duration + survival turns.
      'faster DoT kill': ['Increase Debuff Duration', 'Poison Sensitivity', 'Increase ACC', 'ACC Aura'],
      'faster burst kill (risky path only)': ['Decrease Defense', 'AoE Decrease Defense', 'Decrease RES', 'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'ATK Aura', 'C.Rate Aura', 'Strengthen', "Hunter's Gaze"],
      'utility': ['Buff Strip', 'Steal Buffs', 'Reset Cooldowns', 'Increase Speed', 'Increase Turn Meter', 'SPD Aura'],
    },
    statGate: 'ACC floor rises with stage (placeholder ~stage×10) — a fielded strategy still fails if debuffers are under the floor (a stat check, not a tag).',
    open: [],
  },

  spider: {
    name: "Spider's Den",
    boss: "Skavag — ONE continuous fight (no waves): the boss + endlessly-spawning SPIDERLINGS. The spiderlings poison-stack your team AND Skavag CONSUMES them to HEAL + permanently gain ATK — so a dragged-out fight = she snowballs and wipes you. Boss is CC-IMMUNE; spiderlings are NOT. DoT WORKS here (opposite of Fire Knight). DRAFT — needs Mike's review.",
    // CANDIDATE exemplars only — flagged for Mike's confirmation (unlike FK's Coldheart/Alure, which he
    // gave me). Poison-detonation carries (from seed 136 Poison Explosion): Dark Kael/Taya (Epic, accessible).
    exemplars: {
      'DAMAGE': [
        { champ: 'Dark Kael', rarity: 'Epic', caveat: 'CANDIDATE (confirm) — Poison-Explosion detonator; the Poison-detonation strategy needs poison APPLIERS on the team to stack first' },
        { champ: 'Taya', rarity: 'Epic', caveat: 'CANDIDATE (confirm) — Poison-Explosion detonator; same: needs poison stacked before she detonates' },
      ],
    },
    problems: [
      { key: 'SPIDERLINGS', name: 'Control the Spiderlings (deny Skavag her snowball)', meta: true,
        why: "THE central problem, unique to Spider. Spiderlings poison-stack your team, and Skavag eats them to HEAL + permanently gain ATK. Kill them or CC them before they act / before she consumes them, or she snowballs unkillable. Boss is CC-immune; the spiderlings are NOT.",
        tags: ['AoE Damage', 'Enemy Max HP Damage', 'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Petrification', 'Ensnare', 'Sheep', 'Seal', 'Master Seal', 'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)', 'Provoke'] },
      { key: 'DAMAGE', name: 'Kill Skavag (several SUBSTITUTE damage families — pick one for your stage)',
        why: "DoT works here. Substitute strategies, stage-tiered: AoE nuke (early) → %enemy-MAX-HP (mid; enemies too tanky for raw AoE) → Poison-detonation (stack poisons, then explode for %maxHP) → HP Burn (%maxHP DoT, uncapped at 21-25). You need ONE family that fits your stage, not all four.",
        tags: ['AoE Damage', 'Enemy Max HP Damage', 'Poison', 'Poison Explosion', 'Poison Cloud', 'HP Burn', 'Necrosis', 'Single Target Damage'] },
      { key: 'SURVIVE', name: 'Outlast the poison stacks + Skavag (eases when SPIDERLINGS are controlled)', threat: 'mixed',
        why: "The spiderlings drown you in Poison while Skavag hits + debuffs. Sustain, and CLEANSE the poison stacks. Strong spiderling control (above) cuts the incoming, so SPIDERLINGS and SURVIVE trade off — a hard-control team barely needs sustain, a bulky team can tank looser control.",
        tags: ['AoE Heal', 'Continuous Heal', 'Healer', 'Shield', 'AoE Shield', 'Block Damage', 'Unkillable', 'Revive', 'Revive on Death', 'Ally Protection', 'Total Guard', 'Cleanse', 'Block Debuffs', 'Nullify', 'Immutable', 'Fortify', 'Stone Skin', 'Veil', 'Perfect Veil', 'Decrease Attack', 'Weaken', 'HP Aura', 'DEF Aura', 'RES Aura', 'Increase Defense', 'Increase RES'] },
    ],
    amplifiers: {
      // Decrease DEF amps the ATTACK strategies (AoE nuke / %maxHP-attack) but does NOTHING for the DoT
      // strategies (Poison/HP Burn) — DEF shred only boosts ATTACK damage (damage-mechanics §1).
      'amp ATTACK-damage strategies': ['Decrease Defense', 'AoE Decrease Defense', 'Decrease RES', 'Weaken', 'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'ATK Aura', 'C.Rate Aura', 'Strengthen', "Hunter's Gaze"],
      'amp DoT strategies': ['Increase Debuff Duration', 'Poison Sensitivity', 'Heal Reduction'],
      'land debuffs (ACC)': ['Increase ACC', 'ACC Aura'],
      'utility / tempo': ['Increase Speed', 'SPD Aura', 'Increase Turn Meter', 'Fervor', 'Reset Cooldowns', 'Buff Strip', 'Steal Buffs', 'Decrease ACC', 'Fear', 'True Fear', 'Hex', 'Enfeeble'],
    },
    statGate: "ACC ~ stage×10 + ~10% margin (≈×11, cap ~225) to LAND Poison/Decrease-DEF on Skavag; RES ~ up to ~300 to RESIST her debuffs. A stat check, not a tag (Increase ACC / ACC Aura raise offense-ACC; RES Aura / Increase RES raise defense-RES). ACC and RES are TWO DIFFERENT JOBS — don't conflate.",
    review: ['What are the real Spider cheat codes? (I only have candidate detonators)', 'Does Provoke work on spiderlings, or are they Provoke-immune?', 'Is Skavag herself immune to Poison/HP Burn, or only CC? (assumed DoT works on the boss)'],
    open: [],
  },

  dragon: {
    name: "Dragon's Lair",
    boss: "Hellrazor — SOLO boss (trash WAVES precede the boss room, then the Dragon alone). THE INVERSE OF FIRE KNIGHT: he is IMMUNE to Decrease Turn Meter AND Decrease Speed, so TM-lock — FK's cheat code — DOES NOT WORK here. He is also CC-IMMUNE (Stun/Freeze/Sleep/Provoke/Fear/True Fear/Block Active Skills) + immune to HP-exchange/HP-balance/cooldown-increase effects. SIGNATURE MECHANIC = the PURPLE BAR: every few turns 'Inhale' depletes his TM and unlocks the secret skill 'Scorch'; you must BURST enough damage to clear the purple bar HP and re-lock Scorch, or he lands an AoE Stun. Meanwhile he stacks debuffs on YOU — 50% Decrease ATK (Swipe, cripples your DAMAGE), Poison + 25% Weaken (Wall of Fire), Stun (Scorch). So Dragon = a DAMAGE race (burst OR DoT — BOTH count, including toward the purple bar) + heavy DEBUFF management. NOT a TM fight (TM-lock is immune). DoT IS FIRST-CLASS (Mike, confirmed): most Dragon SOLO carriers are DoT champs — HP Burn / Poison in self-sustain gear who tick him down AND clear the purple bar while surviving via Evasion/Shield-on-hit/Leech/Continuous-Heal + SELF-immunity to his debuffs. Validated vs GuapoDonni's real Dragon-20 team clear; solo carriers live in champion_solo_profiles (checkSoloCarries). Sources: ayumilove + Mike (2026-07-16).",
    // NO confirmed exemplars yet — Mike gave me Coldheart/Alure for FK, but not for Dragon. Classic Dragon
    // teams are burst nukers + a cleanser/RES support; the specific accessible 'cheat codes' are a review item.
    problems: [
      { key: 'WAVE', name: 'Clear the trash waves before the boss room',
        why: 'Standard AoE clear of the pre-boss waves. Offensive CC works HERE (the waves are not CC-immune) even though it is useless on the boss.',
        tags: ['AoE Damage', 'Enemy Max HP Damage', 'Single Target Damage', 'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Provoke'] },
      { key: 'DAMAGE', name: 'Clear the purple bar + kill him (burst OR DoT — both count)', meta: true,
        why: "When Inhale unlocks Scorch you must clear the purple bar HP before his next turn or eat an AoE Stun. It's a damage THRESHOLD (not a hit-count like FK's shield) and — CORRECTED (Mike): DoT DAMAGE COUNTS toward it. So two paths: burst nukers, OR Poison/HP Burn ticking it down (the SOLO carriers are DoT champs). Your own Decrease-ATK debuff (from Swipe) suppresses ALL your damage, so DEBUFF-CONTROL feeds directly back into this. NOTE: Poison & HP Burn scale off enemy MAX HP, and Almighty Strength CAPS %maxHP damage at 10% of boss MaxHP at stages 21-25 — which is exactly why DoT-solo works up to ~20 (Michelangelo solos Dragon 20) but the top stages throttle DoT and lean back toward raw ATTACK.",
        tags: ['AoE Damage', 'Single Target Damage', 'Enemy Max HP Damage', 'Poison', 'HP Burn', 'Poison Explosion'] },
      { key: 'DEBUFF-CONTROL', name: 'Block / cleanse / resist his debuffs (restores your burst AND survival)', meta: true,
        why: "His debuffs are the real counter-play: 50% Decrease ATK guts your damage (so you can't clear the purple bar), Poison + Weaken erode survival, Scorch stuns. Remove them (Cleanse), pre-empt them (Block Debuffs), or RESIST them with high RES on the carriers (guide: ~300 RES at stage 20). This is why a cleanser/Block-Debuffs support is near-mandatory on Dragon — it serves BURST and SURVIVE at once.",
        tags: ['Cleanse', 'Block Debuffs', 'Nullify', 'Immutable', 'RES Aura', 'Increase RES'] },
      { key: 'SURVIVE', name: "Outlast his AoE nukes (Swipe / Wall of Fire / Scorch)", threat: 'mixed',
        why: "Even with good burst you eat AoE hits + the occasional Scorch stun. Sustain, mitigate (Decrease ATK on the BOSS cuts his nuke), or Revive / Ally-Protect. threat=mixed: Poison ticks mean direct-only protection (Ally Protection / Shield) covers only part — cleanse handles the DoT.",
        tags: ['Continuous Heal', 'AoE Heal', 'Healer', 'Shield', 'AoE Shield', 'Block Damage', 'Unkillable', 'Revive', 'Revive on Death', 'Ally Protection', 'Total Guard', 'Life Barrier', 'Stone Skin', 'Fortify', 'Veil', 'Perfect Veil', 'Decrease Attack', 'Weaken', 'Decrease C.Rate', 'Decrease C.DMG', 'HP Aura', 'DEF Aura', 'RES Aura', 'Increase Defense', 'Increase RES'] },
      { key: 'TEMPO', name: 'Speed up YOUR team (you cannot slow him)',
        why: "Since Decrease Speed / Decrease TM are immune, the only tempo lever is your own side: take more turns to re-burst and recover between his nukes. Guide speed-tune: Increase-ATK buffer → Decrease-DEF debuffer → nuker, for sub-2-minute runs.",
        tags: ['Increase Speed', 'SPD Aura', 'Increase Turn Meter', 'Fervor', 'Increase Attack'] },
    ],
    amplifiers: {
      // Two damage paths, two amp families. DoT amps (duration/sensitivity/land-rate) carry the SOLO/DoT path;
      // ATTACK amps (Decrease DEF etc.) carry the burst path. Decrease DEF does NOT amp the DoT portion
      // (DEF shred only boosts ATTACK damage — damage-mechanics §1). ACC to LAND Poison / Decrease ATK on boss.
      'amp the DoT path (purple bar + kill)': ['Increase Debuff Duration', 'Poison Sensitivity', 'Increase ACC', 'ACC Aura'],
      'amp the ATTACK/burst path': ['Decrease Defense', 'AoE Decrease Defense', 'Decrease RES', 'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'ATK Aura', 'C.Rate Aura', 'Strengthen', 'Berserk', "Hunter's Gaze"],
      'reduce his nuke (survive amp)': ['Decrease Attack', 'Weaken', 'Decrease C.Rate', 'Decrease C.DMG', 'Fatigue'],
      'utility': ['Buff Strip', 'Steal Buffs', 'Reset Cooldowns'],
    },
    statGate: "Support RES ~300 at stage 20 (scales with stage) to RESIST Stun/Poison/Weaken; ACC on debuffers to LAND Decrease ATK / Decrease DEF on the boss. %MAX-HP damage capped at 10% boss MaxHP at 21-25 (Almighty Strength) → burst-ATTACK teams at high stages, not %maxHP. All TM reduction halved at 21-25 (Almighty Persistence) — moot, since TM reduction is already a non-strategy.",
    // EXCLUDED vs the BOSS, by reason (all from Almighty Immunity):
    //  • Decrease Turn Meter / Decrease Speed — IMMUNE. The FK meta is dead on Dragon (the headline inversion).
    //  • Offensive CC (Stun/Freeze/Sleep/Provoke/Fear/True Fear/Block Active Skills) — IMMUNE on the boss
    //    (still valid on the WAVES — see the WAVE problem, which lists them).
    //  • HP-exchange / HP-balancing / cooldown-increase effects — IMMUNE (Increase Enemy Cooldowns useless).
    excluded: ['Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)', 'Decrease Speed',
      'Sleep', 'AoE Sleep', 'Fear', 'True Fear', 'Block Active Skills', 'Petrification', 'Sheep', 'Ensnare', 'Seal', 'Master Seal',
      'Increase Enemy Cooldowns', 'Block Cooldowns'],
    review: [
      'RESOLVED (Mike 2026-07-16): DoT (Poison/HP Burn) DEFINITELY works on Hellrazor and is FIRST-CLASS — most solo carriers are DoT champs. Added to DAMAGE tags.',
      'RESOLVED (Mike 2026-07-16): DoT damage COUNTS toward the purple bar — so it is cumulative-over-the-window, not a pure one-turn burst threshold.',
      'STILL OPEN (Mike unsure): Does Block Debuffs fully stop the Decrease-ATK / Poison, or only reduce chance? Is RES the more reliable answer at 20+? (Solo carriers sidestep this via SELF-immunity passives.)',
      'Team (non-solo) exemplars still unconfirmed. SOLO carriers ARE known: champion_solo_profiles has a DoT+self-sustain roster for Dragon 20 — HP-Burn passives, Poison-detonators, and Toxic-SET carriers (Michelangelo = Toxic-set poison + Multi-Hit A1 + Evade/Leech sustain, NOT a kit DoT), Venomage, etc. All status=proposed, pending approval.',
    ],
    open: [],
  },

  clan_boss: {
    name: 'Clan Boss (Demon Lord)',
    boss: "The Demon Lord — HE NEVER DIES (you do NOT kill him). TARGET = a ONE-KEY CLEAR = deal enough DAMAGE in a SINGLE key to earn the HIGHEST available chest at that difficulty — a per-key damage THRESHOLD (clan_boss_chest_tiers top tier). THE CHEST IS THE GOAL (not secondary). (Separately, when the whole clan empties his HP bar, everyone who damaged him gets a bonus chest — collective, not the individual target.) So CB is a DAMAGE-THRESHOLD race: bank enough TOTAL key damage before Gathering Fury ramps enough to wipe you. NOT dungeon_stages 1-25: CB is 6 DIFFICULTIES (Easy/Normal/Hard/Brutal/NM/UNM), only mapped to stage_number 1-6 as plumbing to reuse the engine scan. KIT (Mike's CB doc, VALIDATED 2026-07-16): A1 Crushing Force hits 1 champ with an UNRESISTABLE Stun + damage ∝ that champ's MAX HP; A2/A3 are AoE ×2 / ×4 and DIFFER BY AFFINITY (Void→2.5% Poison, Force→Decrease ATK, Magic→Decrease ACC, Spirit→Decrease SPD; the ×4 A3 'Crash Through' also self-buffs the Demon's ATK). INFERNAL RESILIENCE passive REDUCES incoming HP Burn/Poison AND %maxHP-skill damage (so DoT is DAMPENED, not free) and grants immunity to Stun/Freeze/Sleep/Decrease SPD/Decrease TM/MAX-HP-reduction/HP-exchange. ALMIGHTY IMMUNITY adds Provoke/Block-Active/Fear/True-Fear/Petrification/cooldown-increase immunity. GATHERING FURY ramps his damage from turn 10, harder from turn 20, and AT TURN 50 ignores Unkillable + Block Damage and applies Block Revive on kills (kills clip/revive strategies) — the hard 50-turn wall. Warmaster/Giant Slayer on all 5 = the damage multiplier.",
    problems: [
      { key: 'DAMAGE', name: 'Bank enough key damage for the top chest (the CB one-key target)', meta: true,
        why: "GOAL = your single key's TOTAL damage clears the HIGHEST-chest threshold at that difficulty (clan_boss_chest_tiers). He never dies. TOTAL damage = damage-rate × turns survived, so BOTH survival depth and per-turn output feed it. Engine = Poison + HP Burn ticking every turn + Warmaster/Giant Slayer masteries (per-champ boolean, the single biggest lever — lib/masteries.js). CORRECTED (Mike's kit): INFERNAL RESILIENCE DAMPENS DoT + %maxHP-skill damage, so it's an ACCUMULATION race — stack debuffs to the 10-DEBUFF CAP, sustain long enough, lean on masteries. Decrease DEF / Weaken amp only the ATTACK/mastery portion, NOT the DoT (damage-mechanics §1). (Short of the top chest, lower total = a lower chest tier.)",
        tags: ['Poison', 'HP Burn', 'Enemy Max HP Damage', 'Poison Explosion', 'AoE Damage', 'Single Target Damage'] },
      { key: 'SURVIVE', name: 'Survive Gathering Fury (the wall at Brutal+; hard cap at turn 50)', meta: true, threat: 'mixed',
        why: "His AoE (A2 ×2 / A3 ×4) + unresistable A1 Stun + the affinity debuff (Poison / Decrease ATK / Decrease ACC / Decrease SPD) all GROW every turn via Gathering Fury. Easy/Normal/Hard: a Speed team + a healer is enough. Brutal/NM/UNM: CUT his damage with Decrease ATK / Weaken, sustain (Lifesteal set healing off Warmaster/Giant Slayer, or a Leech debuff on the boss), and/or Unkillable / Block-Damage timing — BUT those STOP at turn 50 (Gathering Fury ignores them + adds Block Revive), so the run must effectively finish by ~turn 50. Counterattack teams add damage + self-sustain.",
        tags: ['Unkillable', 'Block Damage', 'Ally Protection', 'Total Guard', 'AoE Heal', 'Continuous Heal', 'Healer', 'Shield', 'AoE Shield', 'Revive', 'Revive on Death', 'Counterattack', 'Decrease Attack', 'Weaken', 'Decrease C.Rate', 'Decrease C.DMG', 'Fortify', 'Stone Skin', 'DEF Aura', 'HP Aura', 'Increase Defense', 'Increase RES'] },
      { key: 'TEMPO', name: 'Team speed (more turns before the timer = more banked damage)',
        why: "Every extra turn your team takes is more DoT ticks + mastery procs + debuff re-applies before the ~50-turn wall. Speed / Increase TM is a FIRST-ORDER damage multiplier here, not just utility.",
        tags: ['Increase Speed', 'SPD Aura', 'Increase Turn Meter', 'Fervor'] },
    ],
    amplifiers: {
      // The CB 'kit' (Mike's doc). DoT amps carry the poison/burn engine; Decrease DEF/Weaken amp only the
      // ATTACK/mastery portion (damage-mechanics §1). Counterattack/Ally Attack add extra hits → more masteries.
      'amp the DoT engine': ['Increase Debuff Duration', 'Poison Sensitivity', 'Increase ACC', 'ACC Aura'],
      'amp attack/mastery damage': ['Decrease Defense', 'AoE Decrease Defense', 'Weaken', 'Counterattack', 'Ally Attack', 'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'ATK Aura', 'C.Rate Aura', 'Strengthen'],
      'survival / sustain kit': ['Increase Defense', 'Increase RES', 'Continuous Heal', 'Shield', 'Ally Protection', 'Fortify', 'Block Buffs', 'Heal Reduction', 'Leech'],
      'utility': ['Buff Strip', 'Steal Buffs', 'Reset Cooldowns'],
    },
    statGate: "MASTERIES = the multiplier: Warmaster or Giant Slayer on ALL 5 (per-champ boolean, lib/masteries.js — not a tag, never a filler). DEBUFF CAP = 10 (can't stack >10 debuffs incl. Poisons — cap your poison stackers). ACC to LAND Poison/Decrease-ATK on the boss. Damage → chest tier (clan_boss_chest_tiers). THE 50-TURN WALL: Unkillable/Block-Damage/infinite-revive strategies FAIL at turn 50 (Gathering Fury) — bank the damage before then. Standard Brutal+ sustain = Lifesteal set (heals off the mastery damage); a Leech debuff on the boss can replace it.",
    // EXCLUDED vs the Demon Lord (Infernal Resilience + Almighty Immunity):
    //  • CC: Stun/Freeze/Sleep/Provoke/Fear/True Fear/Petrification/Block Active Skills — immune.
    //  • Decrease SPD + Decrease Turn Meter — immune (no slowing him, like Dragon).
    //  • MAX-HP-reduction, HP-exchange/balancing, cooldown-increase — immune.
    excluded: ['Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Provoke', 'Fear', 'True Fear', 'Petrification', 'Sheep', 'Ensnare', 'Seal', 'Master Seal', 'Block Active Skills', 'Decrease Speed', 'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)', 'Increase Enemy Cooldowns', 'Block Cooldowns'],
    review: [
      "VALIDATED from Mike's Demon Lord kit (2026-07-16) — no longer a bare port. Open nuance: does Infernal Resilience's '%maxHP-skill' reduction also dampen Warmaster/Giant Slayer? They're MASTERIES not skills → likely exempt (which is why they're mandatory). Affects the cb-damage-model mastery weighting.",
      "Counterattack & Unkillable are TEAM ARCHETYPES (timing-tuned), not just tag presence — the model credits presence; the magnitude / AI-config layer judges whether the timing actually works before turn 50.",
    ],
    open: [],
  },
};

// A tag on a THREATENED problem is only credited if it actually mitigates that threat. Direct-only
// protection (Ally Protection, Shield — glossary modelFlags via damage-mechanics) does NOT mitigate a
// pure-DoT threat; non-protection tags (heals, revives, cleanse, CC…) always count.
function tagCountsVsThreat(tag, threat) {
  if (!threat) return true;
  const m = PROTECTION_MECHANICS[tag];
  if (!m) return true;                                  // not a damage-blocking mechanic → always counts
  return mitigates(tag, threat === 'dot' ? 'dot' : 'direct') !== false;
}

// roster = [{name, tags:Set<string>, dev}]. Returns per-problem fillers + amplifier hits + notes.
export function evaluateRoster(model, roster) {
  const problems = model.problems.map(p => {
    // a champ contributes to p if it has ≥1 tag that BOTH matches p AND counts vs p's threat.
    const fillers = roster.filter(c => p.tags.some(t => c.tags.has(t) && tagCountsVsThreat(t, p.threat)))
      .sort((a, b) => (b.dev || 0) - (a.dev || 0));
    const notes = [];
    if (p.threat) {
      const directOnly = p.tags.filter(t => PROTECTION_MECHANICS[t]?.damageType === 'direct');
      if (directOnly.length && p.threat === 'mixed')
        notes.push(`${directOnly.join('/')} cover only the DIRECT-damage portion of this fight — they do NOT stop the DoT ticks (threat=mixed).`);
      if (directOnly.length && p.threat === 'dot')
        notes.push(`${directOnly.join('/')} are NOT credited here — a DoT threat isn't mitigated by direct-only protection (glossary modelFlags).`);
    }
    return { ...p, fillers, notes };
  });
  const has = (c, tags) => tags.some(t => c.tags.has(t));
  const amplifiers = Object.fromEntries(Object.entries(model.amplifiers || {}).map(([k, tags]) => [k, roster.filter(c => has(c, tags)).length]));
  return { problems, amplifiers, covered: problems.filter(p => p.fillers.length).map(p => p.key), uncovered: problems.filter(p => !p.fillers.length).map(p => p.key) };
}

// which vocab tags did the model NOT place anywhere (coverage/omission check)?
export function vocabCoverage(model, vocabSet) {
  const placed = new Set([...model.problems.flatMap(p => p.tags), ...Object.values(model.amplifiers || {}).flat(), ...(model.open || []), ...(model.excluded || [])]);
  return {
    placed: [...placed].filter(t => vocabSet.has(t)).length,
    total: vocabSet.size,
    unplaced: [...vocabSet].filter(t => !placed.has(t)),
    ghosts: [...placed].filter(t => !vocabSet.has(t)), // in model but not a real tag (typo guard)
  };
}
