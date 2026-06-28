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
