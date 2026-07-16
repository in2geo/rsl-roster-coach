# Project brief

Full context behind the rules in `CLAUDE.md`. Read this once at project
start; update it as decisions change.

## 1. Product vision

A coaching tool for Raid: Shadow Legends players who are new, have a
limited roster, and don't know what to focus on. They need: which teams to
build from what they actually own, which events/tournaments are worth their
resources right now, and whether any champion they own can solo content
(which matters enormously during overlapping events and fusion tournaments
where energy allocation is the real constraint).

This is deliberately NOT competing with veteran-focused tools (HellHades'
Optimiser, Gestal, RSL Helper/RSLTools, raidbro.com). Those are
combinatorics engines that need a large roster and deep gear inventory to
be useful — they have little to optimize for a beginner with 10-20
champions and minimal gear. The wedge here is judgment and triage
("what should I do next"), not stat optimization math.

## 2. Target user

Account level 20–90 roughly — wide enough to include both players who
just hit their creator-link milestone champions and players who have been
running dungeon content for several months. Awakening (unlocks at account
level 42) is relevant to the majority of this range and should be treated
as a collectible field, not an edge case.

Most real users arrive via creator/referral starter-link codes — these
grant 2 unbooked Legendaries and 3 unbooked Epics on top of the standard
starter Rare (Kael/Athel/Elhain/Galek) and whatever Common/Uncommon drops
accumulate from early Campaign and fusion. So "limited roster" means small
and mostly unbooked/underleveled, not low-rarity — a typical day-1 roster
already includes Legendary and Epic champions.

Likely lower willingness to pay (early in the game, not yet emotionally/
financially invested) — hence ads, not subscriptions. Likely higher churn
than veteran players — design for fast activation, not a slow-building
relationship.

## 3. Core user flow

1. Player opens the web app and selects their champions by rarity
   (Mythical → Legendary → Epic → Rare). Each rarity opens a portrait
   grid sorted by how commonly new players own that champion (creator-link
   frequency ranking). Player taps each champion they own.
2. For each selected champion, the app collects: level (1-60), star rank
   (1-6), ascension level (0-6), gear tier (Starter/Dungeon/Strong/God
   Tier — self-reported), mastery tier (None/Basic/Complete), and an
   "is booked" flag. Awakening level only shown for accounts level 42+.
   One-time setup; data persists across sessions.
3. Player also sets their account level (used to sanity-check gear tier
   and gate awakening visibility).
4. Player picks a piece of content they want help with (dungeon + stage
   or Clan Boss difficulty).
5. The matching engine (plain code, not an LLM call) compares their roster
   against the dungeon-requirements table, estimates each champion's stats
   from base stats + level/star/ascension scaling + gear tier modifier,
   and picks the best available team. If any owned champion is a known
   solo carry for that content, this is surfaced as a separate callout
   before the team recommendation.
6. The AI (Anthropic API) turns that structured result into a
   plain-language two-part explanation: (a) what this team can do right
   now, (b) what specific action unlocks the next stage. Farming locations
   not raw stat numbers. Gaps named explicitly — never silently excluded.
7. First plan of the day is free. "Refresh this" / "go deeper" actions are
   gated behind a rewarded video ad.
8. Daily push notification (requires the PWA to be added to the home
   screen — this is the actual reason that onboarding step matters, not
   just cosmetics) brings the player back.

## 4. Data architecture

Four tables are the source of truth. The AI explains decisions the tables
already made; it does not invent recommendations from memory.

### Champion table
Per champion: name, faction, affinity, rarity, base stats (HP, ATK, DEF,
SPD, C.Rate, C.DMG, RES, ACC at level 60 fully ascended), and role/mechanic
tags (Decrease Defense, AoE Damage, Cleanser, Speed Aura, Revive, Block
Damage, Turn Meter Control, etc.) — tagged from the literal skill text, not
from "best champions" articles. Guides are biased toward flashy or
meta-relevant picks regardless of rarity — they skip champions that work
but aren't discussed. Coverage should be driven by whether a champion is in
the known starter-pack set, not by rarity tier alone.

### Dungeon-requirements table
Per piece of content (dungeon + stage, or boss): requirements are written
as GOALS with a list of valid tag-level solutions underneath, not a single
required tag. Example (Spider's Den):

- Goal: prevent the spiders from dealing sustained damage before you clear them
- Valid solutions: AoE Decrease Defense + AoE Damage, OR AoE Stun/Freeze/
  Daze, OR AoE Decrease Turn Meter, OR Enemy Max HP Damage, OR AoE HP Burn
- Speed and RES matter independently (separate stat_threshold_checks rows)

Where a dungeon has a wave phase AND a boss phase with different needs
(Dragon's Lair, Fire Knight, Ice Golem — NOT Spider's Den or the Clan
Boss, which skip straight to the boss), the table needs both phases'
requirements.

#### Wave-death vs boss-death — a loss is TWO possible failures, not one (2026-07-15)
A wave→boss stage is two fights in sequence, and a loss in each means something
completely different: dying on Wave 2 says nothing about boss survival, and dying
on the boss after a clean wave clear says nothing about wave requirements. The
first reconciliation question for any loss must be **"wave death or boss death?"**
— before team composition or confidence. A predicted-confident clear that died on
the WAVE means the wave evaluation is wrong; a boss death with cleared waves means
the boss evaluation is wrong. Blended, they tell you nothing.

Consequences (all OPEN as of 2026-07-15):
- **Capture (schema):** loss records need a `furthest_point_reached`
  (`wave_1|wave_2|wave_3|boss|cleared`) so wave-deaths and boss-deaths are separate
  populations. **NOT capturable today** — the battle log has no phase-at-death
  signal (`finishCause` says only how it ended, not where). This is a reader-
  investigation TODO in the same class as the per-champ damage decode: does the
  battle result record the wave/phase index at death?
- **Model:** the power/survival evaluator must score wave-clear and boss-fight
  SEPARATELY (different champ requirements: AoE/speed/wave-survival vs single-target
  damage/boss-sustain). Today it treats a stage as one boss encounter, and
  `dungeon_stage_enemies` has **no wave-enemy stats at all** (boss-only, + IG minions
  / Spider adds) — so even a known wave-death has nothing to score against. Second gap.
- **Calibration (blocks survival work):** split the loss population by
  `furthest_point_reached` BEFORE calibrating survival — boss deaths calibrate boss
  survival, wave deaths calibrate wave survival. As of 2026-07-15 there are 12
  reconciled losses, **6 of them Dragon's Lair (true sequential waves)** — so the
  confound is already active; the current blended set cannot cleanly calibrate either
  fight. Only the 2 Spider losses are unambiguous (single fight); the 6 Dragon + 4 IG
  are wave-confounded. (IG structure confirmed by Mike 2026-07-15: Wave 1 → Wave 2 →
  Boss, where the boss fight is the golem + 2 reviving minions — those minions are the
  boss-phase adds, not the waves, so there are still no wave-enemy stats for any dungeon.)

### Champion AI notes table (champion_ai_notes)
Per champion, per dungeon (or global): plain-language AI configuration
instructions for cases where wrong auto settings cause known run failures.
Only populated for champions where this actually matters — not every
champion. Examples: Elder Skarg A2 must be disabled until 3+ debuffs land;
Fayne A3 must target boss only, not spiderlings; Tholin A2 must be disabled
for Spider 10 solo runs.

### Solo carry profiles table (champion_solo_profiles)
Any champion known to be able to solo a specific dungeon stage. NOT limited
to starter-pack champions — covers any champion in the game. Includes
required gear set, key stat thresholds, AI settings, and a plain-language
explanation of why it works. This is surfaced proactively when a player
owns a solo carry: "You own [Champion] — they can solo [content] once built
this way. Here's where they are now vs. what's needed."

Solo carry capability matters especially during overlapping events and
fusion tournaments — a player who can solo Spider 10 with one champion
fills the other 4 slots with food champions, accomplishing two goals
simultaneously. This is week-2 knowledge that dramatically affects energy
allocation. Note: Clan Boss is NOT solo-able content and must never appear
in this table — Clan Boss is a shared damage race where maximizing all 5
champion slots is always the goal.

## 5. Stat estimation engine

The matching engine estimates a champion's real stats from:
base_stats (from champions table) + level/star/ascension scaling + gear_tier modifier

### Gear tier definitions (plain language shown to player)
- Starter — campaign drops, mostly unupgraded (+4 to +8)
- Dungeon — mostly +8 to +12
- Strong — mostly +12 to +16, good sets
- God Tier — +16 with great substats

### Important stat estimation notes
- ACC and RES are additive gear bonuses, not multiplicative — base ACC is
  0 for virtually all champions. Gear tier ACC/RES bonuses are flat adds.
- C.Rate and C.DMG base values vary per champion (most are 15%/50% but
  some differ — always use the value from the champions table).
- All gear tier modifiers are PLACEHOLDER ESTIMATES pending calibration
  against 10-15 real accounts. Do not treat as final. Store in a config
  file, not hardcoded in matching logic.
- Substat variance at God Tier is high and invisible to this system — flag
  this as a known accuracy ceiling, not a bug.
- Trust the player's self-reported gear tier over account-level inference.
  A level 35 spender may have God Tier gear.

## 5b. Contribution model — the recommendation engine's target architecture

The current match engine scores by tag COVERAGE (does a champ have the tag? yes/no).
Coverage cannot express magnitude or interaction — how much a debuff is worth, to
THIS team, given its damage type, over this many survival turns. The damage-mechanics
rules (`lib/damage-mechanics.js`, and the "Damage mechanics — interaction rules"
section in CLAUDE.md) are exactly those magnitude/interaction facts, so factoring them
in means evolving from **coverage-scoring → contribution-scoring**. Build it in layers;
do not flip selection to it until the validation gate below is met.

### Layer 0 — Rules as facts (DONE)
`lib/damage-mechanics.js`: source⇄debuff interaction matrix, saturation caps,
reliability/uptime, sustain-is-multiplicative, and the Layer 1 audit. Facts (allowed
to be model rules); magnitudes nominal until the feedback loop calibrates them.

### Layer 1 — Guardrail + honest explanation (DONE — no selection change)
- `battle-gaps.js` emits `debuff_type_mismatch` / `debuff_low_reliability` (right tag,
  wrong reason) and `debuff_reliability` (data-missing) via `auditTeamDebuffs`.
- `explain.js` surfaces damage-type mismatches so the coach credits a champion's real
  role (Uugo's heal), never a mismatched debuff (her Decrease DEF on a poison team).
- Changes what we SAY, not who we pick. Low risk, ships honesty now.

### Layer 2 — The contribution model (BUILD — generalize cb-damage-model.js)
`lib/contribution-model.js`: per-champion contribution for any content —

```
champ_contribution =
    own_damage(by source) × saturation(source)                       // §6 stack caps
  × Π debuff_multipliers the TEAM grants that source                 // §2/§5 interaction matrix
  × reliability_factor(each debuff term)                             // §7 chance × uptime/fight × auto_reliable — REQUIRED
  + Σ ( multiplier granted to allies × reliability_factor )          // credit supports for what they grant others
  + Σ ( survival_turns granted × team_per_turn_output )              // §3 sustain is MULTIPLICATIVE, not additive
```

- **The `reliability_factor` term is mandatory on every debuff contribution** (own and
  granted). Without it Layer 2 just trades the current overvaluation for a new one —
  full-crediting a Decrease DEF that lands 45% on a 4-turn cooldown. When reliability
  inputs aren't captured, `reliabilityFactor` returns `confidence:'unknown'`; the model
  must treat that as REDUCED CONFIDENCE, never silently as 1.0.
- Team output = **two-sided confidence**: `P(kill-speed beats survival-time within the
  time budget)`. Sustain shifts the survival side (multiplicative). Supports get
  credited for granted multipliers + granted survival, not their own damage bar (§4).
- Runs ALONGSIDE coverage first — to RANK and EXPLAIN and to be validated — not to
  override selection.

### Layer 3 — Selection consumes contribution (BUILD, GATED)
`selectTeam` + the verdict band read contribution scores instead of coverage counts.
Role-aware team selection, poison-saturation ("healer over the 4th poisoner"), and
not-demoting-supports all fall out of the math automatically.

**HARD VALIDATION GATE — Layer 3 does NOT go live until:**
> the contribution model's team rankings match observed battle outcomes in **at least
> 20 captured runs across at least 2 different dungeons** (measured via
> `run_reconciliations`: predicted verdict/ranking vs actual result), AND gear-tier
> multipliers have been calibrated against real accounts first.

Until BOTH conditions are met, Layer 2 may inform explanation and ranking display, but
the deterministic coverage engine remains the source of truth for the recommended team.
This gate is a named condition, not advice — the temptation to flip early is the risk
it exists to stop.

### Two hard dependencies (sequenced BEFORE trusting Layer 2 numbers)
1. **Gear-tier calibration comes first.** Placeholder stats feeding a precise
   contribution formula = false precision, worse than the honest binary. (See §5 and
   the gear-tier-work memory.)
2. **Incoming-damage-per-stage is missing data.** The survival half of the two-sided
   calc needs "how hard does stage N hit?" — not captured yet. Until it is, the
   survival side is estimated and the confidence must say so.

### Data gap opened by Layer 1 (capture task)
Reliability scoring needs, per debuff: `chance_unbooked` (populated on only ~3% of
`champion_tags`), debuff DURATION (not structured — lives in prose skill text), and an
`auto_reliable` attribute (described in CLAUDE.md but NOT yet a `champion_skills`
column). `cooldown_base` exists (~72%). Capturing these three is what upgrades the
Layer 1 reliability guardrail from "unknown" to a real score.

## 6. Failure diagnosis flow

When a player reports a failed run, surface three yes/no questions only:

1. "Is your team dying before clearing the spiderlings?"
2. "Are your debuffs landing — do you see Stun or Decrease DEF icons
   appearing on the spiderlings?"
3. "Are the spiderlings taking their turns repeatedly before your team acts?"

Map answers to failure modes and specific fixes. Only surface these when
the player explicitly taps "this team failed." The champion_ai_notes table
covers the fourth failure mode (wrong AI rotation) that these three
questions don't catch.

## 7. Data sourcing workflow (see CLAUDE.md for the hard rules)

For champion base stats: use raid.guide (https://raid.guide/en/stats/) —
approved source confirmed accurate against in-game screenshots. For skill
text and tags: in-game Index only. For dungeon requirements: in-game
observation plus patch notes. For solo carry data and AI settings: search
summaries from community sources, paraphrased in own words, never
transcribed.

For judgment calls (e.g. "AoE Freeze substitutes for AoE Decrease Defense
because they solve the same problem through different mechanisms"): synthesize
from watching account-review content, write in your own words. Two separate
outputs: (a) matching engine rules, (b) explanation style notes — these are
separate concerns and go in separate places.

Zero-tag champions must surface explicitly. Any champion the player selects
that has no approved tags must be flagged: "I found [Champion] on your
roster but don't have enough data on them yet." Never silently exclude.

QA habit: check tag coverage two ways — BY RARITY and against the known
starter-pack roster specifically. Rarity alone won't catch a gap in an
off-meta starter-pack Epic.

## 8. MVP scope

- Champions: ~100-150 that a real new player is likely to own — specifically
  the creator-link starter-pack Legendaries/Epics (Tagoar, Uugo, and the
  other high-frequency creator-link champions), the four traditional starter
  Rares, common Campaign drops, and early fusion rewards. Coverage priority
  is driven by creator-link frequency, not rarity tier.
- Content: Spider's Den stages 9-10, Clan Boss all difficulties.
- Do not expand to Spider 20 or Dragon's Lair until Spider 9-10 is validated
  with real players producing correct recommendations.
- Validate manually first: find a few real new players and do the
  recommendation by hand (no app) before trusting the architecture. If that
  doesn't get a genuinely excited reaction, the architecture doesn't matter.

## 9. Known open questions — do not assume answers

1. Mythical champion access for beginners — unconfirmed whether starter
   codes ever grant Mythical-tier champions. Do not build Mythical into the
   starter-pack assumption until confirmed.
2. Instant Decrease Turn Meter bypass — community lore says instant DTM
   bypasses the ACC/RES check. Plarium's own Coldheart write-up implies ACC
   matters. Unverified. The per-skill "cannot be resisted" clause is the
   real rule — verify via literal skill text, not category assumption.
3. Accuracy formula for Spider's Den — seed currently uses stage x 10
   anchored to Plarium's official site. Community sources range from
   stage x 10 to stage x 12.5. Treat as a floor-with-margin, not a
   confirmed exact target.
4. RES threshold for Spider's Den — no per-stage formula confirmed.
   AyumiLove cites ~300 RES as a rough rule of thumb. Directional only.
5. Gear tier stat multipliers — all current values are placeholder
   estimates. Must be calibrated against 10-15 real accounts before shipping.

## 10. Legal/business basics

- Name and disclaimer must read clearly as an unofficial fan tool — not
  affiliated with Plarium.
- Privacy policy + terms of service needed before ads go live (ad
  networks require this).
- Vercel's free Hobby tier is non-commercial only — budget for Pro once
  ads are actually live, not just at MVP/testing stage.

## 11. Platform vision (post-MVP — do not build until RSL is validated)

RSL Coach is being built as a game-agnostic recommendation engine, not
a Raid-specific tool. Raid: Shadow Legends is the first game and the
validation vehicle. The architecture already supports multi-game expansion:
champion table, dungeon requirements, tags, goals, and goal solutions are
all game-scoped via game_id (see add-game-id-migration.sql).

The core product loop is identical across games:
1. Player creates roster (manual selection from a champion list)
2. Player picks content they're stuck on
3. Matching engine compares roster against content requirements
4. AI explains the result in plain language
5. Gaps named explicitly, solo carries surfaced, AI settings flagged

Only the data changes per game — champion database, content database,
tag taxonomy, dungeon requirements, recommendation rules. The UI,
matching engine logic, ad gate, and explanation layer are reused.

### Expansion priority (research only — do not build yet)

| Game | Opportunity | Notes |
|---|---|---|
| Summoners War | ⭐⭐⭐⭐⭐ | Deep roster, complex PvE, years of active players |
| Honkai: Star Rail | ⭐⭐⭐⭐ | Large player base, frequent team advice questions |
| Epic Seven | ⭐⭐⭐⭐ | Large roster, PvE + PvP, gear complexity |
| Wuthering Waves | ⭐⭐⭐ | Growing audience, team advice demand |
| Idle Heroes | ⭐⭐⭐ | Casual audience, same core "who do I use?" question |

### The sequencing rule

Do not expand to a second game until:
1. RSL Coach is publicly live
2. At least 5 real new RSL players have used it
3. At least 3 of those players said the recommendation was genuinely useful
4. The ad gate is generating real revenue (even if small)

"Dominate one first" is not just strategic advice — it's the validation
gate that makes the platform story credible. Expanding before RSL is
proven wastes the data and community trust that make each subsequent
game easier to launch.

### What Summoners War expansion would actually require
(For planning purposes only — do not start this work yet)
- Champion database for SW (different stat system, runes not gear)
- Dungeon requirements for key SW content (Toa, GB10, DB10, etc.)
- Tag taxonomy for SW skills (different from RSL — awakening bonuses,
  leader skills, passive conditions all work differently)
- Rune system understanding (SW's equivalent of RSL gear tiers, but
  significantly more complex — 6 rune slots, set bonuses, substats)
- Community trust: SW players have their own tools (SWOP, SWARFARM)
  the same way RSL players have HellHades — need a clear wedge

## 12. Arena — post-MVP content area

Arena is explicitly deferred until Spider's Den and Clan Boss are
validated with real players. It requires a fundamentally different
recommendation approach than dungeon content and should not be
conflated with the existing matching engine.

### Why Arena is different

Every other piece of content in RSL Coach is roster-vs-fixed-content:
the dungeon requirements are known, static, and the same for every
player. The matching engine checks whether a player's roster covers
the required goals.

Arena is roster-vs-specific-defense: the player is attacking a
specific opponent's team, which changes every fight. There is no
fixed "goal list" — the recommendation depends on what the opponent
is running. This requires a different data model and a different
matching approach entirely.

### What Arena recommendations actually need

1. The player's offensive roster (already collected)
2. The opponent's defense team (new input — player describes or
   selects the 4 champions they're facing)
3. A recommendation engine that evaluates the player's roster against
   that specific defense — affinity advantages, counter-picks,
   speed tuning for first-turn advantage, debuff immunity awareness

This is a meaningfully harder problem than dungeon content because:
- The "dungeon requirements" change every fight
- Speed tuning for first-turn advantage is critical and highly
  specific to the matchup
- Affinity countering matters more in Arena than in PvE
- The meta shifts with patches — what counters what changes over time

### Arena tiers to cover (when building)

New players encounter Arena in roughly this progression:
- Bronze / Silver — mostly unoptimized defenses, speed and basic
  debuffs dominate
- Gold — speed tuning becomes critical, unkillable and revive teams
  appear
- Platinum+ — out of scope for this app's target audience

MVP Arena scope (when built): Bronze through Gold only. Do not attempt
Platinum+ recommendations — that audience is already served by
veteran tools.

### Research source — Ragash Arena documentation

When ready to build Arena recommendations, the Ragash Arena videos
are a documented starting research source for which champions matter
at which tier. Three videos have been identified as relevant —
links to be added when the build begins. These should be treated as
human_observation sources (synthesize the judgment in your own words,
never transcribe). The no-YouTube-scraping rule applies — watch the
videos and record your own observations, do not attempt to pull
transcripts.

### Schema additions needed for Arena (design only — do not build yet)

The current schema handles fixed-content recommendations via
`dungeon_stages` and `goals`. Arena will need:

- An `arena_tiers` table (Bronze/Silver/Gold/Platinum)
- A way to input opponent defense (4 champions + their approximate
  gear tier)
- Counter-pick logic that differs from the OR-of-ANDs goal system
- Speed threshold checks specific to first-turn advantage
  (different from the Clan Boss speed tune brackets)

Do not add these tables until Arena is actively being built — the
game_id architecture already supports adding Arena as a content type
without schema restructuring.
