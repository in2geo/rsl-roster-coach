# Option B — Direct game-memory roster extractor (go/no-go plan)

**Goal:** read the player's full champion roster + gear **directly from the running
Raid client's memory**, to replace the Gestal dependency entirely. Today the roster
comes only from Gestal (`gestal-sync/output/<name>_<accountId>.json`, produced by
`sync.js` after a manual Refresh), uploaded via `tools/import-upload.js` → `/api/import`
→ `rsl_accounts`. Option B removes Gestal from that path; the app would read the game.

**Status:** scoped against the IL2CPP dump. The data layout is fully mapped; one
navigation hop and a fresh dump remain. Bounded project, with a real per-patch tax.

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

## 2. Memory layout — mapped from dump.cs (GameAssembly v11.60.0)

> Offsets are v11.60.0 and MUST be re-confirmed on a current dump (see §5).

```
AppModel (resolved, reusable) — app-shell only; does NOT hold user data.

ROOT → live user data  ◀ the one unsolved hop (see §3)
   UserGuard<UserWrapper>.Current (generic static)  OR a guard holding UserWrapper@0x10
        ▼
UserWrapper (TypeDefIndex 18084)
   ├─ Heroes    (HeroesWrapper)    0x28
   └─ Artifacts (EquipmentWrapper) 0x30
        ▼  (wrappers read underlying data via the guard; UserHeroData offsets known)
UserHeroData (TypeDefIndex 10585)
   ├─ LastHeroId            0x10
   ├─ HeroById  Dict<int,Hero>  0x18   ← owned roster, keyed by hero id
   ├─ HeroesCountByRarity   0x20
   └─ InventorySlots 0x28 / Storage 0x2C / Bathhouse 0x30 / BattlePresets 0x38
        ▼
Hero (TypeDefIndex 10462)
   Id 0x18 · TypeId 0x1C · Grade(stars) 0x20 · Level 0x24 · Experience 0x28
   EmpowerLevel 0x30 · Locked 0x34 · InStorage 0x35 · Skills(List) 0x60
   MasteryData 0x68 · DoubleAscendData(ascension) 0x70 · Power 0x78

Artifact (gear)
   _level 0x18 · _kindId(slot) 0x20 · _rankId(rank) 0x24 · _setKindId(set) 0x28
   _primaryBonus(main stat) 0x38 · _secondaryBonuses(substats List) 0x40
   + HeroEquippedItemsContext links gear ↔ hero
```

Everything a champion/gear extractor needs is present — and every field has a
ground-truth counterpart in the existing Gestal export to validate against.

## 3. The one unsolved hop — resolving the live `UserWrapper`

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
