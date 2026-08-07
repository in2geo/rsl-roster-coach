# HANDOFF 2026-08-07 — Data-integrity: skill-name corruption audit, alias integrity, 8 missing champions

Session theme: **data integrity of the champion corpus** (names, aliases, skills, and 8 missing
champions), plus a CB DoT-throughput calibration at the start. Everything below is **applied to the live
DB, committed, and merged to `main`** (fast-forwarded 146 commits; `main` == `origin/main` == `fd74d38`).

## COLD START — read these first
1. This handoff.
2. Memory: `champion-name-alias-audit-2026-08-07`, `bad-bulk-skillname-corruption-audit-2026-08-06`,
   `cb-survival-model-and-boss-calibration-2026-08-06` (DoT section updated this session).
3. Worklist: `knowledge/bad-bulk-skillname-corruption-worklist-2026-08-06.md`,
   `knowledge/champion-name-alias-audit-2026-08-07.md`.

## DURABLE LEARNINGS (these change how future data work is sourced)
- **raid.guide is the CORRUPT source for skill NAMES.** The `worksheet Skills tab 2026-07-11` bulk (78% of
  champion_skills rows) was fed from raid.guide and INVENTS plausible-but-wrong skill names for a fraction of
  champions (Keberon, Morag, Staltus confirmed; ~50 "ALL_WRONG" found). **Never diff skill names against
  raid.guide** (bad-vs-bad). Use **AyumiLove** (independent, Tier-2) as the reference; **in-game Index** is
  Tier-1 truth. raid.guide base STATS are still fine per CLAUDE.md — it's only names/editorial that are bad.
- **The name resolver is EXACT normalized-match** (`lib/champion-names.js`: lowercase + letters/numbers only,
  NO fuzzy/first-word fallback). A name form resolves ONLY if it's `champions.name` or an explicit
  `champion_aliases` row. Every long+short form must be an explicit alias.
- **Short form = a DISTINCTIVE word** (appears in exactly ONE champion name), NOT the first word. First-word
  is wrong for titles ("Lady"→Lady Noelle collides across ~10) and skins ("Kael"→Dark Kael). Distinctive-word
  auto-avoids both.
- **HellHades sourcing profile:** skills/aura/identity(role/faction/rarity) = YES via the browser tool's
  `get_page_text` (clean; the raw HTML is 1.3MB JS and defeats regex). **Base stats = NO** (no stats tab —
  in-game screenshots only). **Affinity = not cleanly exposed** (only the descriptor sentence on some pages;
  get it from in-game: icon red=Force, green=Spirit, blue=Magic, purple=Void). Champion roster enumerated
  from the WP sitemap (`champions-sitemap.xml`+`2`); AyumiLove from `sitemap_index.xml`→post-sitemaps.
- **Base-stat validation:** 6★ base_hp is always a multiple of 15 — validated all 8 new champions this way.
- **Transforming champions** have two skill sets (the `form` column). HellHades' structured skill list shows
  only the BASE form; the Alternate form must be captured in-game.

## WHAT SHIPPED
- **CB DoT throughput** (`dd44faf`): Xenomorph had NO recipe → auto-parser missed his A1 crit→3-Poison branch.
  Authored `XENOMORPH-A1`/`XENOMORPH-PASSIVE` in `lib/sim/recipes.js` + an `ifCrit` gate on the recipe
  PLACE_DEBUFF handler. Poison output 1.42M→3.39M (=reality). ⚠ Remaining CB gap = DIRECT damage (Ninja
  carry + excluded WM/GS masteries); `SIM_CB_SURVIVE=real` stays OPT-IN until that closes.
- **Corruption audit + tool** (`tools/ayumilove-name-diff.mjs`): swept 615 bucket-A champions → 50 ALL_WRONG,
  split by a mechanics diff into 37 name-only / 7 borderline / 6 deep. Fixed 30 name-only + 7 flagged
  (missing-row INSERTs) → applied + worksheet writeback. Verified corruption≠rework via DB-summary-vs-AyumiLove
  mechanics overlap.
- **Alias integrity** (`tools/alias-audit-ayumilove.mjs`, accepts `ayumilove|hellhades`): full-name coverage
  complete (0 missing); added 21 distinctive-word short aliases + the Konstantin⇄Dayborn link (applied +
  worksheet writeback).
- **8 missing champions** (`seeds/2026-08-07_missing_champions_hellhades.sql` + `_tags` + `_tags_approve`,
  C-IDs C000936-C000943): Heinrik Demondoom (Mythical), Haggibah the Nestmaid, Celendiel the Opal Guardian,
  Aria the Golden Hope, Holguk of the Hallowsights, Xanthe Seaflower, Khamir Scald-eye, Xalgaze Fangwall.
  Full identity+stats+skills+aura+71 APPROVED tags, applied AND written back to the master worksheet
  (Champions/Skills/Auras/DB_Champion_Tags tabs).

## OPEN THREADS (next session)
1. **Heinrik Demondoom Alternate Form** — transforming Mythical; only base form captured. Needs in-game
   Alternate-form skill text (A2 Decrease DEF/ATK on controlled enemies; A3 Ally Protection/Reflect/Increase
   RES + self Stoneskin; passive heal-on-AP-attack + Stun-on-attacker). Add as `form='alternate'` skill rows.
2. **Corruption backlog** (from the worklist, all need Tier-1/AyumiLove re-capture): 7 BORDERLINE (Konstantin,
   Amoch, Dune Lord Greggor, Maddak, Merouka, Ginro, Roric) + 6 DEEP (Zii, Phranox, Praeva, Mithrala, Kaja,
   Spikehead). Praeva has a literal placeholder name ("Debuff Absorption & Turn Meter Boost"). Also the
   **MED bucket (~319 mixed-source champions)** was NEVER swept — run `alias-audit`/name-diff over it.
3. **CB direct-damage axis** — calibrate Ninja carry + turn WM/GS masteries back on vs the boss, then make
   `SIM_CB_SURVIVE=real` the default.
4. **Verify Xalgaze/Khamir names** — in-game shows "Khamir Scald-eye" (hyphen, lowercase eye) and "Xalgaze
   Fangwall"; confirmed. Elven Ranger has NO skill rows at all (separate data gap noticed during the alias
   audit).

## GOTCHAS
- `node -e` with top-level `await` + `require()` throws ERR_AMBIGUOUS_MODULE_SYNTAX — use `import` in a `.mjs`
  file, or avoid `require`.
- `champion_tags.target_type` CHECK constraint allows only: `aoe, single, unknown, conditional_single,
  conditional_aoe, random` (NOT self/ally/null — map self→single, ally→aoe, null→unknown).
- Worksheet edits use openpyxl in-place with a pre-edit backup in `_archive/xlsx-backups/`; it preserves
  cells/sheets but may drop embedded charts on round-trip (backup covers it). The xlsx is OneDrive-synced,
  OUTSIDE git — only seeds are committed.
- New-champion seeds: `gen_random_uuid()` for `champions.id` isn't needed (insert by columns, reference by
  name for FK); skill_id = next C-ID (max was C000935 → assigned C000936+).
