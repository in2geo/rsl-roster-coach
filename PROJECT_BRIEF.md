# Project brief

Full context behind the rules in `CLAUDE.md`. Read this once at project
start; update it as decisions change.

## 1. Product vision

A coaching tool for Raid: Shadow Legends players who are new, have a
limited roster, and don't know what to focus on. They need: which teams to
build from what they actually own, and which events/tournaments are worth
their resources right now.

This is deliberately NOT competing with veteran-focused tools (HellHades'
Optimiser, Gestal, RSL Helper/RSLTools, raidbro.com). Those are
combinatorics engines that need a large roster and deep gear inventory to
be useful — they have little to optimize for a beginner with 10-20
champions and minimal gear. The wedge here is judgment and triage
("what should I do next"), not stat optimization math.

## 2. Target user

New-ish players, limited roster, uncertain what to prioritize. Likely
lower willingness to pay (early in the game, not yet emotionally/
financially invested) — hence ads, not subscriptions, as the monetization
model. Likely higher churn than veteran players — design for fast
activation, not a slow-building relationship.

## 3. Core user flow

1. Player takes a screenshot of their roster screen on their phone.
2. Opens the web app in their mobile browser, taps Upload, picks the
   screenshot via the standard photo picker (works identically on iOS and
   Android — no special APIs needed for this).
3. A vision model reads the screenshot into structured data: champion
   identity, level, star/ascension rank. (NOT stats — those aren't visible
   on the roster screen. See section 5.)
4. The matching engine (plain code, not an LLM call) compares the
   player's roster against the dungeon-requirements table for whatever
   content they asked about, and picks the best available team from what
   they own.
5. The AI (Anthropic API) turns that structured result into a
   plain-language explanation — including naming any gap explicitly if no
   owned champion satisfies a need.
6. First plan of the day is free. "Refresh this" / "go deeper" actions are
   gated behind a rewarded video ad.
7. Daily push notification (requires the PWA to be added to the home
   screen — this is the actual reason that onboarding step matters, not
   just cosmetics) brings the player back.

## 4. Data architecture

Two tables are the source of truth. The AI explains decisions the tables
already made; it does not invent recommendations from memory.

### Champion table
Per champion: name, faction, affinity, rarity, and role/mechanic tags
(Decrease Defense, AoE Damage, Cleanser, Speed Aura, Revive, Block Damage,
Turn Meter Control, etc.) — tagged from the literal skill text, not from
"best champions" articles. Guides are biased toward Legendary/Epic by
nature (nobody writes "Top 40 Decrease Defense Champions Including the
Mediocre Ones"), which would leave gaps exactly where this audience's
rosters live: Common/Uncommon/Rare.

### Dungeon-requirements table
Per piece of content (dungeon + stage, or boss): requirements are written
as GOALS with a list of valid tag-level solutions underneath, not a single
required tag. Example (Spider's Den wave phase):

- Goal: prevent the wave from dealing sustained damage before you clear it
- Valid solutions: AoE Decrease Defense + AoE damage, OR AoE Stun/Freeze/
  Daze, OR AoE Decrease Turn Meter
- Speed also matters independently (falling behind the enemy's speed is a
  common, separate failure mode)

Where a dungeon has a wave phase AND a boss phase with different needs
(Dragon's Lair, Fire Knight, Ice Golem — NOT Spider's Den or the Clan
Boss, which skip straight to the boss), the table needs both phases'
requirements, and the matching engine has to find one team that covers
both reasonably well, surfacing the trade-off explicitly when nothing
covers both.

## 5. Two tiers of champion data — and why this matters for failure diagnosis

- **Tier 1 (free, from one screenshot):** identity, level, star rank.
  Powers the basic team-recommendation flow via role-tag matching. This is
  enough for "what team should I build" for a beginner.
- **Tier 2 (estimated, then optionally verified):** actual numeric stats
  (ATK/DEF/SPD/ACC/RES). A champion's base stats are fixed and known, and
  level/rank scaling is a known formula, so Tier 2 CAN be estimated from
  Tier 1 data without an extra screenshot. The estimate gets less
  reliable as a player accumulates gear, since gear is the one variable
  base-stat-plus-scaling can't capture.
- **When Tier 2 precision actually matters:** diagnosing "I have the right
  team but keep failing" (e.g. stuck between Spider 9 and 10). At that
  point gear variance is usually the real culprit, and the right move is
  to ask for actual stat-page screenshots of the specific champions in the
  failing team — not rely on the cheap estimate. Pair this with cheap
  triage questions first ("are you dying early or late in the fight,
  does one specific champion die first") before reaching for stat math —
  often narrows the diagnosis for free.
- Known mechanics that make stat-threshold math tractable: debuff landing
  is an Accuracy-vs-Resistance check capped between 3% and 100% (never a
  hard guarantee either way); some dungeons have known/formulaic
  thresholds (e.g. Spider's Den accuracy needed ≈ stage × 11); some
  effects bypass the check entirely (instant Decrease Turn Meter); bosses
  can have hardcoded exceptions (Hydra's unresistable Mark, Max-HP-damage
  caps on bosses at high stages that don't apply to wave enemies).

## 6. Data sourcing workflow (see CLAUDE.md for the hard rules)

For champion tags and dungeon requirements:
1. Read the primary source (in-game Index for skill text; official patch
   notes for new champions).
2. Draft the tag/rule proposal (Claude can help format this).
3. Human reviews and approves before it's live.

For judgment that can't be looked up (e.g. "AoE Freeze is an acceptable
substitute for AoE Decrease Defense because they solve the same problem —
deny sustained damage — through different mechanisms"): this comes from
watching account-review content (YouTube creators, forum threads) and
writing your OWN observation in your own words, then having Claude help
format that into a structured rule. Never scrape or transcribe the
source — the judgment is the valuable part, and it has to be synthesized,
not copied. Two separate outputs come from this: (a) rules for the
matching engine, (b) a style/tone reference for how the AI phrases
explanations — these are separate concerns and go in separate places.

Periodically check tag coverage BY RARITY (% of Common/Uncommon/Rare
champions with at least one tag filled in, vs. Legendaries) as a QA habit
— low coverage at low rarities is the blind spot that breaks fallback
logic silently.

## 7. MVP scope (don't build the full game on day one)

- Champions: ~100-150 that a real new player is likely to own (starters,
  common Campaign drops, early fusion rewards) — not all 900+.
- Content: 2-3 pieces (Campaign progression, Spider's Den, maybe early
  Clan Boss) — not full game coverage.
- Validate manually first: find a few real new players and do the
  recommendation by hand (no app) before building anything. If that
  doesn't get a genuinely excited reaction, the architecture doesn't
  matter yet.

## 8. Legal/business basics

- Name and disclaimer must read clearly as an unofficial fan tool — not
  affiliated with Plarium.
- Privacy policy + terms of service needed before ads go live (ad
  networks require this).
- Vercel's free Hobby tier is non-commercial only — budget for Pro once
  ads are actually live, not just at MVP/testing stage.
