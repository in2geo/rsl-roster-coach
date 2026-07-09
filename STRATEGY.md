# RSL Coach — Product Strategy
This document captures the big-picture vision, competitive positioning,
and long-term roadmap. It is NOT the operational build guide — see
PROJECT_BRIEF.md and CLAUDE.md for that. This document changes rarely
and informs decisions about what to build next and why.
---
## The core insight
RSL Coach is not a Raid app. It is an AI recommendation engine for
roster-based games. Raid: Shadow Legends is the first game and the
validation vehicle. The product experience — roster entry, content
selection, team recommendation, plain-language explanation — is
identical across games. Only the data changes.
The "TurboTax of roster-based games" is the right analogy. People
don't use TurboTax because they don't know what taxes are. They use
it because it asks simple questions and gives them a personalized
answer. RSL Coach does the same:
- Who do you own?
- What content are you stuck on?
- What level are your champions?
- Here are your best options.
That conversational workflow adapts to any roster-based game.
---
## The AI architecture — why this is different from ChatGPT for Raid
The hardest technical problem in this space is that LLMs know games
superficially. They know facts but can't perform expert reasoning.
An LLM might know that Geomancer reflects damage — but an account
takeover expert thinks:
> "This player can't beat Dragon 25 because they're trying to force a
> speed team without reliable Decrease DEF. Their Geomancer is
> underbooked, but that's not the bottleneck. The real bottleneck is
> speed tuning. However, they own Stag Knight, so I'd build him next."
That reasoning isn't in any model's pretraining. It's experience.
RSL Coach solves this by separating the two jobs:
```
Player data
      ↓
Game-specific reasoning engine (deterministic code + expert rules)
      ↓
Candidate teams + gap analysis
      ↓
LLM explains WHY (never invents the recommendation)
```
The LLM is never responsible for making the expert decision. It's
responsible for explaining it. That's a much easier job and a much
more reliable product.
This is the chess engine model: a chess engine doesn't ask ChatGPT
what the best move is. It calculates the move. Then an LLM can
explain it. Raid works the same way.
The expert knowledge lives in:
- `goal_solutions` — OR-of-ANDs tag logic per dungeon goal
- `stat_threshold_checks` — numeric floors (ACC, SPD, RES, DEF)
- `champion_strategy_modifiers` — per-champion overrides for content
  (Geomancer single-slot burn, Ninja speed blitz, etc.)
- `champion_ai_notes` — AI settings that cause known failures
- `champion_solo_profiles` — solo carry capability per stage
The LLM reads the structured output of these tables and explains the
decision. It never invents the team.
---
## The data moat — the long-term competitive advantage
Every recommendation the app makes is an opportunity to collect
labeled outcome data:
```
Roster → Content → Recommended Team → Outcome (cleared / failed)
```
After 100,000 recommendations with outcomes attached, RSL Coach has
something OpenAI, Anthropic, Google, and every other model provider
does not have: a structured dataset of roster → content →
recommendation → outcome for real players in real games.
That dataset becomes the moat. It enables:
**Year 1:** Rules + heuristics + LLM explanations (current build)
**Year 2:** Collect thousands of recommendation outcomes. Refine
scoring weights based on real success rates. Know empirically that
"players with Geomancer, Pythion, and Stag Knight clear Dragon 25
successfully 84% of the time."
**Year 3:** Fine-tune a specialized recommendation model on real
player outcome data. Stop depending on a generic LLM's intuition
about game mechanics. The system is now grounded in actual results.
### How to collect this without annoying users
After every recommendation, show two buttons:
- 👍 Cleared it
- 👎 Didn't work
If they tap 👎, ask one follow-up:
- Died too fast
- Not enough damage
- Couldn't control waves
- Gear too weak
- Other
That's it. One tap (or two for failures). Enormous long-term value.
Every recommendation that goes out without a 👍/👎 is labeled data
that can never be recovered — so this launches with the MVP, not later.
---
## Platform expansion — games to pursue after RSL is validated
Do not expand until RSL Coach has:
1. Real players using it publicly
2. At least 5 new players with genuinely useful recommendations
3. Ad gate generating real (even if small) revenue
4. The feedback loop collecting real outcome data
Dominate one game first. Every subsequent game is easier because the
platform, the architecture, and the community trust already exist.
### Priority order for expansion
| Game | Opportunity | Notes |
|---|---|---|
| Summoners War | ⭐⭐⭐⭐⭐ | Deep roster, complex PvE, years of active players seeking advice |
| Honkai: Star Rail | ⭐⭐⭐⭐ | Enormous player base, frequent team advice questions |
| Epic Seven | ⭐⭐⭐⭐ | Large roster, PvE + PvP, gear complexity mirrors RSL |
| Wuthering Waves | ⭐⭐⭐ | Growing audience, strong team advice demand |
| Idle Heroes | ⭐⭐⭐ | Casual audience, same "who do I use?" core question |
| Marvel Strike Force | ⭐⭐⭐ | Large roster, raid content, similar decision space |
| Star Wars: Galaxy of Heroes | ⭐⭐⭐ | Deep, established player base with complex rosters |
### What each expansion actually requires
- Champion database for the new game
- Content requirements (dungeons, raids, equivalent of dungeon_stages)
- Tag taxonomy (each game's skill mechanics are different)
- Gear/progression system equivalent (RSL has gear tiers; SW has runes)
- Community trust wedge (every game has existing tools; need a clear
  reason why RSL Coach is better for new/limited players specifically)
The architecture already supports this via game_id on all key tables.
Adding a new game is primarily a data problem, not an engineering one.
---
## Competitive positioning
### What RSL Coach is NOT competing with
- HellHades Optimiser, Gestal, RSL Helper, raidbro.com — these are
  stat optimization engines for veteran players with deep rosters.
  They have little to offer a beginner with 10-20 champions.
- YouTube guides — passive content that requires watching 20 minutes
  to get one relevant piece of advice
- Discord help channels — requires asking a question and waiting
### What RSL Coach IS
- Active, personalized triage: "given YOUR roster, here's YOUR next move"
- Built for the stage before veteran tools become useful
- Fast activation (one session to first useful recommendation)
- Outcome-validated over time (not just expert opinion)
The wedge is judgment and triage, not stat optimization math. The
player question being answered is "what should I actually do tonight"
— not "what are the optimal substats for my Geomancer."
---
## Monetization path
**MVP:** Rewarded video ads. First daily recommendation free. Deeper
analysis, second content piece, failure diagnosis = one ad each.
**Year 2 options (research only, don't build yet):**
- Premium tier (no ads, unlimited recommendations) — only viable once
  there's evidence players return regularly and find value
- Creator partnerships — RSL creators already run referral links;
  RSL Coach could become a recommended resource in their onboarding
  flow, driving installs organically
- Game publisher partnerships — long shot, but Plarium and other
  publishers have incentive to keep new players engaged; a tool that
  reduces early churn has value to them
**Never:** Selling player data, affiliate links disguised as
recommendations, pay-to-win recommendations (recommending champions
based on who paid, not what's actually best).
---
## Content expansion within RSL (post-MVP)
Beyond Spider's Den and Clan Boss, the natural content expansion order
within RSL is:
| Content | Priority | Notes |
|---|---|---|
| Spider's Den stage 20 | High | Solo carry farming target, energy efficiency |
| Dragon's Lair | High | Most-farmed dungeon, gear progression gateway |
| Ice Golem | High | DEF-scaling gear, different team composition needs |
| Fire Knight | Medium | Turn meter control focused, different tag set |
| Arena (Bronze-Gold) | Medium | Different recommendation model — see below |
| Faction Wars | Low | Faction-locked teams, niche audience |
| Doom Tower | Now in scope | Full modeling started 2026-07-06 (reverses the earlier "deep endgame / out of target audience scope" call, per owner decision). Floors 1-120 Normal+Hard, waves, mid-bosses, rotation bosses, secret-room bosses. |
### Arena — the exception to the fixed-content model
Arena is the one piece of content that requires a fundamentally
different recommendation approach. Every other content type is
roster-vs-fixed-requirements. Arena is roster-vs-specific-opponent —
the recommendation changes based on what the player is facing.
This makes Arena harder to build but also more valuable as a
differentiator — no existing tool gives new players personalized
Arena counter-pick advice for their specific roster against their
specific opponent.
Research source when ready to build: Ragash Arena video documentation
(three identified videos — links to be added at build time). Treat as
human_observation sources — synthesize, never transcribe.
Target tier scope: Bronze through Gold only. Platinum+ is out of
scope for this app's target audience.
---
## Product design principles — recommendation output
### Confidence rating over binary verdict
Never use binary success/failure language. Use a confidence rating
that acknowledges gear, masteries, and stats as variables:
| Rating | Stars | Meaning |
|---|---|---|
| Very likely to succeed | ⭐⭐⭐⭐⭐ | Team covers all goals, stats comfortably clear thresholds |
| Likely to succeed | ⭐⭐⭐⭐ | Team covers goals, stats borderline on one threshold |
| Possible with good gear | ⭐⭐⭐ | Team covers goals but stats need work |
| Difficult | ⭐⭐ | One or more goals uncovered |
| Not recommended | ⭐ | Significant gaps, player needs different champions first |
Players understand that success depends on gear and stats — a
confidence rating feels more honest than a yes/no prediction and
is less discouraging for a new player.
### The free/gated content split
**Free — always:**
- Recommended team (5 champions, level, stars)
- Confidence rating (stars)
- AI-generated encouraging paragraph (never reveals specific gaps)
- "Biggest bottleneck" teaser — one sentence naming the category
  of the main issue without specifics ("your team lacks reliable
  debuff coverage" not "you need Decrease DEF")
- "Go deeper" button
**After one rewarded ad ("Go deeper"):**
- Confidence percentage (e.g. "87%")
- Strengths list (2-3 specific things this team does well)
- Weaknesses list (2-3 specific gaps with consequences)
- Gear benchmarks — specific stat targets per role:
  e.g. "Debuffer: 220+ ACC", "Fastest champion: 250+ SPD",
  "Nuker: 100% Crit Rate", "HP floor: 45,000+"
- Champion alternatives — if a recommended champion is underbuilt,
  show owned alternatives with rough effectiveness ranking
- Highest impact upgrade — one specific action ("Building Stag Knight
  to level 60 will improve your success rate more than any other
  single change")
- How to fix the main gap — farming location, stat target, build order
### Champion alternatives with effectiveness % — deferred to Year 2
Showing "High Khatun (80% effectiveness)" requires a scoring system
grounded in real outcome data. Do not invent percentages — they will
be wrong and will erode trust. Build this once the recommendation_outcomes
table has real data to draw from. For MVP, show alternatives as a
ranked list without percentages.
### Analytics to instrument from day one
Every event that isn't tracked from launch is data lost forever.
Instrument these before going public:
| Event | What it measures |
|---|---|
| roster_saved | Player completed setup |
| recommendation_requested | Player picked content |
| learn_more_clicked | Player tapped "Go deeper" |
| ad_completed | Player watched the full ad |
| gated_content_viewed | Player saw the deep analysis |
| day_2_return | Player came back next day |
| outcome_recorded | Player tapped 👍 or 👎 |
Target conversion benchmarks (from the conversation):
- learn_more_clicked / recommendation_requested: 40-60% = healthy
- If below 20%: free summary may be giving away too much, or gated
  content isn't communicating enough additional value
- day_2_return: the most important single metric for an ad-supported
  model — if players don't return, ads don't compound
---
## Confidence percentage calibration roadmap
The success percentage shown to players starts as a rule-based estimate
and gets more accurate as real outcome data accumulates. This is the
core mechanism that turns the feedback loop into a competitive moat.
### Phase 1 — Rule-based estimates (launch through ~1,000 outcomes)
Percentage derived from matching engine output:
- All goals + all thresholds + Strong/God Tier gear = 85-95%
- All goals + all thresholds + Dungeon gear = 70-84%
- All goals + one threshold borderline = 55-69%
- All goals + stats failing = 40-54%
- One goal unsatisfied = 20-39%
- Two or more goals unsatisfied = 5-19%
These are informed estimates, not measured rates. They are clearly
flagged as PLACEHOLDER ESTIMATES in the code. The percentage is
honest in direction (higher = better) but not yet calibrated to
real player outcomes.
### Phase 2 — First calibration (~1,000 outcomes per content type)
**Trigger:** 1,000+ recommendation_outcomes rows with non-null outcome
for a given dungeon_stage_id.
**Action:** Run this analysis query:
```sql
select
  verdict_band,
  count(*) as total,
  count(*) filter (where outcome = 'cleared') as cleared,
  round(100.0 * count(*) filter (where outcome = 'cleared')
    / count(*), 1) as actual_clear_rate
from recommendation_outcomes
where dungeon_stage_id = '<target_stage>'
  and outcome in ('cleared', 'failed')
group by verdict_band
order by verdict_band;
```
Compare actual_clear_rate against the displayed percentage for each
band. If a band is systematically off by more than 10 percentage
points, recalibrate that band's range. Update the config object in
the code — do not hardcode new values, keep them in the same
calibratable config.
**Who does this:** Mike reviews the query output and approves any
band changes before they go live. Same human-review principle as
champion tag approvals — no auto-merge on data that affects what
players see.
### Phase 3 — Per-composition rates (~10,000 outcomes)
**Trigger:** Enough data to compute meaningful rates for specific
team compositions, not just broad verdict bands.
**What becomes possible:**
- "Teams with Tagoar + Uugo covering Decrease DEF goals clear
  Spider 9 at an 83% rate" — real number, not an estimate
- Champion-specific success rate contributions
- Gear tier impact measured empirically, not assumed
**Action:** Replace the band-based percentage with a lookup against
historical success rates for similar team compositions. The matching
engine output becomes an input to a lookup rather than a direct
percentage calculation.
### Phase 4 — Specialized prediction model (~100,000 outcomes)
**Trigger:** Statistical significance across multiple content types,
multiple roster compositions, multiple gear tiers.
**What becomes possible:**
- The percentage is no longer derived from rules at all
- Direct prediction from roster composition against historical
  success rates
- Fine-tune a small specialized model on this dataset
- The model knows things no generic LLM knows: that players with
  Geomancer + Pythion + Stag Knight clear Dragon 25 at 84%, that
  Dungeon-geared Uugo fails the Spider 9 ACC threshold 60% of the
  time, that God Tier Tagoar solo clears Spider 10 at 91%
**This is the moat.** OpenAI, Anthropic, Google, and every other
model provider does not have this data. It cannot be scraped, bought,
or approximated. It only exists because real players used the app
and tapped 👍 or 👎.
### Calibration principle
The percentage should always feel honest. A team showing 87% should
clear roughly 87% of the time in practice. If real data shows it's
actually clearing at 71%, the display should say 71%. Never inflate
confidence to make the app look better — players will notice when
the "87%" team keeps failing and trust collapses. Accuracy over
optimism, always.
