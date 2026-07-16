# Project rules

See `PROJECT_BRIEF.md` for full context (product vision, data model, worked
examples, monetization, build order). This file holds only the rules that
should apply in every session.

## What this is
A mobile-first PWA that gives new/limited-roster Raid: Shadow Legends
players a personalized "what should I do next" recommendation, based on
their manually-entered roster. Not necessarily a tool for veteran players with deep
rosters — that segment is already served by other tools.

## The product model — how the app builds teams (READ FIRST)

**Canonical doc: `knowledge/team-building-model.md` — read it first.** The app beats content by
**role-based mechanic-solving**, NOT by predicting a power ceiling. In one line: each content is a set of
mechanical **PROBLEMS**, each solvable **many ways** (never a fixed comp); a team is **5 SEATS**, each
filling a **primary role** (multi-role champs free seats); the **build** (ACC/RES, gear, masteries) decides
whether a capability actually fires; recommend for **AUTO**, judged by **TIME**; and it's a **LOOP** — the
battle result diagnoses the short seat, then you re-solve it **without breaking the roles that already
worked**. It's **per-account** — the right team is usually NOT the 5 most-developed champs. The older
power/goal-coverage framing (below, and `POWER_LAYER_SCOPE.md`) is **superseded as the primary approach**
(brute force is just the survival half of one problem). Detail: INS-0026…0029 in `knowledge/insights-ledger.md`;
code in `lib/dungeon-mechanics.js`, `lib/team-assembler.js`, `data/keyword-glossary.json`.

## Deep Blue model — modeling console (READ FIRST when Mike mentions it)

Mike builds this engine by *conversing to improve it* (the "Deep Blue" vision — the AI that
beats a grandmaster, not a chatbot for players). Whenever he references **"the Deep Blue
model"** or the work around it, the canonical, always-current reference is
**`knowledge/DEEP_BLUE_STATUS.md`** — read it first, then `knowledge/insights-ledger.md`
(INS-0001…, the durable brain). The loop is capture → reconcile → measure → propose → retain →
predict; a change must be validated (shadow) before it drives live recommendations.

Current one-line state (2026-07-16): the **PRODUCT is the team-building model above** (role-based
mechanic-solving + the result loop) — `knowledge/team-building-model.md`, INS-0026…0029. The power/
kill/survival **evaluator (`lib/power-model.js`) is SUPERSEDED** as the product — it's now just the
survival half of one problem and was never wired into recommendations. The modeling-console *method*
(converse → improve → capture → reconcile → retain) still stands, and the CAPTURE loop is now
trustworthy end-to-end (RslBattleReader: identity + survival + per-hero damage all **verified live
2026-07-16**). DEEP_BLUE_STATUS.md now banner-points at team-building-model.md and retains the
evaluator's calibration history below that.

## Stack
- Frontend: mobile PWA, plain HTML/CSS/JS, no framework, no build step
- Hosting: Vercel (static files + /api/* serverless functions)
- Backend/DB: Supabase (Postgres + auth + storage)
- AI: Anthropic API (separate from claude.ai — console.anthropic.com)
- Monetization: rewarded video ads. First daily recommendation always free.

## Current project state (data-grounded refresh — 2026-07-13)

Counts below are from a live DB query on 2026-07-13. Detailed provenance for recent
work lives in session memory (see the memory index); this is the snapshot. Run the
"Content coverage check" query below to refresh dungeon numbers before relying on them.

### Champions & skill data (live)
- **1,021 champions** — Legendary 419, Epic 309, Rare 243, Mythical 40; plus 10
  Common/Uncommon that are OUT OF SCOPE and carry no tags (Rare+ in scope = 1,011).
- **champion_skills**: 934 champions have verbatim `skill_summary` (~92% of Rare+).
  ~78 Rare+ have NO skill text — a data gap needing fresh capture (the raid.guide
  scrape is exhausted). **champion_auras**: 656.
- **champion_tags**: 4,525 approved / 107 proposed / 178 rejected. **Tag vocab: 103.**
  The tag layer was REGENERATED from `skill_summary` via LLM on 2026-07-13 — see the
  "Tag source of truth" note under Tag Review Policies (bracket-scraping is deprecated).
- **champion_solo_profiles**: 45 (Dragon/Spider/Ice Golem/Fire Knight, Normal+Hard).
- **champion_aliases**: 420 (generator + live resolver exist — extend, don't rebuild).
- champion_names localization table: English seeded.

### Dungeon content coverage (live 2026-07-13)
| Dungeon | stages | actionable goals | approved solutions | thresholds |
|---|---|---|---|---|
| Clan Boss | 6 difficulties | 26 | 56 | 10 |
| Dragon's Lair | 25 (full 1-25) | 100 | 386 | 50 |
| Fire Knight's Castle | 25 (full 1-25) | 113 | 326 | 50 |
| Ice Golem's Peak | 25 (full 1-25) | 73 | 169 | 62 |
| Spider's Den | 9 (3 strategy tiers) | 12 | 33 | 3 |
| Campaign | 1 | 2 | 3 | 0 |
| Doom Tower | 24 seeded | **0 — content TODO** | 0 | 0 |
| Event Dungeon (Generic) | template row only; no stages/goals seeded |

- Totals: goal_solutions **973 approved / 0 proposed / 4 rejected** — all four core
  dungeons (Fire Knight, Spider, Ice Golem, Dragon) now have the **full Normal 1-25
  ladder built AND approved** (2026-07-13). Nothing is left in `proposed`.
- All four dungeons **auto-scan for the best clearable stage** (no stage picker) via
  `scanDungeonStages` / `scanSpiderStages` in the match engine. Boss mechanics
  (FK shield 10-hits/round, IG Frigid Vengeance, Dragon Inhale→Scorch, etc.) live in
  the `boss_exceptions` + `explanation_style_notes` tables and their seeds.
- **Remaining dungeon work:** Hard mode for all four (Tainted bosses); Doom Tower
  content (24 floor stubs, zero goals). All stat floors are CALIBRATION-NEEDED
  placeholders (see the Stat estimation notes section).

### Engine & tooling — BUILT
- **THE PRODUCT MODEL (2026-07-16, `knowledge/team-building-model.md`):** `lib/dungeon-mechanics.js`
  (each content = mechanical PROBLEMS × open ability-sets, INS-0027), `data/keyword-glossary.json`
  (semantic layer — what each ability DOES, INS-0028), `lib/team-assembler.js` + `tools/assemble-team.mjs`
  (5-seat role selection + the result-driven loop: diagnose short seat → constrained fix, INS-0029).
  These are the current core; the deterministic match-engine below is the older goal-matching layer.
- Deterministic match engine (`lib/match-engine.js`): solo-carry-first, team
  selection (**usability-gated as of 2026-07-13** — see the selectTeam ordering),
  Spider highest-confidence-stage scan, Clan Boss stun matrix, leader-aura
  selection, global sustain / CC-sustain / team-requirement checks, verdict bands.
- `lib/formulas.js`, `lib/estimate-stats.js` + `lib/effective-stats.js`,
  `lib/masteries.js` (Warmaster/Giant Slayer boss model), `lib/cb-damage-model.js`
  (%maxHP/DoT source model), `lib/synergies.js` (2+-champ combo layer).
- Data pipeline: master worksheet (`RAID Master Database … .xlsx`) -> committed
  `seeds/*.sql` -> live via `tools/apply-seed-pooler.mjs`; read live via
  `tools/live_db_read.mjs` (REST). Seeds committed through 139 (136 tag enrichment,
  137/139 Multi-Hit A1 backfill, 138 tag-descriptions-from-glossary — all proposed).
- Gestal sync + RslBattleReader — battle capture now TRUSTWORTHY end-to-end
  (**5-hero identity + survival + per-hero damage all verified live 2026-07-16**, see
  the rslbattlereader-status memory); engine feedback/calibration loop.
- Profiles layer (multi-roster over rsl_accounts + user_champions); event-dungeon
  architecture (is_event/active_until + generic fallback).

### Known gaps / next
- **Doom Tower**: 24 stages seeded but zero goals/solutions/thresholds — needs boss
  kits + content.
- **~78 Rare+ champions have no skill text** (capture task); 107 tags still proposed.
- **~82 stat/constraint goals** are mis-modeled as tag-coverage — need a non-tag
  mechanism (see the goal-solution-skeleton-fix memory).
- `champion_strategy_modifiers` for Fire Knight / Ice Golem: not seeded.
- Direct game-memory roster extractor (Option B): partially built (see memory).
- Frontend/monetization (ad gate, feedback UI, waitlist): wiring status per memory;
  prod is AT Vercel's 12-function cap (see the vercel-deploy-cap memory) — any new
  `/api/*` route re-breaks deploys.
- **Synergy layer** is the natural next lever now that tags support it (Pallas's
  Argonite ally-attack, Fahrakin's team beatdown, etc.).

### Content coverage check (run before assuming any dungeon is complete)
```sql
select d.name as dungeon, ds.label as stage,
       count(distinct g.id) as goal_count,
       count(distinct gs.id) as solution_count,
       count(distinct stc.id) as threshold_count
from dungeons d
join dungeon_stages ds on ds.dungeon_id = d.id
left join phases p on p.dungeon_stage_id = ds.id
left join goals g on g.phase_id = p.id
left join goal_solutions gs on gs.goal_id = g.id and gs.status = 'approved'
left join stat_threshold_checks stc on stc.phase_id = p.id
where d.game_id = 'raid_shadow_legends'
group by d.name, ds.label
order by d.name, ds.label;
```

## Data sourcing — hard rules
- CANONICAL, detailed hierarchy (Tier 1–3 sources, unbooked back-calculation
  formula, the in-game Index star-color ascension rule + default `=3` for
  passives/auras, and the `source_type` value mapping) is the "## Source
  hierarchy for skill data (champion tags)" section below — that section governs
  on any conflict. (SOURCE_HIERARCHY.md was consolidated into this file and
  removed 2026-07-07.)
- NEVER scrape YouTube (videos, transcripts, or comments).
- The restriction on community sites is specifically about their EDITORIAL
  CONTENT — tier lists, champion ratings, "best champions" guides, build
  recommendations, dungeon strategies. This content represents their expertise
  and work product and must not be copied into seed files or used as the basis
  for tag/recommendation logic.
- FACTUAL GAME DATA is not restricted — champion names, factions, affinities,
  rarities, base stats, skill names, skill descriptions, ascension unlock
  information. These are facts about the game that Plarium publishes. Reading
  these facts from any source (including HellHades, AyumiLove, etc.) as a human
  researcher is fine — the restriction is on automated scraping and on using
  their editorial judgment as a source of truth for recommendations.
- DO use as primary sources: the game's own in-game Index/Compendium (skill
  text for any champion, owned or not), official Plarium patch notes, and the
  Fandom wiki (CC-BY-SA).
- DO use raid.guide (https://raid.guide/en/stats/) for champion base stats, and
  for verbatim champion SKILL DESCRIPTIONS on the per-champion pages
  (https://raid.guide/en/shadow-legends/<slug>/) — Plarium's literal skill text,
  confirmed accurate, not on the no-scrape list. raid.guide's tier ratings /
  "best build" opinions remain off-limits (editorial).
- Tag champions from literal skill text only — never from tier lists or "best
  champions" guides. Those are biased toward Legendary/Epic and miss exactly the
  Common/Uncommon/Rare champions this audience actually owns. Tags sourced from
  skill text are `status='proposed'` and human-reviewed before they go live.
- Every new tag or rule gets proposed in structured form, then reviewed and
  approved by a human before it's considered live. No auto-merge.
- Zero-tag champions must surface explicitly — never silently exclude.

## Source hierarchy for skill data (champion tags)

When proposing champion_tags rows, use the following hierarchy in order
of preference:

### Tier 1 — Primary sources (use these first)
- **In-game Index / Compendium**: exact unbooked skill text, ascension
  gate confirmation (padlock visible on unascended champion), cooldowns.
  This is the only reliable source for ascension gate status.
- **Official Plarium patch notes**: new champion card images with full
  skill text. Booked or unbooked status must be noted — patch cards
  typically show base values.
- **Fandom wiki (CC-BY-SA)**: verbatim skill text acceptable.
- **raid.guide**: verbatim Plarium skill descriptions and base stats.
  Confirmed accurate for base stats. Booked values shown — back-calculate
  unbooked using book progression table.

### Tier 2 — Acceptable for factual game data (human reading only)
HellHades, AyumiLove, InTeleria, and similar community sites may be read
by hand to extract factual game data — skill names, descriptions,
percentages, book progressions, cooldowns. These are Plarium's numbers,
not the site's editorial content.

**Permitted**: reading booked skill percentages and book progression tables
by hand to back-calculate unbooked values.

**Formula**: `unbooked_chance = booked_value - sum(Buff/Debuff Chance
increases in book progression)`

Example — Alice the Wanderer A2 Clockwork Cyclone:
- Booked value (from any source): 75%
- Book progression: +10% (Lvl 4) + +15% (Lvl 5) = +25%
- Unbooked: 75% - 25% = 50%

**Never permitted**:
- Using their tier lists, ratings, or build recommendations as the basis
  for tag/recommendation logic
- Treating "best champion" picks from guides as our source of truth

### Tier 3 — Not acceptable as source of truth
- Editorial content from any community site: tier lists, champion ratings,
  "best champions" rankings, build guides, dungeon strategy opinions
- YouTube video content (videos, transcripts, comments)

### In-game Index star color rule (ascension verification)

Star color on the champion detail screen indicates ascension status:
- **MAGENTA/PINK stars** = champion shown at max ascension
- **YELLOW stars** = champion shown unascended (base skill values only)

#### Critical constraint
- **Owned champions**: shown at their ACTUAL current ascension level.
  If you have ascended a champion, the Index shows the ascended version.
  You cannot see their unascended state from your own account after
  ascending them.
- **Unowned champions**: always shown at MAX ascension in the Index
  regardless of gate. Always magenta. Cannot be used to determine
  unascended skill text.

#### Implication
The ONLY way to see unascended skill text from the in-game Index is to
own the champion AND not yet have ascended them past the gate you are
trying to verify.

#### Verification windows
| Scenario | Can verify unascended state? |
|---|---|
| Own champion, not yet 3-star ascended | ✅ YES — screenshot now before ascending |
| Own champion, already ascended | ❌ NO — need second account or YouTube |
| Don't own champion | ❌ NO — Index always shows max ascension |
| New champion just obtained | ✅ YES — screenshot all skills before ascending |

#### Standing rule
Because most owned champions are already ascended and unowned champions
always show max ascension, passive and aura ascension gates CANNOT be
confirmed from the in-game Index in most cases.

Default: `ascension_required = 3` for ALL passives and auras. Override only
when a yellow-star screenshot explicitly shows no padlock on the passive or
aura slot.

Confirmed ascension-gated:
- Yellow-star screenshot confirmed:
  - Criodan the Blue — Snow Dancer [P]: ascension_required = 3
  - Pelops the Victor — Master of Games [P]: ascension_required = 3
- Prior in-game screenshot (confirmed before the star-color standard;
  re-verify to yellow-star when the champion is next unascended):
  - Skeletor — Master of Evil [P]: ascension_required = 3
  - Seeker — DEF Aura: ascension_required = 3
  - Glorious Pallas — Shield of the Argolades [P]: ascension_required = 3

Confirmed ascension upgrade (magenta-star shows new debuff vs yellow
would show less):
- Fayne A2 — Decrease ATK: ascension_required = 3 (magenta shows both
  Poison + Decrease ATK; unascended A2 has Poison only)

Confirmed NOT gated (yellow-star screenshot showed no padlock):
- None confirmed yet — default to 3 until proven otherwise

#### Action rule
Every time a new champion is obtained: screenshot all skill slots from
the in-game Index BEFORE ascending. This is the primary source window
for unascended skill text. Once ascended, that window closes permanently
on your account.

### Tagging convention — conditional debuffs
DEFAULT (do not tag): a debuff that only lands when a SPECIFIC OTHER DEBUFF is
already on the target is NOT given its own `champion_tags` row — the champion
can't deliver it unaided, so the matching engine must never count it as a
capability. Document the conditional effect in the `source_note` of the
champion's PRIMARY tag row instead.
- Example: Pharsalas (DB name `Pharsalas`; a.k.a. Pharsalas Gravedirt) A1 places
  Decrease ATK only if the target is already under Fear/True Fear → do NOT add a
  Decrease Attack tag; note the condition on his Provoke row.
- Same principle already applied to Staltus's conditional A1 Turn Meter decrease
  (fires only if the target already has a debuff) — rejected in seed 64.

EXCEPTION — crit-conditional debuffs ARE tagged. A debuff placed "on a critical
hit" DOES get a normal tag row: Crit Rate is a player-controlled gear stat and a
widely understood mechanic, so the player can make it reliable. Tag it at 100%
unbooked, with a `source_note` flagging "places on critical hit."

### source_type values for champion_tags
| Source used | source_type value |
|---|---|
| In-game Index screenshot | `in_game_index` |
| Patch notes card image | `in_game_index` |
| raid.guide scraper | `raid_guide` |
| Fandom wiki | `fandom_wiki` |
| Hand-read from HellHades/AyumiLove | `human_observation` |
| Back-calculated from booked + books | `human_observation` |

Always document the back-calculation in source_note:
`'AyumiLove (human read): 75% booked. Books: +10% Lvl4, +15% Lvl5.
Unbooked = 50%. Back-calculated per project source hierarchy.'`

## Tag Review Policies
Standing rules for deciding whether a skill effect earns its own `champion_tags`
row. Established across advisor batch reviews; canonical reference for all future
tag work. "REJECT" = do not create a tag row; note the mechanic in the
`source_note` of the champion's primary/related tag row instead.

1. **Conditional debuffs** — a debuff that lands only if a SPECIFIC OTHER DEBUFF
   is already on the target → REJECT **only when the prerequisite must come from an
   ALLY or external source**. Note the condition in `source_note`.
   (See "Tagging convention — conditional debuffs" above.)
   - **SELF-COMBO EXCEPTION (APPROVE):** if the SAME champion reliably places the
     prerequisite debuff itself, the champion delivers the whole chain unaided
     (across turns) and IS a carrier → APPROVE, noting the self-combo in
     `source_note`. Ruling 2026-07-12. Examples: **Frozen Banshee** — A1 Poison
     requires [Poison Sensitivity], which her A3 places → tag Poison. **Coldheart**
     — A2 Poison requires [Heal Reduction], which her A1 places → tag Poison.
   - RE-REVIEW under this rule: prior REJECTs made before this ruling where the
     champion self-provides the prerequisite (e.g. Pharsalas's Decrease ATK vs his
     own Fear; Staltus's TM decrease, seed 64) should be re-checked, not assumed.
2. **Random pool placers** — a skill that places 1 random debuff from a pool per
   hit → REJECT all the individual debuffs. Note the mechanic in `source_note`.
3. **Books-only tags (0% unbooked)** — seed with `status='proposed'`, and flag
   `source_note` with "Books-only — not functional pre-books." Do NOT mark
   approved even if the effect appears in an approved batch.
4. **Crit-conditional debuffs** — APPROVE. Tag at guaranteed (100% unbooked)
   chance; note "places on critical hit" in `source_note`. (Crit Rate is a
   player-controlled gear stat.)
5. **Stat-comparison conditionals** — APPROVE. Note the condition in
   `source_note` (e.g. "places on enemies whose ATK > DEF").
6. **Kill-conditional debuffs** — APPROVE if the champion controls the kill
   (e.g. Block Revive on kill, Freeze on kill). Same logic as crit-conditional.
7. **Passive `ascension_required` default** — `ar=3` unless a yellow-star
   screenshot confirms `ar=0`.
8. **Aura `ascension_required` default** — `ar=3` unless a yellow-star screenshot
   confirms `ar=0`.
9. **Counterattack tag** — buff-only: qualifies ONLY when the champion places a
   `[Counterattack]` buff. Innate counterattack mechanics do NOT qualify.
10. **Immunity clauses** — "immune to [X]" → REJECT. The champion does not place
    the debuff.
11. **Duration extension** — "increases the duration of [X]" → REJECT. Not a
    placement.
12. **Debuff activation** — "activates [X] debuffs" → REJECT. Not a placement.
13. **Transfer/redirect mechanics** — "transfer [X] to" / "redirect [X]" → REJECT.
14. **Exclusion clause** — an effect that appears only inside an "except [X]" /
    "transfers all debuffs except [X]" phrase → REJECT.
15. **Synergy-dependent skills** — a skill that only becomes available/activates
    when a specific ally is on the team → REJECT (e.g. Tallia's Bomb requires
    Fenax).
16. **Ignore-mechanic false positives** — a bracket tag appearing after "ignore",
    "ignores", or "will ignore" in skill text is NOT a placement; it describes
    what the attack BYPASSES → REJECT. Example: "ignores [Shield] and [Strengthen]
    buffs" → neither Shield nor Strengthen is placed by this skill. (Root cause of
    a 2026-07-12 sweep that found 31 such false positives across 19 champions —
    bracket-token extraction with no negation awareness.)
17. **Resistance bypass ≠ conditional placement** — language like "cannot be
    resisted if this Champion is under [Veil]" or "this debuff cannot be resisted
    if the target is under [Decrease DEF]" modifies RESISTANCE only. The debuff is
    still placed at its normal chance → APPROVE (do NOT reject as a conditional
    debuff). This is distinct from policy #1 (a debuff that only LANDS when another
    debuff is present). (Root cause of 7 false negatives in the same sweep — e.g.
    Ezio's Decrease DEF / Poison were wrongly rejected as "conditional".)
18. **Tag analysis reconciliation** — any tag ruling made via screenshot, seed
    SQL, or manual analysis MUST be written back to `DB_Champion_Tags` in the
    master worksheet in the SAME session. Tag analysis that lives only in seed
    files or conversation history is considered ORPHANED and will be lost — this
    is the exact failure that let a careful hand-analysis (seeds 42/43) be silently
    overwritten by an automated bracket-extraction pass. Same principle as the
    "screenshot all skills before ascending" action rule, applied to tags.
19. **Buff-strip / removal ≠ placement** — a `[Bracket]` buff token after
    "removes", "remove all … buffs", or "strips" describes a buff being taken OFF
    an ENEMY, not one the champion places → REJECT it as a placement (a policy-#16
    sibling: the bracket sits after a removal verb, not a placement verb). Tag the
    removal ACTION itself instead: **Buff Strip** (delete enemy buffs) or **Steal
    Buffs** (take them for the caster's side). Example: "removes all [Increase DEF],
    [Ally Protection], and [Strengthen] buffs from all enemies" places NONE of the
    three — it earns one Buff Strip tag. BOUNDARY: this fires ONLY on buffs removed
    from ENEMIES. "removes all debuffs from allies" is **Cleanse** (a real tag);
    "steals all buffs" is **Steal Buffs**. (Root cause: the 2026-07-12 pilot found
    Vitrius mis-tagged with Increase DEF / Ally Protection / Strengthen — buffs he
    STRIPS from enemies — because a bracket scraper can't tell strip from place.)

### Tag source of truth — regenerate from skill_summary, NOT bracket-scraping
The `champion_tags` layer is derived from `champion_skills.skill_summary` (verbatim
Plarium skill text) by applying the Tag Review Policies above, extracted via LLM
(claude-sonnet-5, tool-use, human-reviewed) and landed as `status='proposed'` →
advisor-approved. The full corpus was regenerated this way 2026-07-13.
- **`[bracket]`-token scraping of skill text is DEPRECATED — do not re-run it to
  (re)generate tags.** It cannot read prose mechanics (Revive / Ally Attack / heal
  / Turn Meter, written as verbs not brackets) and it systematically mis-reads
  negation / condition / removal / trigger-list contexts. It is the direct cause of
  policies #16–#19 and of the ignore / veil / buff-strip / debuff-list-in-passive
  error classes. Regenerate from `skill_summary` + the policies instead.
- **Scope: Rare+ only.** Live must carry NO Common/Uncommon `champion_tags`
  (`seeds/05` was superseded by `seeds/116`).
- **Write path:** worksheet `DB_Champion_Tags` → committed `seeds/*.sql` → live via
  `tools/apply-seed-pooler.mjs`. Live champion NAMES can differ from worksheet names
  (e.g. live "Vitrius" vs worksheet "Vitrius the Anointed") — resolve via
  `champion_aliases` when reconciling, never by exact name alone.
- Current counts / provenance / the reusable runner live in session memory
  (`tag-regen-pilot-2026-07-12`, `tag-sweep-ignore-veil-2026-07-12`), not here.

## Reasoning discipline (guardrails against snap decisions & assumptions)
The code has guardrails (e.g. `lib/battle-gaps.js` spec-margin classifier); these
are the equivalent for how conclusions get drawn. They exist because a wrong
assumption ("Don$Gnut is a developed account" — it is young/slightly-developed)
was stated as fact, propagated through memory, and skewed a reconciliation.
1. **Label every claim's status** — observed (you queried/measured it), inherited
   (from memory, context, or the user — NOT yet verified), or inferred. Never
   launder an inherited or inferred claim into a stated fact.
2. **Verify load-bearing facts before building on them.** If a conclusion depends
   on a fact (account maturity, a champion's kit, a stat margin), confirm it
   first. Recalled memory can be wrong or stale — it reflects what was believed
   when written.
3. **No "that's the answer" on a single data point.** When reality ≠ prediction,
   enumerate MANY candidate causes and ask questions before ranking one. One lens
   is rarely the whole story.
4. **A single battle can change a tag-of-fact (a champion's kit) at most — never a
   model rule.** Relaxing/adding a goal, threshold, or solution needs an ON-SPEC
   win with a COMPUTED margin, and ideally corroboration beyond one account.

## Core architecture principles
- **Recommend for AUTO-BATTLE, judged by TIME not turns.** ~99% of the
  audience runs content on auto, so every recommendation, confidence score,
  and calibration target answers "will this team clear on AUTO, within an
  acceptable TIME budget?" — not turn count, and not what a manual player
  could squeeze out. A win that finishes inside the time budget (e.g. ~5 min)
  is a good result regardless of turns. Consequences: (a) captured auto
  battles are the primary calibration signal, and an auto loss means "doesn't
  work for the audience"; (b) manual battles (`manualSkillUsed=true`) are less
  representative — a manual win may not reproduce on auto, where the AI fires
  skills off-cooldown in slot order; (c) clear quality is measured in
  wall-clock seconds (`DurationInSeconds` + `BattleSpeed`), not turns; (d) a
  capability that needs manual timing is worth less than one that works
  passively under the AI.
- **Auto-battle skill reliability is a ranking factor.** Tag matching tells
  you what a champion *can* do — it does not tell you whether the game AI
  will reliably fire that skill in a given content run. Each skill carries an
  `auto_reliable` attribute (boolean, default true). Known problem cases are
  annotated: e.g. "AI never prioritizes this unless enemy HP > 75%", "wasted
  AoE on single-target phases", "A3 on cooldown never triggers in time."
  Champions whose key skill is not auto-reliable rank lower for that role.
  This is a multiplier on the ranking score, not a binary filter — a
  champion with the right tag but unreliable AI still surfaces, but deprioritised.
- **Speed roles in content requirements, not exact SPD values.** The app
  collects gear tier, not individual SPD values, so precise speed tuning is
  out of scope. Content requirements encode a speed role expectation
  (fast / medium / slow) where turn order matters. Ranking uses each
  champion's base SPD + gear-tier SPD estimate to satisfy the role. This is
  enough to prefer a naturally fast debuffer over a slow one for a role that
  requires moving first — without asking players for exact stat values.
- **Speed tuning guidance lives in the AI explanation layer, not the
  matching logic.** The explanation layer surfaces the concept to players who
  don't know it: "For this comp to work on auto, your Decrease DEF champion
  should be faster than your damage dealers. At Good gear tier, target 170+
  SPD for that role." This is the primary value-add for most users, who are
  not speed tuning yet. The matching engine does not attempt to validate a
  full speed tune.
- **Clan Boss precise speed tuning is explicitly out of scope for v1.**
  Unkillable and speed-tune CB comps require knowing every champion's exact
  SPD and the relationships between them. The app cannot support this without
  per-champion stat collection. For CB, recommend team composition and flag
  that speed tuning matters, then defer to community resources for the exact
  tune. Do not attempt to validate or generate a CB speed tune from gear-tier
  estimates alone.
- The AI is not the source of truth. The champion table and the
  dungeon-requirements table are. The AI's job is (1) turning matching
  engine output into plain-language explanations and (2) running
  post-failure diagnosis conversations.
- The matching engine is deterministic code. It does not call an LLM.
- Vision-based roster parsing is dropped. Champion selection is manual.
  Do not revisit without running a proper crop-and-upscale validation
  test first.
- Dungeon requirements are goal-based, not single-tag. OR-of-ANDs.
- Dungeon requirements are phase-aware where relevant (Dragon's Lair,
  Fire Knight, Ice Golem have wave + boss phases; Spider's Den and Clan
  Boss do not).
- When no owned champion satisfies a goal, say so explicitly — never
  silently substitute a guess.
- Solo carry check runs BEFORE team recommendation. If a player owns a
  known solo carry for the requested content, surface it first.
- Clan Boss is NOT solo-able content. Never add Clan Boss rows to
  champion_solo_profiles.
- Ice Golem stage 10-13 vs 14+ requires different explanation tone — see
  explanation_style_notes topic "Ice Golem stage 10-13 vs stage 14+
  difficulty framing". Do not apply uniform warning language across all
  stages of a single dungeon without checking for stage-specific style
  notes first. (NOTE: explanation_style_notes is not yet read by any code —
  the explain.js layer must pull and apply these before this has any effect.)
- The app assumes no champion has Lifesteal, Regeneration, or Immortal
  gear. Every team recommendation must include sustain from champion
  skills. Surface this assumption on the champion detail screen and in
  the recommendation output when no sustain champion is present. Enforced
  by the global sustain check in match-engine.js (checkTeamSustain); see
  the champion_team_requirements table for per-champion dependencies.

## Damage mechanics — interaction rules (authoritative: lib/damage-mechanics.js)
These are GAME FACTS about Raid's damage formula, encoded in `lib/damage-mechanics.js`.
Every team-scoring, contribution, or explanation decision that touches damage MUST
consult them — do not re-derive from intuition (that produced a wrong Uugo/Decrease-DEF
explanation on 2026-07-14). Because they are facts, they ARE allowed to be a model rule
(reasoning-discipline #4 does not block them); only the nominal multiplier *magnitudes*
in that file stay uncalibrated until many captures exist.

1. **DEF shred only boosts ATTACK damage.** Poison, HP Burn, and Warmaster/Giant
   Slayer all scale off the target's MAX HP and are **DEF-INDEPENDENT** — Decrease DEF
   and [DEF-ignore] do **NOTHING** to them. Only direct-attack (ATK-vs-DEF) skills are
   boosted by DEF shred. Never credit Decrease DEF against a Poison/HP-Burn team's DoT.
2. **A debuff's value is CONDITIONAL on the team's damage type.** Decrease DEF is a
   top multiplier for an attack/nuke team and ~worthless for a DoT team. A DoT team
   scales with more DoT stacks + more survival turns, NOT DEF shred.
   (`debuffValueForTeam(tag, teamSources)`.)
3. **Sustain is MULTIPLICATIVE, not additive.** Keeping the team alive N extra turns
   multiplies every per-turn source (DoT + attack turns) by those turns. A support's
   damage contribution ≈ (added survival turns) × (team per-turn output). This is the
   survival side of the two-sided confidence calc. Evidence: DonBrogni CB 2026-07-14 —
   swapping the sustain support (Bad-el-Kazar, 10.66M/135t) for a nuker (Ninja,
   9.19M/115t) LOST damage, because −20 turns cut ~2.17M of Xenomorph Poison.
4. **Per-hero captured damage UNDERSTATES support value.** A support's debuff
   multipliers, sustain, and CC appear in OTHER champions' damage bars, never its own
   (Uugo ~2%). Never rank or judge a support by its raw damage bar; attribute the
   granted multiplier/survival back to it. The engine can pick a support for the right
   tag but the wrong reason (Uugo picked for Decrease DEF on a Poison team, where her
   real value is her heal) — the contribution model must value what actually helps.

The granular contribution model (per-champion contribution = own damage + debuff
multipliers granted + sustain granted) is the intended consumer; `cb-damage-model.js`
already imports `damageSourceIgnoresDef` and enforces the §1 invariant at load.

## Champion selection UI spec (ready to build)
- Screen 1: Four large rarity buttons (Mythical=red #E53935,
  Legendary=gold #FFB700, Epic=purple #9C27B0, Rare=blue #2196F3).
  Shows selected count per rarity. Account level field at top.
- Screen 2: Portrait grid per rarity, sorted by creator-link frequency.
  Search bar. Tap to select, checkmark overlay on selected.
- Screen 3: Detail sheet on tap. Required: level (1-60), stars (1-6),
  gear tier (Starter/Dungeon/Strong/God Tier). Optional behind toggle:
  ascension (defaults to stars-1), mastery (defaults to None), booked
  (defaults to No for Epic/Legendary/Mythical — never pre-checked; **defaults
  to YES for RARE**, whose books are cheap/abundant, so the engine credits
  Rares at max skills — see INS-0003 in `knowledge/insights-ledger.md`).
- Screen 4 (returning player): Roster grid with edit capability. "Add
  champion" button. "Get recommendation" at bottom. Content selection
  happens after, not before.
- Ad gate: first daily recommendation always free. Subsequent
  recommendations, failure diagnosis, solo carry details = rewarded ad.

## Stat estimation notes
- ACC and RES use additive gear bonuses (base is 0 for most champions)
- C.Rate and C.DMG vary per champion — use champions table values
- All gear tier modifiers are PLACEHOLDER ESTIMATES — store in config
  file, not hardcoded. Calibrate against 10-15 real accounts before ship.
- formulas.js must implement DEF diminishing returns, True Speed
  calculation, tick formula, and stun priority matrix before estimation
  engine is meaningful for Clan Boss
- **DUNGEON STAT FLOORS = CALIBRATION NEEDED (all placeholders).** Every ACC /
  RES / HP / SPD threshold in `stat_threshold_checks` is a JUDGMENT CALL, not a
  measured value (the source docs' stat tables are images). They are directional
  starting floors to recalibrate against real battle-outcome data. Known
  placeholder examples: Fire Knight ACC stage×10 (10-14 = 120) → 170 (15-20) →
  210 (21-25); Spider ACC stage×10 + a separate ~10% margin; Ice Golem 1-9
  (ACC 80 / HP 5,000), 10-13 (ACC 120 / HP 8,000), 14-20 (ACC 200 / RES 200 /
  HP 40,000), 21-25 (ACC 210 / RES 210 / HP 45,000); Dragon 1-6 (ACC ~100, no
  Scorch), 7-9 (ACC ~130 / RES ~200), 10-14 (RES ~250), 15-20 (RES ~300 — the
  doc's one concrete number), 21-25 (ACC ~250 / RES ~300). Do NOT treat any of
  these as authoritative; recalibrate per content once outcome data accumulates.
- **Dragon (and generally): ACC and RES are TWO DIFFERENT JOBS — never conflate.**
  ACC = YOUR team LANDING debuffs ON the boss (Decrease DEF / Weaken / Poison) —
  offense; a nuker/debuffer needs it. RES = RESISTING the boss's OWN debuffs
  (Hellrazor's Decrease ATK / Poison / Weaken / Scorch Stun) — defense; supports
  want it. Do not tell a player to raise ACC to avoid a boss's debuffs (that's
  RES) or RES to land their own (that's ACC). Captured live in the
  explanation_style_notes topic "Dragon's Lair — ACC vs RES are two different jobs".

## Known open questions — do not assume answers
1. Mythical champion access for beginners — unconfirmed whether starter
   codes ever grant Mythical. Do not assume until confirmed.
2. Instant DTM bypass — per-skill "cannot be resisted" clause is the
   real rule. Verify via literal skill text, not category assumption.
3. Spider's Den ACC formula — stage x 10 (Plarium source). Treat as
   floor-with-margin, not exact target.
4. Spider's Den RES threshold — ~300 rule of thumb (AyumiLove).
   Directional only.
5. Gear tier stat multipliers — all placeholder. Must calibrate before
   shipping.
6. base_crit_rate / base_crit_dmg migration — confirm applied to live DB
   before running full stats scraper.

## Event dungeon architecture

Event dungeons rotate — they are NOT static content like Spider's Den.
The dungeon name, affinity rotation, stage count, and stat thresholds
all change with each event. Do not treat them as static rows.

### Schema
`dungeons` table has three event-specific columns:
- `is_event boolean` — true for all event dungeons
- `active_from date` — when the event starts (null = always available)
- `active_until date` — when the event expires (null = never expires)

### Matching engine query for event content
When a player selects "Event Dungeon," query:
```sql
select * from dungeons
where game_id = 'raid_shadow_legends'
  and is_event = true
  and (active_until is null or active_until >= current_date)
order by active_until desc nulls last;
```
Returns the specific live event first (has `active_until` date), then
the generic fallback template (`active_until is null`). When no specific
event is live, only the generic template returns.

### Two-tier approach
**Option A — Specific event seeded:** a specific event dungeon row exists
with known stage thresholds, seeded within the first day or two of the
event going live. The matching engine uses stage-specific thresholds.
This is the preferred path.

**Option B — Generic fallback:** no specific event has been seeded yet
(e.g. brand new event, thresholds not yet confirmed). The matching engine
falls back to the generic "Event Dungeon (Generic)" template, which
applies Spider's Den-style advice: bring your best debuffers and
poisoners. The app tells the player: "We don't have specific data for
this event yet — here's the best team from your roster using general
event dungeon strategy."

### Seeding a new event (30-minute task)
Requires in-game observation or patch notes:
1. Dungeon name and affinity rotation
2. Wave + boss phase structure (yes/no)
3. Stage range to seed (typically only the farmable stages)
4. ACC/SPD thresholds per stage

Set `active_until` to the event end date. When it passes, the event
stops appearing automatically — no cleanup needed.

### What NOT to do
- Do not hardcode event dungeon names in the matching engine
- Do not leave expired event rows appearing to players
- Do not seed an event without confirmed thresholds — use the generic
  fallback until thresholds are researched and verified

## Hard boundary: passive reading only, no process injection

The battle log / Gestal-sync data collection tooling (RslBattleReader and
related tools) operates on a strict boundary: PASSIVE READING of the player's
own game client memory and local files only. This includes: reading process
memory, reading local save/cache files, reading the battleResults / heroRounds
blobs already written to disk by the game.

NEVER pursue function hooking, code injection, or detouring functions inside
the running Raid process. This is a fundamentally different technique from
passive memory reading — it modifies how the game process behaves rather than
just observing its existing state — and it is the exact signature Plarium's
anti-cheat is built to detect. This applies even when a passive-reading path
seems harder or slower than an injection-based shortcut would be.

If a future task seems to require process injection to get richer data, STOP
and look for a passive alternative first (e.g. decoding an existing replay/
record blob that the game already writes for its own Replay feature, rather
than hooking the function that generates the data live). If no passive
alternative exists, surface the tradeoff explicitly to Mike and wait for an
explicit decision — do not proceed on the assumption that "we've done similar
things before" extends to this.

This boundary protects the account this data collection is built around.
Getting it banned defeats the entire purpose of the tooling.

## Hard rule: all content changes go through committed seed files

Never apply goals, goal_solutions, stat_threshold_checks, or any other content
row directly to the live DB outside a committed `seeds/*.sql` file — not even for
a quick fix or test. This happened once (the six-difficulty Clan Boss content
existed live in the DB with no corresponding seed file anywhere in git history)
and the result was 40 untagged, unapproved "skeleton" solutions that silently
made Clan Boss non-functional, with no way to trace how or when they were created
and no way to recover the process that made them.

If a piece of content needs to change: write or update a `seeds/*.sql` file,
commit it, then apply it. The DB should always be reconstructable from the
committed seed files — if it isn't, that's the bug to fix.

## Per-patch IL2CPP re-dump process (routine maintenance)

Both the battle reader (RslBattleReader) and the direct roster extractor (Option
B, once built) navigate game memory via byte offsets compiled into
GameAssembly.dll. When Plarium ships an update, some offsets shift. This is
expected, not a crisis — treat it as routine maintenance.

### What triggers a re-dump
- Game update ships (Plarium patches roughly every 2-3 weeks)
- Memory reads start returning null/garbage where they previously worked
- StageId, champion identity, or roster reads stop resolving correctly

### The re-dump process (~30-60 minutes when offsets actually shift)
1. Locate the new `GameAssembly.dll` on disk (already present since the game is
   installed locally)
2. Run Il2CppDumper against it to produce a fresh `dump.cs`
3. Grep `dump.cs` for the specific class/field names the reader uses (UserWrapper,
   HeroById, Hero, BattleSetup, StageId, etc.) — names don't change between
   patches, only numeric offsets do
4. Compare new offsets against the constants hardcoded in the reader
5. Update any constants that shifted, rebuild, validate against a known-good
   reference (the Gestal export for roster; a real battle capture for battle
   results)

### Important: many patches don't shift the relevant offsets at all
Don't assume a re-dump is needed just because a patch shipped. Confirm by checking
whether reads are still returning correct values first. The battle reader's
game-update fix earlier in this project (June 2026) was confirmed a non-event —
offsets hadn't shifted despite a version bump.

### This stays within the passive-read boundary
Re-dumping and updating offsets is still passive reading — reading your own game
client's compiled structure to find data locations. It does not cross into
injection or process modification territory.
