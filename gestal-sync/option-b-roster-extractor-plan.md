# Option B — Direct game-memory roster extractor (go/no-go plan)

**Goal:** read the player's full champion roster + gear **directly from the running
Raid client's memory**, to replace the Gestal dependency entirely. Today the roster
comes only from Gestal (`gestal-sync/output/<name>_<accountId>.json`, produced by
`sync.js` after a manual Refresh), uploaded via `tools/import-upload.js` → `/api/import`
→ `rsl_accounts`. Option B removes Gestal from that path; the app would read the game.

**Status (updated — partially BUILT + validated):**
- ✅ **Step zero / re-dump:** fresh dump of the current installed build is BYTE-IDENTICAL
  to the v11.60.0 dump (same dump.cs/script.json SHA-256). Zero offset shifts; the build
  has NOT moved. (Confirms the "many patches don't shift offsets" rule.)
- ✅ **Champion reader (`--roster`): DONE, validated CLEAN** — 109/109 vs the Don$Gnut
  Gestal export, every field (typeId/stars/level/empower/inStorage).
- ✅ **Gear scalar reader (`--gear`): scalar fields CLEAN** — slotId/gearSetId/rarityId/
  rank/level/ascension match across all shared artifacts; reconciles to the in-game
  counts (816 unequipped gear + 181 unequipped accessories + 64 equipped = 1061 owned).
- ⏳ **Remaining:** owned-artifact filter (drop ~28 non-owned/transient objects the broad
  scan catches → exactly 1061); nested main stat / substats / equippedOnHeroId; then swap
  `import-upload.js` off Gestal once the gear diff is fully clean.

Code: `RslBattleReader/RosterReader.cs` (`--roster`), `ArtifactReader.cs` (`--gear`),
`tools/diff-roster.mjs`, `tools/diff-gear.mjs`.

**Boundary (passes):** passive `ReadProcessMemory` of the player's own client — same
technique as RslBattleReader. NO injection/hooking. Stays within the CLAUDE.md
"passive reading only" line.

---

## 1. What's reusable from RslBattleReader (≈70% of the plumbing)

- `Memory/ProcessMemory.cs` — OpenProcess/RPM, `FindModuleBase("GameAssembly.dll")`,
  ReadPointer/Int32/Int64, IsValidPointer.
- `Il2Cpp/Il2CppNavigator.cs` — **AppModel resolution** (TypeInfo RVA → Il2CppClass
  parent 0x58 → static_fields 0xB8 → `_instance` 0x08) and **generic container
  traversal**: `List<T>` (array 0x10, size 0x18), `T[]` (data 0x20, 8-byte ref elems),
  `Dictionary<int,T>` iteration (`IterateDictIntObj`: entries 0x18, count 0x20, 24-byte
  entries). These work unchanged on the champion dict and artifact arrays.
- `MemoryScanner.cs` — signature scanning (used below for the root hop).
- The Il2CppDumper v6.7.46 → `dump.cs` + `script.json` workflow + the Il2CppClass
  layout constants.

## 2. Memory layout — VALIDATED against the live game + Gestal export

> Build is unchanged from v11.60.0 (identical dump). TypeInfo RVAs stored as the
> exact **decimal** "Address" from script.json (a hex transcription bug burned us
> once — keep them decimal).

```
TypeInfo RVAs (script.json "Address", decimal):
   AppModel      82315664   (control; 0x4E80990)
   Hero          82209328   ✅ resolves         (0x4E66A30)
   Artifact      82424840   ✅ resolves         (0x4E9B408)
   UserHeroData  82441240   ❌ resolves to garbage (0x2001FFB7) — that entry is bad;
                            do NOT use it. Scan Hero objects directly instead.

ROOT HOP (what actually worked): resolve the Hero / Artifact Il2CppClass via its RVA
(GameAssembly base + RVA → klass), then SIGNATURE-SCAN the heap for objects whose
klass pointer (offset 0) == that class. Class pointers live at ~0x22B… (not 0x7FF8…).
No need for UserWrapper / the generic UserGuard static, and the UserHeroData dict path
is unreachable (bad RVA). Champions: ~167 Hero objects for a loaded roster.

Hero (TypeDefIndex 10462) — ✅ VALIDATED CLEAN vs Gestal:
   Id 0x18 · TypeId 0x1C · Grade(stars) 0x20 · Level 0x24 · EmpowerLevel 0x30
   Locked 0x34 · InStorage 0x35 · **InBathhouse 0x36 ← the player-facing STORAGE VAULT
   flag (Gestal's inStorage); 0x35 was NOT it. Treat 0x35 || 0x36 as stored.**

Artifact (TypeDefIndex 11328) — scalar fields ✅ VALIDATED CLEAN vs Gestal.
   NOTE: real layout differs from the earlier (wrong-struct) draft:
   _id 0x10 · _level 0x30 · _ascendLevel(Nullable<int>) 0x34 · _kindId(slot) 0x40
   _rankId 0x44 · _rarityId 0x48 · _primaryBonus(main) 0x50
   _secondaryBonuses(subs List) 0x58 · _setKindId(set) 0x68
   Mappings to Gestal: ArtifactKindId enum → slotId (Weapon 5→0, Shield 6→2, Ring 7→6,
   Helmet 1→1, Chest 2→4, Gloves 3→3, Boots 4→5, Cloak 8→7, Banner 9→8);
   ascensionLevel null→0; setKindId 0→null (accessories have no set).
   Still TODO: ArtifactBonus decode (main+subs), equippedOnHeroId, owned-only filter.
```

Every field validates against the Gestal export. Equipped vs unequipped reconciles to
the in-game inventory (816 gear + 181 accessories = 997 unequipped + 64 equipped = 1061).

## 3. The root hop — SOLVED via Hero/Artifact-class signature scan

✅ **Resolved** — not via `UserWrapper` at all. We resolve the Hero (and Artifact)
Il2CppClass by RVA and signature-scan the heap for object headers (klass == that
class). This is simpler than the generic-static route below and proved out live
(champions CLEAN). The remaining `UserWrapper`/`UserHeroData` notes are kept for
reference / the owned-artifact filter, but are not on the critical path.

(Historical scoping — the two approaches considered before building:)

AppModel does not hold user data; the architecture routes everything through
`UserGuard<UserWrapper>`. Two approaches:

- **(A) Generic-static resolution** — locate the `UserGuard<UserWrapper>` *instantiation*
  TypeInfo in `script.json`, resolve its static fields, read `.Current` → guard →
  `UserWrapper @ 0x10`. Precise but generic-instantiation statics are fiddly and the
  most offset-fragile part across updates.
- **(B) Runtime signature scan — RECOMMENDED.** Scan for the structure directly: a
  `Dictionary<int,Hero>` whose entries match the `Hero` fingerprint (plausible TypeId
  @+0x1C, Grade 1-6 @+0x20, Level 1-60 @+0x24), or `UserWrapper`'s run of ~28
  consecutive valid wrapper pointers. Validate the candidate against the Gestal export.
  Reuses `MemoryScanner`; far more resilient to the per-patch offset treadmill because
  it keys on stable structural shape, not a fragile generic-static RVA.

## 4. Build steps

1. **Re-dump** the current `GameAssembly.dll` (Il2CppDumper) → fresh `dump.cs`/`script.json`.
2. **Re-confirm** the §2 offsets (Hero, Artifact, UserHeroData, UserWrapper) against the
   new dump — ~30 min, diff against Gestal values.
3. **Root hop (Approach B):** scan to a live `UserHeroData`/`UserWrapper`, validate.
4. **Read champions:** iterate `HeroById` → read Hero fields → map to the import shape.
5. **Read gear:** iterate the artifact collection + the equipped linkage → import shape.
6. **Validation harness:** dump the in-memory result and **diff field-by-field against
   the current Gestal export** for the same account; iterate until it matches.
7. **Swap the import source:** `import-upload.js` reads the memory extractor instead of
   `readGestalRoster`. `/api/import` and the rest of the pipeline are unchanged (it
   already takes `{ account, roster:{champions,artifacts} }`).

## 5. Maintenance cost (the tax you're accepting)

- **Per game update:** RVAs and likely field offsets shift. Every patch needs a re-dump
  + re-confirm pass. The game already updated once this project (broke the battle reader's
  file marker). Approach B (signature scan) minimizes but does not eliminate this.
- **ToS exposure:** reading your own client's memory; same posture as the battle reader.
- This is exactly the treadmill that made Gestal (Option A) the original choice — the
  trade is "no manual Gestal Refresh + always-current data" vs "perpetual offset upkeep."

## 6. Go / no-go

- **Go if:** always-current roster without a manual Gestal Refresh is worth a recurring
  per-patch maintenance pass, and you accept owning an IL2CPP extractor long-term.
- **No-go / defer if:** the Gestal path is acceptable for validation-stage and you'd
  rather not take on the offset treadmill yet. (Option A still works; this plan keeps.)

The R&D risk is low — the data is fully reachable and Gestal-validatable; the only
genuine unknown is the root hop, with a concrete recommended approach. The ongoing
cost, not the build risk, is the real decision.
