# Project rules

See `PROJECT_BRIEF.md` for full context (product vision, data model, worked
examples, monetization, build order). This file holds only the rules that
should apply in every session.

## What this is
A mobile-first PWA that gives new/limited-roster Raid: Shadow Legends
players a personalized "what should I do next" recommendation, based on
their manually-entered roster. Not a tool for veteran players with deep
rosters — that segment is already served by other tools.

## Stack
- Frontend: mobile PWA, plain HTML/CSS/JS, no framework, no build step
- Hosting: Vercel (static files + /api/* serverless functions)
- Backend/DB: Supabase (Postgres + auth + storage)
- AI: Anthropic API (separate from claude.ai — console.anthropic.com)
- Monetization: rewarded video ads. First daily recommendation always free.

## Current project state (updated end of session June 30 2026)

### In the DB and verified
- Spider's Den stages 9-10 — goals, solutions, stat thresholds, RES row
- Clan Boss all six difficulties — goals, solutions, stat thresholds,
  boss exceptions, explanation style notes
- Fire Knight's Castle stages 10-20 (was 15-20) — goals, solutions, stat
  thresholds, boss exceptions. 15-20: wave phase (AoE CC goals/solutions to
  deny dangerous minion skills), boss phase (shield-breaking at 10 hits/round,
  Turn Meter control, Dazzling Flames SPD-debuff counter, Decrease DEF/Weaken
  damage window), tags added (Multi-Hit A1, Decrease SPD, Decrease Turn Meter,
  Heal Reduction, Counterattack, Block Cooldowns, Increase SPD, Ally Attack,
  Block Revive), ACC/SPD stat checks per stage, boss exceptions per stage,
  explanation style note for the shield mechanic. Stages 1-9 deliberately out
  of scope.
- Ice Golem's Peak stages 10-20 (was 15-20) — goals, solutions, stat
  thresholds, boss exceptions, with a confirmed difficulty cliff at stage 14
  (relaxed floors 10-13: ACC 120+/HP 25000+, burst-survivable; stage-15-
  equivalent floors at 14+: ACC 200+/HP 40000+/RES 200+). 15-20: wave phase
  (kill both minions before boss phase, target the more dangerous one first),
  boss phase (avoid triggering Frigid Vengeance via Poison/HP Burn instead of
  burst, minion management via Block Revive, Numbing Chill ACC counter), ACC/
  RES/HP stat checks per stage, boss exceptions per stage including Frigid
  Vengeance and Counterattack warnings, champion_ai_notes (Underpriest Brogni
  flagged — reflect damage can proc Frigid Vengeance), explanation style notes
  for Frigid Vengeance/Counterattack. Stages 1-9 deliberately out of scope.
- Block Revive tag corrected: bypasses_accuracy_check is now false (was
  incorrectly true) — requires a normal ACC check to land; affects matching
  logic for Ice Golem at ALL stages, not just 10-14.
- Both Fire Knight and Ice Golem seeded with status = 'proposed' per
  no-auto-merge rule — nothing auto-approved.
- NOT yet done for Fire Knight/Ice Golem: champion_strategy_modifiers (no
  dungeon-specific overrides seeded yet — Ally Attack champions like Fahrakin/
  Cardiel only exist for Clan Boss so far)
- Champion solo profiles — Dragon, Spider, Ice Golem, Fire Knight across
  Normal and Hard stages
- Champion AI notes — Elder Skarg, Fayne, Mavara, Folan, Sabrael, Fimo,
  Nson, Jorad, Polar Fireheart, Underpriest Brogni (Ice Golem)
- Champions table — priority starter-pack champions plus recent meta
  champions with base stats from raid.guide
- Schema migrations applied — role, mastery_tier, ascension_level,
  has_lore_of_steel, threshold_type, speed_set_bonuses,
  boss_stun_priority all documented
- base_crit_rate / base_crit_dmg DDL migration — flagged, confirm applied
- game_id architecture applied — games table, game_id on all key tables
- recommendation_outcomes table — feedback loop schema, not yet wired to UI
- profiles layer — BUILT (this session): profiles spine over the existing
  multi-account model. A profile is a named roster populated by either manual
  entry (user_champions scoped by profile_id) or Gestal import (rsl_accounts
  scoped by profile_id); anonymous device users keep a single implicit roster.
  Switcher UI + magic-link sign-in control wired; signed-in users no longer get
  the dev box's local Gestal fallback. See migrations/2026-06-30_profiles_layer.sql
  and the [[profiles-architecture]] memory. roster_shares still not built.
- Clan Boss content — remediated (this session): the six-difficulty solutions
  were skeleton rows (proposed + untagged). Now tagged + approved via
  seeds/09_clan_boss.sql (Hard+) and seeds/10_clan_boss_easy_normal.sql
  (Easy/Normal, deduped goals). Sustain goals at Hard+ remain gaps until
  champions get Leech/Ally Protection/Continuous Heal tags (coverage, not a bug).
- Direct game-memory roster extractor (Option B) — SCOPED, not built. Plan +
  traced IL2CPP offsets in gestal-sync/option-b-roster-extractor-plan.md.
- champion_names table — localization layer, English seeded
- daily_sessions + ad gate spec — schema done, UI wiring pending
- Event dungeon architecture (is_event/active_from/active_until) — schema
  done, generic fallback template seeded

### Next for Claude Code (in order)
1. Run the dungeon coverage verification query (see "Content coverage check"
   below) to get an accurate current picture before continuing
2. Build formulas.js — DEF diminishing returns, True Speed, tick formula,
   stun priority matrix
3. Build stat estimation engine against formulas.js
4. Build matching engine with solo carry check first, then team
   recommendation — include the Spider's Den highest-confidence-stage scan
   logic (stage 10→1, return highest at ≥80% confidence)
5. Run raid.guide base stats scraper for remaining champions
6. Build champion selection UI (spec already written — see session notes)
7. Build roster verification screen (spec already written)
8. Build AI explanation layer (two-part output, confidence percentage not
   binary verdict)
9. Wire ad gate logic (daily_sessions, gate checks, placeholder ad flow)
10. Wire feedback UI (recommendation_outcomes, 👍/👎)
11. Wire waitlist form to Supabase
12. Build post-failure diagnosis flow (three yes/no questions)
13. champion_strategy_modifiers for Fire Knight/Ice Golem (not started)

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
- NEVER scrape or write a scraper targeting HellHades, Gestal, AyumiLove,
  InTeleria, or any other "all rights reserved" community site.
- NEVER scrape YouTube (videos, transcripts, or comments).
- DO use: in-game Index/Compendium (skill text), official Plarium patch
  notes, Fandom wiki (CC-BY-SA).
- DO use raid.guide (https://raid.guide/en/stats/) for champion base stats
  only — confirmed accurate, not on no-scrape list. Not for skill text,
  tags, or strategy guidance.
- Tag champions from literal skill text only — never from guides or tier
  lists. Guides are biased toward meta picks and miss the specific
  starter-pack champions this audience actually owns.
- Every new tag or rule gets proposed in structured form, then reviewed
  and approved by a human before it's considered live. No auto-merge.
- Zero-tag champions must surface explicitly — never silently exclude.

## Core architecture principles
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

## Champion selection UI spec (ready to build)
- Screen 1: Four large rarity buttons (Mythical=red #E53935,
  Legendary=gold #FFB700, Epic=purple #9C27B0, Rare=blue #2196F3).
  Shows selected count per rarity. Account level field at top.
- Screen 2: Portrait grid per rarity, sorted by creator-link frequency.
  Search bar. Tap to select, checkmark overlay on selected.
- Screen 3: Detail sheet on tap. Required: level (1-60), stars (1-6),
  gear tier (Starter/Dungeon/Strong/God Tier). Optional behind toggle:
  ascension (defaults to stars-1), mastery (defaults to None), booked
  (always defaults to No — never pre-checked).
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
