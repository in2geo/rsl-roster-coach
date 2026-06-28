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

## Current project state (updated end of session June 27 2026)

### In the DB and verified
- Spider's Den stages 9-10 — goals, solutions, stat thresholds, RES row
- Clan Boss all six difficulties — goals, solutions, stat thresholds,
  boss exceptions, explanation style notes
- Champion solo profiles — Dragon, Spider, Ice Golem, Fire Knight across
  Normal and Hard stages
- Champion AI notes — Elder Skarg, Fayne, Mavara, Folan, Sabrael, Fimo,
  Nson, Jorad, Polar Fireheart
- Champions table — priority starter-pack champions plus recent meta
  champions with base stats from raid.guide
- Schema migrations applied — role, mastery_tier, ascension_level,
  has_lore_of_steel, threshold_type, speed_set_bonuses,
  boss_stun_priority all documented
- base_crit_rate / base_crit_dmg DDL migration — flagged, confirm applied

### Next for Claude Code (in order)
1. Build formulas.js — DEF diminishing returns, True Speed, tick formula,
   stun priority matrix
2. Build stat estimation engine against formulas.js
3. Build matching engine with solo carry check first, then team
   recommendation
4. Run raid.guide base stats scraper for remaining champions
5. Build champion selection UI (spec already written — see session notes)
6. Build AI explanation layer (two-part output)
7. Wire waitlist form to Supabase
8. Build post-failure diagnosis flow (three yes/no questions)

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
6. base_crit_rate / base_crit_dmg migration — RESOLVED. Both columns
   confirmed present in live DB (June 27 2026). Safe to run full stats
   scraper.
## Champion-specific matching engine notes (future content)

These are build notes for when the relevant content is added — do not
implement until that content is actively being built.

### Pelops — Spider 20 (post-MVP)
Pelops' Magma Shield scales at 30% Max HP, making him an HP-scaler,
not a DEF-scaler. When building Spider 20 solo carry support:
- Check HP against the 70k floor FIRST — this is the primary gate
- DEF is secondary for Pelops specifically; do not apply the standard
  DEF-first evaluation used for other solo carry profiles
- This is a champion_strategy_modifiers entry, not a champion_ai_notes
  entry — it affects stat threshold ordering, not AI battle settings
