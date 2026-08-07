# Champion name / alias integrity audit — 2026-08-07

**Why:** recurring name→ID resolution failures. The resolver (`lib/champion-names.js`) is **exact
normalized-match** (lowercase, letters+numbers only; NO fuzzy/first-word fallback) — a name form resolves
**only** if it is `champions.name` or an explicit `champion_aliases` row. So every long+short form must be an
explicit alias. Tool: `tools/alias-audit-ayumilove.mjs` (accepts `ayumilove` | `hellhades`; enumerates each
source's champion roster from its WP sitemap, cached, and diffs against ours).

## Coverage result — GOOD (better than expected)

- **Full-name coverage: complete.** AyumiLove run: 0 full names missing. HellHades run (1,034 champs, the
  most complete source, covers the ~31% AyumiLove lacked): 6 "ADD_FULL" hits, all noise — `Aina 2 / Alika 2
  / Azure 2` (HellHades disambiguation-slug artifacts), `Celendiel the Opal Guardian → Guardian` and
  `Aria the Golden Hope → Hope` (shared-word MISmatches to different champs), `Vasal of the Seals` (spelling
  variant of our "Vasal of the Seal"). No genuine missing full-name aliases.
- **Short forms: complete.** 21 distinctive-word short aliases added + applied 2026-08-07
  (`seeds/2026-08-07_shortform_aliases_audit.sql`). Short form = a word UNIQUE to one champion, so shared
  titles ("Lady") and skin words ("Kael") are auto-excluded (collision-safe). The naive first-word approach
  was rejected — it produced garbage + collisions ("Lady"→Lady Noelle, shared by ~10 champs).
- **NO safe short form (correct, no action): 11** — skins/compounds that must be called by full name:
  Dark Kael, Dark Athel, Dark Elhain, Supreme Kael/Athel/Elhain/Galek, Ultimate Galek, Crimson Slayer,
  Royal Guard, The Calamitus.

## The REAL gap HellHades surfaced: MISSING CHAMPIONS (not aliases)

Champions HellHades has that our DB lacks entirely — newer releases since the 2026-07-13 DB refresh.
Rarity/faction verified on HellHades. These need a full champion capture (row + stats + skills + aura +
tags), NOT an alias — bigger than this audit.

| Champion | Rarity | Faction |
|---|---|---|
| Heinrik Demondoom | Mythical | Sacred Order |
| Haggibah the Nestmaid | Legendary | Dark Elves |
| Celendiel the Opal Guardian | Legendary | High Elves |
| Aria the Golden Hope | Legendary | Banner Lords |
| Holguk of the Hallowsights | Legendary | Orcs |
| Xanthe Seaflower | Epic | Banner Lords |
| Khamir Scald Eye | (likely Rare+, unverified) | — |
| Xalgaze Fangwall | (likely Rare+, unverified) | — |

⚠ "Aria the Golden Hope" and "Celendiel the Opal Guardian" are NOT our "Hope" (Epic) / "Guardian" (Rare) —
those are different champions that shared a word. Do not alias the missing champions onto them.

Out of scope (confirmed Common/Uncommon; the other UNMATCHED HellHades entries): generic 2-word names
(Battle Sister, Pit Fighter, Line Infantry, Sister Militant, …) + ~70 single-word (Aristocrat, Bandit,
Brute, Militia, Yeoman, …).

## Minor open item
- `Vasal of the Seals` (HellHades) vs our `Vasal of the Seal` — spelling variant; safe to add as an alias to
  Vasal (Legendary). Which spelling is official is unconfirmed.

## Re-run
`node --env-file=.env.local tools/alias-audit-ayumilove.mjs hellhades` (or `ayumilove`). Proposals land in
`%TEMP%/ayumilove-cache/_alias_proposals_<source>.json`.
