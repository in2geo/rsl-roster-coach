# RSL Coach — Known Gaps

Operational gaps and known-wrong/low-confidence areas. Findable and scannable when
debugging a wrong verdict. Delete entries as gaps close — don't leave stale notes.

Last updated: 2026-07-07 (video-skill-screenshots branch).

## Data gaps

### HP/RES floor calibration (medium priority — single data point)
Ice Golem stages 10-13 HP floor was recalibrated 25,000 → **8,000** (seed 19,
commit `8f939fc`), because the DonCobb07 4W/1L Ice Golem 10 clear has team-min HP
9,118 (Kael) — 25,000 was a proven false negative. **8,000 is derived from ONE
run**, so it's preliminary: it's a conservative floor that doesn't exclude the
known clear, not a calibrated value. Refine (and calibrate RES floors similarly)
as more battle-log data points accumulate. RES floors are still original judgment
calls with no battle-log evidence yet.

### Clan Boss chest-tier thresholds (source = screenshots, July 2026)
`clan_boss_chest_tiers` (seed 26) damage→chest thresholds for all six difficulties were
captured from in-game **rewards-screen screenshots in July 2026**, not an official data
source. Plarium periodically rebalances Clan Boss rewards — **re-verify these thresholds
if CB rewards change** (a rebalance would silently mis-tier every scored run). The chest
NAMES are also baked into the `recommendation_outcomes.outcome` CHECK constraint, so a
rename would need a migration too. `captured_at` on each row records when they were taken.

### ascension_required — no automated source; manual from the in-game Index
Per-skill ascension-unlock requirements (`champion_tags.ascension_required`) have **no
compliant automated source** (established 2026-07-02):
- raid.guide doesn't list ascension unlocks (see `scrape-champion-tags.js`).
- The in-game padlock ("Unlocks at Ascension Level N") is only visible on an **owned,
  not-yet-ascended** champion — it disappears once ascended, and unowned champions can't
  be checked at all.
- The game HAS the value, but only in transient UI-context objects (`UnlockOnAscendLevel`
  in `AscendSkillInfoContext`/`HeroSkillInfoContext` — computed, needs ownership + object-
  graph RE) and as effect-condition **formulas** (`ownersAscendLevel>=N`) in the static-
  data (needs DSL decode, partial cache). Plarium's API would have it, but network
  interception is off-limits (no-injection boundary).

So it's captured **manually from the in-game Index** and recorded in
`seeds/31_ascension_overrides.sql` — the durable, growable source of truth (mirrored in
`scrape-champion-tags.js` `ASCENSION_OVERRIDES` for raid.guide-scraped champions). Gated
skills are a minority (mostly passives), so the list grows slowly. A `--skills` memory
reader was prototyped and **shelved** — even working it needs ownership and hit an object-
graph wall (the `ISettableContext<Params>` struct is consumed on set, not heap-scannable).
The nested-class resolver from that effort (`Il2CppClassResolver.ResolveNested`) was kept.

### champion_solo_profiles affinity / stage-label errors in seeds/06 (audit — verify per champion from in-game)
Reference — RAID affinity colour map (icon next to the champion name):
**Magic = blue, Force = red, Spirit = green, Void = purple.** Affinity wheel
(repo-anchored, seed 35 line 65): **Magic > Spirit > Force > Magic; Void neutral**
(Magic strong vs Spirit, Spirit strong vs Force, Force strong vs Magic).

Artak was seeded as Spirit in `seeds/06_solo_carry_proposals.sql` but his in-game icon is
**blue = Magic**. Fixed (seed 41 creates his champions row as Magic; his 7 solo entries in
seed 06 were corrected). Verified from video since then:

- **Ezio Auditore** — icon is **green = Spirit**, so seed 07's `affinity='Spirit'` is
  CORRECT (no change needed; an earlier draft wrongly read the green icon as Force). FIXED
  2026-07-07: (a) faction `Shadowkin` → `Sacred Order` (seed 07 at source + idempotent
  UPDATE in seed 42 for live rows) per the in-game detail screen; (b) seed 06 solo lookups
  `where name = 'Ezio'` → `'Ezio Auditore'` (previously bound to NULL). Ezio proposed tags
  added in seed 42. Only the shared Stage-25 label question below still applies to Ezio.

Still UNVERIFIED (need their own videos before touching — don't trust seed 06's labels):
- **Teodor the Savant** (Legendary / "Spirit") — Dragon Stage 25 (~line 415). Also says
  *"Spirit is WEAK at Dragon Stage 20 (Force)"* which is backwards (Spirit is **strong** vs
  Force).
- **Richtoff the Bold** (Legendary / "Spirit") — Dragon Stage 25 (~line 575).

Stage-label error (independent of champion affinity, affects all the above + the
`dungeon_stages` notes at seed 06 lines 34-37): **Dragon Stage 25 is labelled "Force" but
the rotation puts it at Void** (seed 32/35: Magic→Spirit→Force→Void from stage 10; 25 ≡ 1
mod 4 → Void, where everyone is neutral). Repo Dragon affinities are only seeded for stages
10-20; **21-25 are extrapolated and NOT confirmed** — verify Stage 25 (and Dragon Hard
Stage 10, FLAG-24) in-game before rewriting the Force/Void label. The Artak Stage 25 entry
already uses "Void (extrapolated, verify)", which currently disagrees with seed 06 line 37
("Force") — reconcile once verified.

### Xenomorph pending-review tag decisions (seed 45)
Xenomorph (Legendary / Magic / Dark Elves, Alien: Earth collab) was seeded in
`seeds/45` with the SOLID tags (Poison, Perfect Veil, Stun, True Fear). Three
effects were deliberately left untagged pending a human decision:

- **Infest** (A2 Infestation) — no tag exists in the vocabulary. Its only
  mechanical hook is Xenomorph's OWN self-revive ("revives this Champion when an
  enemy under [Infest] dies"), so reuse is single-champion and niche. Decision
  needed: create an `Infest` vocab tag, or leave it as flavour/untagged?
- **Self-revive** (A2 passive) — the existing `Revive` tag means reviving a dead
  ALLY. Xenomorph's revive is SELF-only. Tagging `Revive` would wrongly surface
  him as a team reviver in matching. Decision needed: leave untagged (current), or
  add a distinct self-revive/survivability concept?
- **−20% DEF** (Caustic Blood passive) — a PASSIVE, CONDITIONAL DEF reduction that
  applies only to enemies already under a Poison HE placed. Not a placed
  `[Decrease DEF]` debuff. Decision needed: tag it `Decrease Defense` (it is a real
  DEF shred relevant to matching) with a conditional note, or keep `Decrease
  Defense` meaning "placed debuff only" and leave it untagged?

Also noted (not a decision, just a caveat baked into the seed-45 source_note): his
Stun/Infest/True Fear are unresistable ONLY while he is under [Perfect Veil], but
the `True Fear` tag is unconditionally `bypasses_accuracy_check=true`. He self-veils
on A1/A3 so it is usually up; flagged in case the engine over-credits the bypass.

### Michelangelo pending-review tag decisions (seed 46)
Michelangelo (Legendary / Spirit / Banner Lords, TMNT collab) had his affinity
corrected (Force -> Spirit) and faction (Shadowkin -> Banner Lords) in seeds/07 +
seeds/46, and his solo-profile reasoning fixed in seeds/06. Solid tags were seeded
(Decrease Defense, Stun, AoE Damage, Decrease Attack, Provoke, Increase Attack,
Shield). Four effects were left untagged pending a vocabulary decision — no tag
exists for any of them:

- **Leech** (A3 Shell Cyclone) — a real, reasonably common RAID debuff (heals the
  attacker for a % of damage dealt to the leeched enemy). Strongest candidate for a
  new vocab tag; would also apply to other Leech champions.
- **Debuff Spread** (A2 Express Delivery) — takes all debuffs from the target and
  copies them to all enemies. Signature turtle mechanic; niche but distinctive.
- **Ally Attack** (Party Dude passive) — when he attacks, ally Leonardo/Donatello/
  Michelangelo/Raphael join the attack. TMNT-set synergy; overlaps with the
  Clan Boss "Ally Attack" concept (Fahrakin/Cardiel) which is currently handled
  outside the tag vocabulary — decide whether Ally Attack should become a tag.
- **Evade** (Party Dude passive) — 15% chance to evade an enemy skill (30% under
  Taunt). Survival mechanic; no tag.

(The seeded self-buffs — Increase ATK, Shield, self-Taunt/Provoke — are tagged but
noted as SELF-only in their source_notes; relevant for solo/survival, not team
support. Reviewer may downgrade if the tag is meant for ally-facing effects only.)

### Sustain gear assumption
The app assumes no player champion runs Lifesteal, Regeneration, or Immortal gear.
All sustain must come from champion skills. This is enforced in the global sustain
check in `match-engine.js` (`checkTeamSustain`), which surfaces a `sustain` result on
every `matchRoster`/`evaluateTeam` output.

Impact: teams with no sustain champion always surface a sustain gap warning regardless
of dungeon. This is intentional.

Limitation: the assumption is binary — a player who does have Lifesteal on one champion
gets the same warning as a player with none. Resolving this requires asking the player
which gear set each champion is using, which adds friction we've chosen not to add at
MVP.

Related gaps:
- **Champion detail UI note NOT built (Part 3 deferred):** the sustain-assumption
  disclosure line ("We assume this champion is using damage or speed gear — not Lifesteal
  or Regeneration. Make sure your team includes a healer.") is specified but the champion
  detail screen itself doesn't exist yet (`app.html` has no gear-tier selector / detail
  sheet). Add the note when that screen is built (see the champion-selection UI spec in
  CLAUDE.md, Screen 3).
- **`champion_team_requirements` rows are `proposed`:** Criodan (healer) and Fahrakin the
  Fat (Clan Boss sustain_any) are seeded but not yet approved, so `checkTeamRequirements`
  doesn't act on them until a human flips them to `approved` (no-auto-merge rule). The
  Heinrich Demondoom row no-ops until that champion is added to `champions`.
- **Pre-existing, unrelated — FIXED:** `CRITICAL_DEBUFFER_TAGS` in `match-engine.js`
  previously used `'Decrease DEF'`/`'Decrease ATK'`, which don't match the seeded tag
  names (`'Decrease Defense'`/`'Decrease Attack'`), so the Clan Boss stun-matrix's
  `is_critical_debuffer` check never matched and `stun_warning`/`reorder_suggestion` never
  fired. Corrected to `['Decrease Defense', 'Decrease Attack', 'Weaken']` (all three
  verified against the `tags` table). Verified via a `buildStunMatrix` harness: a team with
  a Decrease Attack/Defense champion as the predicted stun target now fires both warnings.

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

OUTCOME MODEL BUILT — gated on damage capture (2026-07-02): CB is scored by chest tier
(total damage), not kill/no-kill. `clan_boss_chest_tiers` (seed 26) holds per-difficulty
damage→chest thresholds; `chestTierFor()` in `lib/clan-boss.js` resolves a damage figure
to a chest name (e.g. 11.07M Nightmare → `guardian`). `upload-battles.js` now writes a CB
`recommendation_outcomes` row with `outcome = <chest tier>` when `total_damage_dealt` is
present, and HOLDS the run when it's absent (the old blanket `HOLD_CLAN_BOSS_OUTCOMES`
flag is superseded by this damage gate). `recommendation_outcomes.outcome` CHECK was
widened to allow the 12 chest names; `battle_history` gained `total_damage_dealt`.
Validated: the real 11.07M Nightmare run was backfilled to `outcome='guardian'`.

REMAINING GAP — the reader does NOT capture `total_damage_dealt` yet (it's the deferred
per-hero-stats problem: post-battle stats are computed on-screen, not snapshottable from
the empty StatisticsByHero dict — see the reader memory notes). So every real CB capture
is held today; only manually-backfilled rows (with an injected damage figure) resolve to
a chest tier. Building total-damage capture in the reader is the unblocker.

Difficulty sourcing is now SOLVED (the reason it was ever a blocker): the memory-read
fragility below is fixed, so `stageId` is captured live. `lib/clan-boss.js` maps
**Easy** (4019001), **Brutal** (4019013), and **Nightmare** (4019017, confirmed
2026-07-02 — live capture + "Demon Lord. Nightmare" result screen). Normal/Hard/Ultra-NM
stageIds are still unmapped (add each once a real capture confirms it).

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
