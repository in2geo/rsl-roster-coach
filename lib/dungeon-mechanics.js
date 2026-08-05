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
        { champ: 'Coldheart', rarity: 'Rare', caveat: 'very SQUISHY — needs defensive gear or a protector to survive Fyro; and must be BOOKED for the full TM reduction (easy — Rare books are cheap; INS-0003 defaults Rares to booked). STAGES 21-25: Almighty Persistence halves her TM reduction — she does NOT solo-lock up there; pair her with a second reducer or heavy SPD + Decrease SPD.' },
        { champ: 'Alure', rarity: 'Epic', caveat: 'her TM reduction only fires on a CRITICAL hit → build her to ~100% crit rate or the lock is unreliable (crit-conditional, policy #4). STAGES 21-25: halved by Almighty Persistence — the crit gate AND the halving stack against her, so she is the weaker of the two at top stages.' },
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
        why: "The dominant strategy: after the shield breaks, keep Fyro's Turn Meter down so he NEVER acts → his AoE nuke + self-heal never happen. Coldheart (Rare!) & Alure are cheat codes because their TM reduction hard-locks him. SUBSTITUTES for SURVIVE — solve this and the survive problem nearly vanishes. Needs enough team SPEED (TEMPO) to re-apply it every cycle. ⚠ STAGE-SCALED (Mike, CONFIRMED 2026-07-16): Fyro gains ALMIGHTY PERSISTENCE at stages 21-25 which halves ALL Turn-Meter reduction used against him — a 100% TM-reduction skill removes only 50%. So the SAME lock that trivialises stages 10-20 only half-works at 21-25: ONE Coldheart/Alure is NOT enough up there. The fix is MORE of it, not something else — multiple TM reducers, and/or enough team SPD + a Decrease SPD debuff (which DOES work on Fyro) to cycle the reducers often enough to hold the lock. Halved is NOT immune (contrast Dragon/Clan Boss, where TM reduction does literally nothing) — the strategy survives, its PRICE doubles. Ice Golem carries the same 21-25 passive; Dragon records it too (moot there, TM is already a non-strategy).",
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
    boss: "Klyssus — FRIGID VENGEANCE is a PASSIVE fired at HP THRESHOLDS — 80% / 60% / 45% / 30% / 15% (Mike, CONFIRMED 2026-07-16). It is NOT an active skill, NOT on a cooldown, and NOT tied to his turn: the moment your damage pushes him past a marker, the retaliation fires. So the fight has exactly FIVE scripted retaliation events, keyed to his HP bar, and a burst team meets all five on the way down. CRITICAL: DoT does NOT trip it (Mike, CONFIRMED 2026-07-16) — that is the whole reason the DoT race is the safe kill and this dungeon's defining fact, previously an unverified assumption. TURN-METER REDUCTION WORKS ON HIM (Mike, confirmed 2026-07-16): full effect at stages 1-20, HALVED at 21-25 (Normal & Hard) by ALMIGHTY PERSISTENCE (the same passive Fire Knight has). TM is not CC, so his CC-immunity never ruled it out — but see the TM-LOCK problem for what the lock does NOT buy you here. Klyssus joins Fire Knight and Spider as TM-lockable; only Dragon and Clan Boss are truly TM-IMMUNE. Minions revive and apply Heal Reduction; the boss is CC-immune, the minions are not.",
    // CONFIRMED by Mike (2026-07-16): the Ice Golem 20 solo carriers are DoT champs — Venomage,
    // Corvis the Corruptor, Artak. Mike's own framing is the model's thesis stated back: "because Ice
    // Golem deals devastating retaliation smashes if you hit too hard, poison and HP Burn are the
    // safest strategies." That is the threshold passive (80/60/45/30/15%) in plain language: DoT is
    // the only damage that walks him down the bar without paying it.
    // ALL THREE VERIFIED DoT in champion_tags: Venomage (Poison + Enemy Max HP Damage), Corvis
    // (Poison + Poison Sensitivity), Artak (HP Burn).
    // DATA GAP — only Venomage has an IG solo profile (Stage 20, Regeneration, status=proposed).
    // Corvis has NO solo profile for ANY dungeon; Artak has seven (Dragon 19/20/23/25, Spider
    // 1-14/20/25) but NONE for Ice Golem. checkSoloCarries cannot surface either here until seeded.
    // NOTE: Michelangelo also holds an IG 20 solo row (Toxic + Merciless/Savage, proposed) — his DoT
    // is the Toxic SET, not a kit debuff (same as his Dragon solo), which is why a kit-tag scan misses
    // him. Set-sourced DoT is a first-class path on this dungeon, not an asterisk.
    exemplars: {
      'DOT-RACE': [
        { champ: 'Venomage', rarity: 'Epic', caveat: 'CONFIRMED (Mike) — the accessible one (Epic). Poison + Enemy Max HP Damage. ALREADY has an IG Stage 20 solo profile (Regeneration) but it is status=proposed, so checkSoloCarries ignores it until approved.' },
        { champ: 'Corvis the Corruptor', rarity: 'Legendary', caveat: 'CONFIRMED (Mike) — Poison + Poison Sensitivity, i.e. he stacks AND amplifies his own ticks. NO solo profile for any dungeon: pure data gap.' },
        { champ: 'Artak', rarity: 'Legendary', caveat: 'CONFIRMED (Mike) — HP Burn. The universal DoT solo carrier: already profiled on Dragon 19-25 and Spider 20/25, and Mike confirms Ice Golem 20 too. Missing an IG row.' },
      ],
    },
    problems: [
      { key: 'TM-LOCK', name: "Deny Klyssus his turn (Turn-Meter lock — full effect 1-20, HALVED 21-25)",
        why: "CONFIRMED (Mike 2026-07-16): TM reduction works on Klyssus — 100% effective at stages 1-20, cut to 50% at 21-25 (Normal & Hard) by ALMIGHTY PERSISTENCE. The model previously credited TM only against his minions, so this whole path was invisible — the same omission found and fixed on Spider. HALVED is not IMMUNE (contrast Dragon/Clan Boss, where TM does nothing at all): a halved lock still works, it just needs roughly TWICE the TM reduction per cycle — more appliers, or more team SPEED to re-apply — so at 21-25 it degrades into a TEMPO problem rather than vanishing. ⚠ WHAT THE LOCK DOES *NOT* BUY YOU — I inferred that locking him would also stop Frigid Vengeance; Mike CORRECTED that (2026-07-16) and the inference was WRONG. Frigid Vengeance is a PASSIVE on HP THRESHOLDS (80/60/45/30/15%), not an action he takes on his turn — so denying him turns delays his normal attacks and does NOTHING to the retaliation. Cross a marker and it fires whether he is locked or not. CONSEQUENCE: unlike Fire Knight — where TM-LOCK SUBSTITUTES for SURVIVE — Spider/IG TM-LOCK does NOT substitute for DOT-RACE. The two problems are INDEPENDENT here: the lock buys turn-denial, the DoT race is still how you avoid the retaliation. A locked Klyssus is not a safe Klyssus.",
        tags: ['Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)'] },
      { key: 'DOT-RACE', name: 'Bring Klyssus down WITHOUT triggering Frigid Vengeance', meta: true,
        why: "CONFIRMED (Mike 2026-07-16) — this was the model's load-bearing assumption and it now has an answer: DoT does NOT trip Frigid Vengeance. So a Poison/HP-Burn race walks him through all five HP markers (80/60/45/30/15%) without ever paying the retaliation. THIS is why Ice Golem is a DoT dungeon — not a preference, a mechanic. The burst alternative is not merely 'riskier': because the passive is HP-threshold-keyed rather than turn-keyed, a burst team meets EVERY marker on the way down and eats up to five retaliations, and no amount of Turn-Meter control prevents a single one (see TM-LOCK). Burst therefore has to out-SURVIVE five scripted counterattacks that DoT simply never triggers. NOTE the amplifier asymmetry: Decrease DEF does NOTHING for the DoT path (DEF shred only boosts ATTACK damage, damage-mechanics §1) — the DoT amps are stacks, duration, and ACC to land them.",
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
    statGate: 'ACC floor rises with stage (placeholder ~stage×10) — a fielded strategy still fails if debuffers are under the floor (a stat check, not a tag). TM-LOCK is STAGE-SCALED, not binary: full effect 1-20, halved at 21-25 (Almighty Persistence), so a lock that holds at 20 needs ~2× the TM reduction to hold at 21+.',
    review: [
      'RESOLVED (Mike 2026-07-16): TM reduction WORKS on Klyssus — 100% at stages 1-20, halved at 21-25 (Almighty Persistence). Added the TM-LOCK problem. This was the SAME missing-path class as Spider: TM is not CC, so boss CC-immunity never excluded it, but nothing connected the tags to the boss.',
      'RESOLVED (Mike 2026-07-16): TM-locking Klyssus does NOT stop Frigid Vengeance — my inference was WRONG. It is a PASSIVE on HP thresholds (80/60/45/30/15%), not an action on his turn, so a lock delays his normal attacks and does nothing to the retaliation. TM-LOCK and DOT-RACE are INDEPENDENT problems here (unlike FK, where TM-LOCK substitutes for SURVIVE).',
      'RESOLVED (Mike 2026-07-16): DoT does NOT trip Frigid Vengeance. The model\'s load-bearing assumption — carried for weeks as a literal "(?)" — is confirmed. This is WHY Ice Golem is a DoT dungeon; burst must survive up to five threshold retaliations that DoT never triggers.',
      'RESOLVED (Mike 2026-07-16): Almighty Persistence DOES halve TM reduction on Fire Knight at 21-25 — modeled there now. NOTE: this was ALREADY in the live layer (boss_exceptions + the FK 21-25 goal text); only dungeon-mechanics.js lacked it. The app was NOT over-promising, as I claimed — the new problem-model is simply not yet a superset of the content it supersedes. Worth diffing this file against all 178 boss_exceptions rows before wiring it into recommendations.',
      'RESOLVED (Mike 2026-07-16): the IG 20 SOLO carriers are DoT champs — Venomage (Epic, accessible), Corvis the Corruptor, Artak. All three verified DoT in champion_tags. Mike\'s reason IS the model\'s thesis: hit too hard and the retaliation smashes you, so Poison/HP Burn are the safe kill.',
      'DATA GAP (actionable): only Venomage has an IG solo profile (Stage 20, Regeneration, status=proposed). Corvis has NO profile for ANY dungeon; Artak has seven (Dragon + Spider) but none for Ice Golem. checkSoloCarries cannot surface either until seeded — needs required_set + mechanism, which I do not have and will not invent. Same shape as the Drexthar/Spider gap closed by seed 143.',
      'STILL OPEN: no real-clear validation. DonBrogni cleared IG 14+15 on auto while the engine predicted 13 ([[ig-feedback-donbrogni-2026-07-14]]) — that capture is the obvious ground truth to reconcile against, and it is already in the battle log.',
    ],
    open: [],
  },

  spider: {
    name: "Spider's Den",
    boss: "Skavag — ONE continuous fight (no waves): the boss + endlessly-spawning SPIDERLINGS. The spiderlings poison-stack your team AND Skavag CONSUMES them to HEAL + permanently gain ATK — so a dragged-out fight = she snowballs and wipes you. Boss is CC-IMMUNE — but TURN-METER REDUCTION WORKS ON HER (Mike, confirmed 2026-07-16): TM is not CC, so Skavag can be TM-LOCKED like Fyro (see the TM-LOCK problem). Spiderlings are not CC-immune either, and PROVOKE WORKS ON THEM (Mike, confirmed 2026-07-16), so Provoke is a real spiderling-control tool, not just a CC guess. DoT WORKS on Skavag HERSELF (Mike, confirmed 2026-07-16) — her immunity is CC-only, so Poison/HP Burn tick her down; the OPPOSITE of Fire Knight (whose shield blocks the debuff outright) and UNDAMPENED, unlike Clan Boss's Infernal Resilience. MECHANICS CONFIRMED; the accessible cheat-code exemplars are still unconfirmed (see review) and no real-clear validation has been run yet, so team output stays advisory vs FK/Dragon/CB.",
    // CONFIRMED by Mike (2026-07-16): the Spider SOLO carriers at the stages that matter are HP-BURN
    // champs — Artak and Drexthar Bloodtwin. This replaces my earlier unconfirmed Poison-Explosion
    // candidates (Dark Kael / Taya), which were a guess and are NOT the known solo shape.
    // NOTE the stage split: the champion_solo_profiles rows at Stages 1-14 are starter Rares (Athel/
    // Kael/Elhain) AoE-one-shotting spiderlings under Lifesteal. That is low content, not "soloing
    // Spider" — do NOT read those rows as evidence about the real strategy.
    exemplars: {
      'DAMAGE': [
        { champ: 'Artak', rarity: 'Legendary', caveat: 'CONFIRMED (Mike) — HP-Burn solo. Whole kit compounds HP Burn: Purifyre places it AoE, Dogs of War instantly activates a tick of every HP Burn, Chaosrazor extends duration, and Burning Blood [P] converts destroyed MAX HP into DMG/C.DMG/DEF. Runs Toxic+Speed (solo profiles at Spider 20 + 25, status=proposed) — so part of the DoT comes from the SET, not the kit (cf. Michelangelo on Dragon).' },
        { champ: 'Drexthar Bloodtwin', rarity: 'Legendary', caveat: 'CONFIRMED (Mike) — HP-Burn solo, but NOT yet in champion_solo_profiles for Spider (only Dragon 20). DATA GAP: needs a solo profile seeded before checkSoloCarries can ever surface him here.' },
      ],
    },
    // WHY Drexthar solos, in this model's own terms — he covers three seats alone, and the middle one
    // only became visible once Mike confirmed spiderlings are Provokable (2026-07-16):
    //   SPIDERLINGS → Burning Lash AoE-Provokes at 40%, rising to 100% on targets already under HP Burn
    //                 — and his own kit places that HP Burn, so it is a SELF-COMBO (tag policy #1
    //                 exception), reliable unaided. Provoked spiderlings can't bite the team.
    //   DAMAGE      → HP Burn (Eldritch Flames + the Fiery Blood passive) ticks Skavag down; %maxHP DoT,
    //                 uncapped at 21-25 (unlike Enemy-Max-HP nukes, which the stage-20+ passive caps).
    //   SURVIVE     → Eldritch Flames self-heals 20% of damage vs HP-Burned targets, and Fiery Blood [P]
    //                 both burns attackers on hit AND stacks +10 RES per burning enemy (to +50) — RES is
    //                 exactly the Spider defensive stat (statGate ~300). The spiderlings burn themselves
    //                 down by attacking him.
    problems: [
      { key: 'SPIDERLINGS', name: 'Control the Spiderlings (deny Skavag her snowball)', meta: true,
        why: "THE central problem, unique to Spider. Spiderlings poison-stack your team, and Skavag eats them to HEAL + permanently gain ATK. Kill them or CC them before they act / before she consumes them, or she snowballs unkillable. Boss is CC-immune; the spiderlings are NOT — Provoke CONFIRMED working on them (Mike 2026-07-16), which matters because Provoke is far more accessible than hard CC, so a roster with no Stun/Freeze can still cover this seat.",
        tags: ['AoE Damage', 'Enemy Max HP Damage', 'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Petrification', 'Ensnare', 'Sheep', 'Seal', 'Master Seal', 'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)', 'Provoke'] },
      { key: 'TM-LOCK', name: "Deny Skavag her turn (Turn-Meter lock — works on the BOSS)", meta: true,
        why: "CONFIRMED (Mike 2026-07-16): Turn-Meter reduction WORKS on Skavag — the model previously credited TM only against the spiderlings, which made this whole path invisible. Her immunity is CC-only, and TM reduction is not CC (same reasoning that makes the Fire Knight lock work on Fyro; Dragon and Clan Boss are the exceptions, where TM reduction is explicitly immune). Skavag is therefore the FK-shaped case, not the Dragon-shaped one. INFERRED, needs confirmation: if she never acts, she should never CONSUME spiderlings to heal + gain ATK, which would make TM-LOCK a partial substitute for SPIDERLINGS control rather than a pure damage-denial — i.e. it may attack the snowball at its root. Like FK, the lock needs enough team SPEED to re-apply every cycle.",
        tags: ['Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)'] },
      { key: 'DAMAGE', name: 'Kill Skavag (several SUBSTITUTE damage families — pick one for your stage)',
        why: "DoT works on Skavag herself — CONFIRMED (Mike 2026-07-16), not assumed: her immunity is CC-only and there is no Infernal-Resilience-style dampener, so Poison/HP Burn are full-rate damage on the boss. Substitute strategies, stage-tiered: AoE nuke (early) → %enemy-MAX-HP (mid; enemies too tanky for raw AoE) → Poison-detonation (stack poisons, then explode for %maxHP) → HP Burn (%maxHP DoT, uncapped at 21-25). You need ONE family that fits your stage, not all four. Note the DoT families double-dip: the same poisons that kill Skavag also feed the Poison-Explosion detonators.",
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
    review: [
      'RESOLVED (Mike 2026-07-16): spiderlings CAN be Provoked — they are not Provoke-immune. Provoke stays in SPIDERLINGS (it was already listed on the assumption; now confirmed).',
      'RESOLVED (Mike 2026-07-16): Skavag herself DOES take DoT damage — her immunity is CC-only. Poison/HP Burn stay first-class in DAMAGE, undampened.',
      'RESOLVED (Mike 2026-07-16): TM reduction WORKS on Skavag — added the TM-LOCK problem. This was a MISSING PATH, not a missing tag: the model credited TM only vs spiderlings, so every TM-lock team was invisible to Spider. Worth auditing the other models for the same class of omission.',
      'STILL OPEN: does Decrease SPEED also work on her? Only TM reduction is confirmed. FK groups Decrease Speed into TM-LOCK; I have deliberately NOT assumed it here — it is a separate mechanic and needs its own answer.',
      'STILL OPEN: does TM-locking her also stop her CONSUMING spiderlings (heal + permanent ATK gain)? If yes, TM-LOCK partly substitutes for SPIDERLINGS control and the two problems trade off, the way FK TM-LOCK substitutes for SURVIVE.',
      'STILL OPEN: does Spider need its own TEMPO problem? FK has one because the TM-lock must be re-applied every cycle; the same should hold here, but no seat is modeled for it yet.',
      'RESOLVED (Mike 2026-07-16): the SOLO carriers are HP-BURN champs — Artak and Drexthar Bloodtwin. My Dark Kael / Taya Poison-Explosion candidates were a guess and are dropped as exemplars (Poison-detonation may still be a TEAM strategy; it is just not the known solo shape).',
      'DATA GAP (actionable): Drexthar Bloodtwin has NO Spider solo profile — only Dragon Stage 20. checkSoloCarries can never surface him for Spider until one is seeded (needs stage + required_set + mechanism). Artak has Spider 20 + 25, both status=proposed, so they are inert until approved.',
      'STILL OPEN: the exemplars above are SOLO carriers. The FK-equivalent accessible TEAM cheat code (Coldheart/Alure-tier, ideally Rare/Epic) is still unknown — and now that TM-LOCK is a confirmed Spider path, the natural question is whether the FK TM-lockers (Coldheart! Alure) do the same job on Skavag.',
      'STILL OPEN: no real-clear validation. FK/Dragon/CB were each checked against a captured clear; Spider has only mechanic confirmations. Gnut ladder (clean ~15, grind 18-19, wall 20) is the obvious ground truth to reconcile against ([[spider-den-coverage]]).',
    ],
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
    boss: "The Demon Lord — HE NEVER DIES (he bottoms out at ~1% HP and resets on the DAILY reset, not on a kill). TARGET = a ONE-KEY CLEAR = deal enough DAMAGE in a SINGLE key to earn the HIGHEST available chest at that difficulty — a per-key damage THRESHOLD (clan_boss_chest_tiers top tier). THE CHEST IS THE GOAL (not secondary). (Separately, when the clan collectively drains his bar to the 1% floor, everyone who damaged him gets a DOUBLE/bonus chest — so finishing ONE difficulty outright beats spreading hits across several.) So CB is a DAMAGE-THRESHOLD race: bank enough TOTAL key damage before Gathering Fury ramps enough to wipe you. NOT dungeon_stages 1-25: CB is 6 DIFFICULTIES (Easy/Normal/Hard/Brutal/NM/UNM), only mapped to stage_number 1-6 as plumbing to reuse the engine scan. AFFINITY (Mike + Plarium CONFIRMED 2026-08-05): he STARTS each day on VOID (your whole team is neutral into him, so you can reliably steer who eats his hits → the easiest mode); once the clan's cumulative daily damage drops that difficulty below 50% HP, the affinity changes to a RANDOM one of Force / Magic / Spirit for the NEXT battle (⚠ NOT mid-fight — your current key finishes in its current affinity; Plarium-confirmed 2026-08-05) and stays there until the DAILY reset. So each individual KEY is a SINGLE affinity (Void early in the day, the day's affinity later); AFFINITY MATCHUP + WEAK HITS matter on the affinity keys (see the `affinity` field). KIT (in-game Index, Tier-1, Demon Lord Hard cards read 2026-08-05 — the Index shows the VOID base): (1) 'Crushing Force' — SINGLE-TARGET: 'Attacks 1 enemy. Places a [Stun] for 1 turn — CANNOT be resisted. Damage ∝ [Enemy MAX HP]' → higher-HP target = harder hit, so park it on a HIGH-DEF / LOW-HP tank. (2) 'Flesh Wither' (community alias 'Belittle') — a TWO-HIT AoE scaling off his ATK; the AFFINITY-DEBUFF AoE, hits hard → pre-place Increase DEF / Shields BEFORE it lands. Places (2 turns): Void → 2.5% [Poison] / Force → 25% Decrease ATK / Magic → 25% Decrease ACC / Spirit → 15% Decrease SPD (SPIRIT is the toughest, its Decrease SPD wrecks turn tuning). (3) 'Dark Nova' (community alias 'Crash Through') — AoE scaling off his ATK: on VOID a SINGLE hit with no self-buff; on Force/Magic/Spirit a FOUR-hit that THEN self-applies 25% [Increase ATK] (2t). ⚠ SEQUENCING: the buff is applied AFTER the 4 hits, so the FIRST Crash Through is NOT boosted by its own buff — it ramps his SUBSEQUENT AoEs. (Confirmed via AyumiLove full skill listings + DeadwoodJedi.) Both AoEs scale off his ATK, so landing DECREASE ATK on him before they hit is the #1 survival lever. ⚠ NO waves precede him and he is a SINGLE target → AoE gives NO cleave advantage; prefer MULTI-HIT A1s (more Warmaster/Giant Slayer procs) + [Enemy MAX HP]-damage skills. He is also SLOW — boost team SPD / Turn Meter to land multiple hits per his turn. INFERNAL RESILIENCE [P] REDUCES incoming [HP Burn]/[Poison] AND enemy-MAX-HP-damage skills — and CRUCIALLY CAPS each tick at an ABSOLUTE value (the cap ALWAYS binds, so DoT is CAP-BOUND, NOT %maxHP — a 2.5% tick of a ~1.17B UNM boss would be ~29M, clamped to 25k). POISON cap per difficulty for a 2.5% poison (5% = double; rarity-independent; Poison Sensitivity multiplies AFTER: tick = cap×(1+PS)): Easy 10k / Normal 15k / Hard 20k / Brutal·NM·UNM 25k — see CB_POISON_CAPS in cb-damage-model.js. HP BURN is FLAT by placer rarity: Rare 50k, Epic+ 75k, and only ONE HP Burn can sit on the boss at a time. This is why the 10-debuff cap bites and stacking poison beyond it is wasted. Immune to Stun/Freeze/Sleep/Decrease SPD + MAX-HP-destruction/Turn-Meter-reduction/HP-exchange. ALMIGHTY IMMUNITY [P] adds immunity to Provoke/Block Active Skills/Block Passive Skills/Fear/True Fear/Petrification/Berserk/Enfeeble/Nullify/Ensnare/Fatigue/Hunter's Gaze + HP-balancing + cooldown-increase. UNFALTERING SPEED [P] re-states Decrease SPD + Turn-Meter-reduction immunity. GATHERING FURY [P] ramps ALL skills' damage from turn 10, harder from turn 20, and AT TURN 50 all attacks IGNORE [Block Damage] + [Unkillable] on each target — the hard 50-turn wall. (Tier-1 card lists ONLY this at t50; the earlier 'Block Revive on kills' was NOT on the card — dropped.) Warmaster/Giant Slayer on all 5 = the damage multiplier.",
    problems: [
      // THE VERDICT IS PURELY DAMAGE (Mike, 2026-07-16 — correcting the previous session's framing).
      // Pass/fail on a key = did TOTAL damage clear the TOP-CHEST threshold of the difficulty you ran?
      // Nothing else grades it. BOSS-TURN COUNT is DIAGNOSTIC — it says where you sit on the Gathering
      // Fury ramp (10/20/50) = PROGRESSION, not pass/fail — and is therefore NOT a prerequisite for the
      // loop: total key damage is already captured and the thresholds are already in the DB.
      // THE DELIVERABLE: suggest the TOP DIFFICULTY whose top chest the account can one-key. That is the
      // scanDungeonStages analogue on a 6-difficulty axis instead of a 25-stage one — a successful Easy
      // run and a successful Nightmare run look nothing alike; the goal is always "take the top chest at
      // the level I'm running".
      { key: 'DAMAGE', name: 'Bank enough key damage for the top chest (the CB one-key target)', meta: true,
        why: "GOAL = your single key's TOTAL damage clears the HIGHEST-chest threshold at that difficulty (clan_boss_chest_tiers). He never dies. TOTAL damage = damage-rate × turns survived, so BOTH survival depth and per-turn output feed it. Engine = Poison + HP Burn ticking every turn + Warmaster/Giant Slayer masteries (per-champ boolean, the single biggest lever — lib/masteries.js). CORRECTED (Mike's kit + 2026-08-05 writeup): INFERNAL RESILIENCE CAPS each DoT/%maxHP tick at an absolute per-difficulty value (~50k/tick poison at top tiers) — so at high difficulty poison is CAP-BOUND and barely scales with boss maxHP. That flips the engine from '%maxHP × turns' toward 'capped-tick × #ticking-debuffs × turns': maximize the NUMBER of ticking debuffs (up to the 10-cap) and the turns they run, not their %. Masteries (Warmaster/Giant Slayer) + attack damage carry the rest. Decrease DEF / Weaken amp only the ATTACK/mastery portion, NOT the DoT (damage-mechanics §1). (Short of the top chest, lower total = a lower chest tier.) CHEST RULE (in-game): prefer the TOP chest of a LOWER difficulty over the FIRST chest of a higher one — a Demon Lord's final chest always beats the next tier's first chest. NO waves + single target → an AoE nuke has no cleave advantage; the damage signal is MULTI-HIT A1s (WM/GS procs) + [Enemy MAX HP] damage, not AoE per se. AFFINITY KEYS: an on-hit debuffer that is WEAK into the day's boss affinity loses ~⅓ of its stacks to weak hits (which suppress hit-attached placement) — on those keys prefer Void/favorable-affinity champs, or non-hit debuff placers that bypass weak hits (see the `affinity` field). DoT is CAP-BOUND (Infernal Resilience): a 2.5% poison ticks the difficulty cap (Easy 10k … Brutal+ 25k), NOT %maxHP — maximize the NUMBER of ticking debuffs (to the 10-cap) × turns, not %.",
        tags: ['Poison', 'HP Burn', 'Enemy Max HP Damage', 'Poison Explosion', 'AoE Damage', 'Single Target Damage'] },
      { key: 'SURVIVE', name: 'Survive Gathering Fury (the wall at Brutal+; hard cap at turn 50)', meta: true, threat: 'mixed',
        why: "His two AoEs (Flesh Wither, a 2-hit that places the affinity debuff; Dark Nova, 1-hit on Void / 4-hit + self +25% ATK on the affinity keys) + the unresistable single-target Stun + the affinity debuff (Poison / Decrease ATK / Decrease ACC / Decrease SPD) all GROW every turn via Gathering Fury. VOID keys are gentle; AFFINITY keys (once the clan crosses 50% that day) are where teams die — and if the affinity is SPIRIT its Decrease SPD wrecks turn tuning (the hardest). Easy/Normal/Hard: a Speed team + a healer is enough. Brutal/NM/UNM: CUT his damage with Decrease ATK / Weaken, sustain (Lifesteal set healing off Warmaster/Giant Slayer, or a Leech debuff on the boss), and/or Unkillable / Block-Damage timing — BUT those STOP at turn 50 (Gathering Fury makes all attacks IGNORE Block Damage + Unkillable), so the run must effectively finish by ~turn 50. Counterattack teams add damage + self-sustain. Two timing keys: (a) pre-place Increase DEF / Shields BEFORE Flesh Wither (his hardest AoE) lands; (b) the single-target Crushing Force Stun hits HARD and locks a champ for 1 turn — answer it with Block Debuffs (stops the stun) or Cleanse (removes it), plus healing on the struck champ.",
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
    statGate: "MASTERIES = the multiplier: Warmaster or Giant Slayer on ALL 5 (per-champ boolean, lib/masteries.js — not a tag, never a filler). WM vs GS PER CHAMP: an A1 that hits 1–2× → Warmaster; an A1 that hits 3–4× → Giant Slayer (WM procs once/skill at 60%; GS procs per HIT at 30%, and both deal the SAME capped damage on the Demon Lord, so GS wins at ≥3 hits — cbMasteryProcs()). GEAR: whole team in LIFESTEAL (it heals off the mastery/attack damage) — gloves & chest main-stat HP% or DEF%, boots SPD; early-game, field your highest-RANK champs (a 6★/Lv60 out-stats a 5★/Lv50). Give the champ most likely to eat the single-target Crushing Force HIGH DEF + LOW HP (it reads the target's HP). DEBUFF CAP = 10 (can't stack >10 debuffs incl. Poisons — cap your poison stackers). ACC is ADVISORY, NOT a gate — 0 ACC is playable (you just land few debuffs). Landing is COMPUTED by debuffLandChance(acc, bossRES) (lib/formulas.js): ~100% at ACC = boss RES, and below it debuffs still land, just less often — never lock a team out on ACC. Per-difficulty boss RES (community Master CB Stat Chart 2026-08-05): Easy 30 / Normal 60 / Hard 90 / Brutal 130 / NM 170 / UNM 225 → RECOMMEND ~that much ACC to land Poison/Decrease-ATK reliably. Boss SPD (CONFIRMED, = clan_boss_stats): Easy 90 / Normal 120 / Hard 140 / Brutal 160 / NM 170 / UNM 190 — the '130/140/150' from the Master CB Stat Chart were CHAMPION-BUILD targets, NOT boss SPD. He is SLOW vs a fast team → out-speed him for multiple hits per his turn. Damage → chest tier (clan_boss_chest_tiers). THE 50-TURN WALL: Unkillable/Block-Damage/infinite-revive strategies FAIL at turn 50 (Gathering Fury) — bank the damage before then. Standard Brutal+ sustain = Lifesteal set (heals off the mastery damage); a Leech debuff on the boss can replace it.",
    affinity: "AFFINITY MATCHUP + WEAK HITS (writeup 2026-08-05; the sim ENGINE already models weak hits — WEAK_HIT_CHANCE 0.35 / WEAK_HIT_MULT 0.70 in lib/sim/engine.js). The boss starts each day VOID (neutral to all); once the clan's cumulative daily damage crosses 50% HP the affinity changes to a RANDOM Magic / Force / Spirit — but for the NEXT battle, NOT mid-fight (Plarium-confirmed): your current key finishes in its current affinity, and each individual KEY is thus a SINGLE affinity (Void early in the day, the day's affinity later; per DIFFICULTY — Easy's state is independent of Hard's), holding until the DAILY reset. TRIANGLE: Magic beats Spirit, Spirit beats Force, Force beats Magic; Void neutral both ways. A champ attacking a boss it is WEAK into: each DAMAGING hit has ~35% chance to be a WEAK HIT — ×0.70 damage, CANNOT crit, CANNOT place the debuffs attached to that hit, CANNOT trigger crit/normal/strong-dependent effects. The weak-hit roll fires BEFORE the ACC-vs-RES check, so even 100% placement + high ACC still fails on a weak hit. Hits the on-attack debuffs: Decrease ATK/DEF, Weaken, Poison, Leech, HP Burn, debuff-extension. NON-HIT debuff placers (skills that place WITHOUT an attack) are NOT subject to weak hits — they bypass this entirely. TEAM IMPLICATION (affinity keys only; Void keys are immune to weak hits): prefer VOID champs (never weak) or the FAVORABLE affinity vs the day's boss — Force boss → bring Spirit, Magic boss → Force, Spirit boss → Magic; a DISADVANTAGED on-hit poisoner loses ~⅓ of its intended stacks/damage. STUN TARGET: the boss tends to aim Crushing Force at a champ it is FAVORABLE into (Force→Magic champ, Magic→Spirit, Spirit→Force), but also weighs current HP / defensive buffs / Steadfast / killability — affinity is a component, not the whole rule. SIM (per DAMAGING hit): (1) attacker-vs-target affinity; (2) if attacker is weak, roll ~35%; (3) if weak → ×0.70, disable crit, suppress hit-attached debuff placement; (4) else resolve crit/normal/strong + ACC-vs-RES. Multi-hit skills roll hit-quality PER HIT (one hit weak while another is normal/crit). DISADVANTAGE = BOTH penalties (Plarium-confirmed 2026-08-05; engine.js already correct): EVERY damaging hit vs a stronger affinity is ×0.80, and if that hit ALSO rolls Weak (~35%) it takes ×0.70 more → 0.80×0.70 = 0.56. Average = 0.65×0.80 + 0.35×0.56 = 0.716 (−28.4%). Weak hits also can't crit (engine disables it) — count lost crits separately.",
    // EXCLUDED vs the Demon Lord (in-game Index, Tier-1, 2026-08-05 — Infernal Resilience + Almighty Immunity + Unfaltering Speed):
    //  • CC / control: Stun/Freeze/Sleep/Provoke/Fear/True Fear/Petrification/Berserk/Enfeeble/Nullify/Ensnare/Fatigue/Hunter's Gaze/Block Active Skills/Block Passive Skills — immune.
    //  • Decrease SPD + Decrease Turn Meter — immune (no slowing him, like Dragon).
    //  • MAX-HP-destruction, HP-exchange/balancing, cooldown-increase — immune.
    excluded: ['Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Provoke', 'Fear', 'True Fear', 'Petrification', 'Sheep', 'Ensnare', 'Seal', 'Master Seal', 'Block Active Skills', 'Block Passive Skills', 'Berserk', 'Enfeeble', 'Nullify', 'Fatigue', "Hunter's Gaze", 'Decrease Speed', 'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)', 'Increase Enemy Cooldowns', 'Block Cooldowns'],
    review: [
      "KIT CONFIRMED 2026-08-05 (in-game Index Tier-1 + AyumiLove full skill listings + DeadwoodJedi). A1 Crushing Force = single-target Stun (unresistable, 1t) ∝ target MaxHP. A2 Flesh Wither ('Belittle') = 2-HIT AoE placing the affinity debuff, 2 turns: Void 2.5% Poison / Force 25% Decrease ATK / Magic 25% Decrease ACC / Spirit 15% Decrease SPD. A3 Dark Nova ('Crash Through') = 1-hit on Void / 4-hit on Force·Magic·Spirit, THEN self +25% Increase ATK (2t) — buff applied AFTER the hits, so the first cast is not self-boosted; it ramps his later AoEs. Passive corrections already in boss[]: Gathering Fury t50 = ignore Block Damage + Unkillable only (no Block Revive); Almighty Immunity list expanded.",
      "AFFINITY = per-KEY single affinity; the switch is between BATTLES, not mid-fight (Plarium-confirmed 2026-08-05). Void each day until the clan's cumulative daily damage crosses 50%, then a RANDOM Force/Magic/Spirit for the NEXT battle until the daily reset. SUPERSEDES the earlier 'two-phase within one key' framing → a CB sim models ONE affinity per battle. Weak Hits (35%×0.70, engine.js already models them) apply on the affinity keys.",
      "DoT CAPS folded 2026-08-05 into CB_POISON_CAPS / CB_HP_BURN_TICK (cb-damage-model.js): Poison tick = difficulty cap × (1+PoisonSensitivity), rarity-independent, a 5% poison = 2× the 2.5% value; HP Burn flat 50k (Rare placer) / 75k (Epic+), only one at a time. ⚠ Easy/Normal/Hard poison values are COMMUNITY_OBSERVED (CB_POISON_CAP_PROVENANCE) — do not imply Plarium published them. NEXT (measured): wire the caps into estimateCbDamage + re-fit calibration via cb-model-validate.",
      "MASTERY CAP (CLOSED 2026-08-05): Warmaster & Giant Slayer ARE capped on the Demon Lord (NOT exempt) — the enemy-MaxHP cap applies to the mastery procs too, so WM's nominal 4% / GS's 3% maxHP do NOT land; a single WM proc and a single GS proc deal the SAME capped base. Weighting = capped-proc × expected procs: WM 0.60/skill (flat); GS hitCount×0.30/skill. GS ties WM at 2-hit and overtakes at 3-4 hits — the quantitative basis for WM(1-2)/GS(3-4). See cbMasteryProcs() in cb-damage-model.js. (Absolute per-proc capped value per difficulty is the one remaining data item for absolute totals.)",
      "Counterattack & Unkillable are TEAM ARCHETYPES (timing-tuned), not just tag presence — the model credits presence; the magnitude / AI-config layer judges whether the timing actually works before turn 50.",
    ],
    open: [
      // ALL KIT/MECHANIC QUESTIONS CLOSED 2026-08-05. Closed in the data drops:
      //  • switched-affinity cards (A2 2-hit + debuff %s / A3 4-hit + self +25% ATK);
      //  • poison 2.5% vs 5% (the BOSS places 2.5%; 5% is a champion poison strength — both capped, CB_POISON_CAPS);
      //  • low-tier boss SPD (= clan_boss_stats 90/120/140/160/170/190; the chart's 130/140/150 were champ-build targets);
      //  • per-difficulty DoT caps (Poison + HP Burn; Easy/Normal/Hard poison tagged community_observed);
      //  • weak-affinity disadvantage = ×0.80 flat AND ×0.70 more on a Weak hit (avg 0.716) — engine.js already correct;
      //  • Warmaster/Giant Slayer ARE capped on the Demon Lord (see review[] — cbMasteryProcs weighting).
      // The only remaining DATA item (not a mechanic question) is the absolute per-proc capped MASTERY damage per
      // difficulty, needed for absolute totals in cb-damage-model.js — the proc counts already settle WM-vs-GS.
    ],
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
