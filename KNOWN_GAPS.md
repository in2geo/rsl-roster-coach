# RSL Coach — Known Gaps

Operational gaps and known-wrong/low-confidence areas. Findable and scannable when
debugging a wrong verdict. Delete entries as gaps close — don't leave stale notes.

Last updated: 2026-07-01 (battle-data-pipeline branch).

## Data gaps

### HP/RES floor calibration (medium priority — single data point)
Ice Golem stages 10-13 HP floor was recalibrated 25,000 → **8,000** (seed 19,
commit `8f939fc`), because the DonCobb07 4W/1L Ice Golem 10 clear has team-min HP
9,118 (Kael) — 25,000 was a proven false negative. **8,000 is derived from ONE
run**, so it's preliminary: it's a conservative floor that doesn't exclude the
known clear, not a calibrated value. Refine (and calibrate RES floors similarly)
as more battle-log data points accumulate. RES floors are still original judgment
calls with no battle-log evidence yet.

## Code gaps

### Clan Boss battle-log outcomes NOT captured
Clan Boss runs are **not turned into `recommendation_outcomes`** — the battle log
is blind to Clan Boss results. Root cause: a hero-capture bug in
`gestal-sync/RslBattleReader/BattleWatcher.cs` (the columnar-region typeId read
drops champions, so the team read is incomplete; also confounded by Quick Battles,
which don't serialize a full replay). The parked low-byte fix and full diagnosis
are in the `rslbattlereader-status` project memory. Until fixed, Clan Boss outcomes
are gated out by `HOLD_CLAN_BOSS_OUTCOMES=true` in `tools/upload-battles.js` (they
still land in `battle_history`, just not the calibration set). Validate the fix
against a MANUALLY-PLAYED Clan Boss battle (not a Quick Battle) before flipping the
flag.

### Event Dungeon / Minotaur cross-reference not wired
The reader tags event runs only as `"Event Dungeon"` (stageId prefix 2189) and
Minotaur as `"Minotaur's Labyrinth"` (2109). Neither resolves to a
`dungeon_stage_id` yet: Minotaur isn't seeded, and the event path needs the
`is_event` + `active_until >= current_date` query (specific live event first,
`"Event Dungeon (Generic)"` fallback) rather than exact-name `resolveDungeonStage`.
Note the reader's `"Event Dungeon"` label does not exact-match the DB row
`"Event Dungeon (Generic)"`. See commit `9a7be10`.

## Known accuracy ceilings (effective-stats)

### Mastery/glyph and per-artifact ascension not fully applied
`lib/effective-stats.js` applies set + mastery bonuses via Gestal's pre-resolved
`bonusesV2`, but per-artifact glyph/ascension stats are not summed
(`effective-stats.js` header TODO). Material impact is mainly SPD (Lore of Steel
glyphs); low impact on the ACC/HP/RES threshold checks.

### Champion ascension level — RESOLVED (derived from typeId, July 2026)
The game encodes ascension in the champion typeId: **`ascension = typeId − baseTypeId`**
(0-6). Gestal's `ascensionLevel` field is always 0 and is a red herring; both `typeId`
and `baseTypeId` are already in the Gestal export. Confirmed by a controlled live
ascend — Skeletor's in-memory `Hero.TypeId` went 9330 → 9331 when ascended to level 1 —
plus a roster-wide check (every `typeId − baseTypeId` in 0-6, matching known state:
Pelops 6, Narma/Gnut/Tagoar 3, Skeletor 0). `buildUserChampions.ascensionFromGestal(g)`
computes it; the mapRoster `ascension_required` gate now works from Gestal data alone.

No memory read (Option B) and no override file needed — the interim
`config/ascension_overrides.json` and the Option-B ascension-offset task are both
**retired**. (`DoubleAscendData.Grade` is the *awakening* level, not ascension.)

Verified: Pelops derives ascension 6, so his HP Burn + Petrification (ascension_required
3) now count. NOTE: `ascension_required` itself must still be set per-skill from the
in-game padlock/description (default 0) — see the tagging rule; that's separate from
sourcing the player's ascension level.
