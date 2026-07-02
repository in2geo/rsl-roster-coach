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

### Clan Boss battle-log outcomes — hero capture + dungeon ID FIXED; only DIFFICULTY still blocks the flag
Clan Boss hero capture is now **5/5** and the run is correctly identified as **Clan
Boss** (no longer mislabeled Dragon's Lair). Three distinct bugs, all found via a real
Clan Boss **Nightmare** capture (2026-07-02), preserved as the regression fixture
`gestal-sync/RslBattleReader/test-fixtures/file_080047.bin`:
1. **typeId high-byte garbage** (fixed earlier): the two bytes before the "h" key
   carry the correct typeId LOW byte but a garbage high byte, so the old full-u16
   match failed. `BattleWatcher.cs` roster filter now matches `heroId + typeId low
   byte` (`(c.TypeId & 0xFF) == (h.TypeId & 0xFF)`).
2. **heroId uint16 skip** (fixed 2026-07-02, `HeroIdentity.cs`): the heroId decoder
   only handled fixint + uint8 (`0xCC`), so any champion with inventory heroId ≥ 256
   (MessagePack uint16 `0xCD`) was silently dropped *at extraction*. The 5-champion
   team came through as 3/5 — Ezio (heroId 321) and Glorious Pallas (heroId 962) skipped.
   Added `0xCD`/`0xCE` handling; re-parsing the fixture now yields 11 candidates →
   filter keeps the 5 allies. Reader rebuilt (0 errors).
3. **CB mislabeled as a dungeon** (fixed 2026-07-02, `stage-signatures.json` +
   `BattleFileParser.cs`): CB carries no in-band encounter id, so `DungeonId` picked
   up a COINCIDENTAL in-band id (222601 == Dragon's Lair 11, which really does appear
   in CB files) and — because it takes precedence over the fingerprint — labeled the
   run "Dragon's Lair Stage 11." Fix: a Clan Boss fingerprint that anchors on the
   demon's own record (map16, fixed uid `u=0x0964D59D`) — verified team/difficulty-
   independent (common to 5 CB dumps across sessions, matches all 21 CB dumps, 0 of
   151 non-CB incl. the real Dragon-11 run 155750). `BattleFileParser` now treats a
   Clan Boss fingerprint as authoritative over `DungeonId`. Validated: the 3 CB dumps
   → "Clan Boss", the real Dragon-11 → still "Dragon's Lair 11", non-CB unaffected.

PARTIALLY RELEASED (2026-07-02): `upload-battles.js` now holds only **difficulty-
unknown** Clan Boss rows (`HOLD_CLAN_BOSS_UNKNOWN_DIFFICULTY`, was the blanket
`HOLD_CLAN_BOSS_OUTCOMES`). CB outcomes are per-difficulty; a CB battle only resolves
to a `dungeon_stage_id` (and reaches Phase 2) when its difficulty is already known,
because for CB the difficulty IS the stage number (Easy=1…Ultra NM=6, via the
`stageId → tier` map in `lib/clan-boss.js`). So confirmed-difficulty CB rows now flow
through to `recommendation_outcomes`; difficulty-unknown ones stay held until sourced.
Remaining gap = broadening difficulty coverage: only **Easy** (4019001) and **Brutal**
(4019013) stageIds are mapped. More come from the memory `stageId` once the metadata-
usage fragility below is fixed, or from per-difficulty file signatures (so far only
Nightmare is labeled — fixture `file_080047.bin` + same-session `file_082802.bin`,
whose stageId isn't captured yet). Set the flag to false to release even difficulty-
unknown CB rows (not recommended — they'd land on the wrong per-difficulty stage).

### Memory reads depend on the class already being initialized (metadata-usage fragility) — FIXED 2026-07-02
`--roster` (Hero heap scan), `--gear` (Artifact), and the AppModel/stageId chain used
to read the class pointer straight from its TypeInfo RVA. In a **fresh game session**
that slot still holds the unresolved IL2CPP metadata-usage token (observed: a constant
`0x6000E2F3` for Hero, `0xA000FB8F` for Artifact, that did **not** move when ASLR
relocated the module base — proof it's a token, not a live pointer). `IsValidPointer`
range-checked it as "valid", so navigation silently died one step later and looked
like an offset shift when it wasn't.

Fixed by `Il2Cpp/Il2CppClassResolver.cs`: read the RVA slot; if it isn't a live class
(readability + `element_class == self` + name/namespace match), fall back to scanning
memory for the Il2CppClass by its (name, namespace). The class struct exists as long
as any instance does — the AppModel singleton always does once the game runs — so this
recovers the pointer without waiting for the game to exercise the class. Validated live
(2026-07-02, fresh-session token state): Hero → 99 heroes, Artifact → 1141, AppModel →
resolved. Passive read only. Resolved pointers are cached (`ConcurrentDictionary`; the
watcher resolves AppModel from two threads) and re-validated so a game restart
transparently re-resolves.

Residual (inherent, not the token bug): `--roster` still only sees Hero objects that
are *materialized* on the heap — a partial count until the Champion Collection is
opened (this session: 99 of ~109). The resolver can't conjure data the game hasn't
loaded; that's correct behaviour, and the message now says to open the collection.

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
