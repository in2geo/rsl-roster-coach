# Project rules

See `PROJECT_BRIEF.md` for full context (product vision, data model, worked
examples, monetization, build order). This file holds only the rules that
should apply in every session.

## What this is
A mobile-first web app that gives new/limited-roster Raid: Shadow Legends
players a personalized "what should I do next" recommendation, based on a
screenshot of their roster. Not a tool for veteran players with deep rosters
— that segment is already served by other tools.

## Stack
- Frontend: mobile web app (PWA), not a native app. Standard photo picker
  for screenshot upload — no Web Share Target API for v1 (Android-only,
  not worth the asymmetric UX yet).
- Hosting: Vercel.
- Backend/DB: Supabase (Postgres + auth + storage).
- AI: Anthropic API (separate account/billing from claude.ai — set up at
  console.anthropic.com) for vision parsing of screenshots and for writing
  plain-language explanations.
- Monetization: ads (rewarded video for "go deeper" actions), not
  subscriptions. Never gate the first daily recommendation behind an ad.

## Data sourcing — hard rules
- NEVER scrape or write a scraper targeting HellHades, Gestal, AyumiLove,
  InTeleria, or any other "all rights reserved" community site. Their ToS
  explicitly prohibit it.
- NEVER scrape YouTube (videos, transcripts, or comments). YouTube's ToS
  explicitly prohibits it.
- DO use as sources: the game's own in-game Index/Compendium (view skill
  text for any champion, owned or not), official Plarium patch notes, and
  the Fandom wiki (CC-BY-SA, more permissive than "all rights reserved"
  sites).
- Tag champions from the literal skill text ("does this ability's text
  include Decrease Defense?"), never from "best champions" guides — those
  are biased toward Legendary/Epic and will leave gaps in exactly the
  Common/Uncommon/Rare champions this audience actually owns.
- Every new tag or rule gets proposed in structured form, then reviewed and
  approved by a human before it's considered live. No auto-merge.

## Core architecture principles
- The AI is not the source of truth. The champion table and the
  dungeon-requirements table are. The AI's job is (1) reading screenshots
  into structured data and (2) explaining a decision that's already been
  made by deterministic matching logic — never inventing the recommendation
  itself from raw memory.
- Dungeon requirements are goal-based, not single-tag. E.g. "goal: survive
  the wave" has multiple valid tag-level solutions (Decrease Defense, AoE
  Stun/Freeze/Daze, AoE Decrease Turn Meter) — list all valid solutions
  under the goal, don't hardcode one tag as the only answer.
- Dungeon requirements are phase-aware where relevant (wave phase vs. boss
  phase have different needs in Dragon's Lair, Fire Knight, Ice Golem — not
  in Spider's Den or the Clan Boss, which have no separate wave phase).
- When no owned champion satisfies a goal, say so explicitly with the gap
  named — never silently substitute a guess.
