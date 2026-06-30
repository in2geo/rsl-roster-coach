# RSL Battle Reader — Architecture

Captures `BattleResult` objects from the live Raid process after every battle
and writes them to `gestal-sync/output/battle-log.json`.

All offsets are sourced from `dump.cs` produced by Il2CppDumper v6.7.46
against `GameAssembly.dll` (game version 11.60.0 / Unity IL2CPP 64-bit).

---

## Process attachment

```
Process name: "Raid Shadow Legends"   (or "RaidShadowLegends" — try both)
Module:       GameAssembly.dll        (base address found via EnumProcessModules)
```

`ReadProcessMemory` is used for all reads. The process is opened with
`PROCESS_VM_READ | PROCESS_QUERY_INFORMATION`.

---

## Pointer chain: process → BattleResult list

```
GameAssembly.dll base
  + 0x4E80990                          → AppModel_TypeInfo RVA (from script.json)
  read ptr                             → Client_Model_AppModel_c*

Client_Model_AppModel_c*
  + 0x58                               → Il2CppClass_1.parent
  read ptr                             → Client_App_SingleInstance_AppModel__c*

Client_App_SingleInstance_AppModel__c*
  + 0xB8                               → static_fields ptr
  read ptr                             → Client_App_SingleInstance_AppModel__StaticFields*

StaticFields*
  + 0x00                               → Log (ILog*) — skip
  + 0x08                               → _instance
  read ptr                             → AppModel object*

AppModel object*
  + 0x10..0x17                         → object header (klass*, monitor*)
  + 0x98                               → <BattleResultsCache>k__BackingField  (0x98 in dump.cs)
  read ptr                             → MessagePackBattleResultsCache object*

MessagePackBattleResultsCache object*
  + 0x10                               → _cachedResults (List<BattleResult>)
  read ptr                             → List<BattleResult> object*

List<BattleResult> object*  (standard C# List layout in Il2Cpp)
  + 0x10                               → _backingArray (BattleResult[])
  + 0x18                               → _size (int — current count)
  read ptr from 0x10                   → BattleResult[] object*

BattleResult[] object*  (Il2Cpp array layout)
  + 0x18                               → max_length (int)
  + 0x20 + (index × 8)                → BattleResult object* for each element
```

### Il2CppClass_1 parent offset derivation

`Il2CppClass_1` struct fields (64-bit):
| Offset | Field             | Size |
|--------|-------------------|------|
| 0x00   | image             | 8    |
| 0x08   | gc_desc           | 8    |
| 0x10   | name              | 8    |
| 0x18   | namespaze         | 8    |
| 0x20   | byval_arg         | 16   |
| 0x30   | this_arg          | 16   |
| 0x40   | element_class     | 8    |
| 0x48   | castClass         | 8    |
| 0x50   | declaringType     | 8    |
| **0x58** | **parent**      | 8    |
| 0x60   | generic_class     | 8    |
| 0x68   | typeMetadataHandle| 8    |
| 0x70   | interopData       | 8    |
| 0x78   | klass             | 8    |
| 0x80   | fields            | 8    |
| 0x88   | events            | 8    |
| 0x90   | properties        | 8    |
| 0x98   | methods           | 8    |
| 0xA0   | nestedTypes       | 8    |
| 0xA8   | implementedInterfaces | 8 |
| 0xB0   | interfaceOffsets  | 8    |

Total size: **0xB8** (184 bytes). `static_fields` pointer follows immediately at 0xB8.

---

## `BattleResult` class — field offsets

`TypeDefIndex: 12946`  |  `BattleResult_TypeInfo` RVA: `0x4DAFFC0`

```
Offset  Type               Field
------  -----------------  -------------------------
0x10    int (enum)         ResultType       (1=Victory, 2=Defeat, 3=Draw)
0x14    int (enum)         FinishCause      (see below)
0x18    BattleSetup*       Setup
0x20    BattleRecord*      Record
0x28    BattleState*       FinalState
0x30    BattleStatistics*  Statistics
0x38    bool               ManualSkillUsed
0x3C    float              DurationInSeconds
0x40    Nullable<float>    BattleSpeed      (value@0x40, hasValue@0x44)
0x48    Nullable<int>      BattleNumberInRow(value@0x48, hasValue@0x4C)
0x50    Nullable<int>      AllyTurns        (value@0x50, hasValue@0x54)
0x58    Nullable<bool>     AlwaysAutoBattleEnabled
0x60    ExceptionInfo*     ExceptionInfo
0x68    Nullable<bool>     SpeedDifferenceHandled
0x6A    Nullable<bool>     ValidationSkipped
0x6C    Nullable<bool>     AutoClimbEnabled
0x6E    bool               GuaranteedEffectChance
0x6F    bool               IgnoreRandomDamage
0x70    bool               IsFirstGoldenGoblinComplete
0x78    List<Artifact>*    SoldArtifacts
```

### `BattleResultType` enum
| Value | Name    |
|-------|---------|
| 1     | Victory |
| 2     | Defeat  |
| 3     | Draw    |

### `BattleFinishCause` enum
| Value | Name                    |
|-------|-------------------------|
| 0     | OneOfTheTeamDefeated    |
| 1     | Retreat                 |
| 2     | TurnsLimitReached       |
| 3     | PrematureResult         |
| 4     | TimeLimitReached        |
| 5     | UserConnectionTimeout   |

---

## `BattleSetup` class — key field offsets

`TypeDefIndex: 12910`

```
Offset  Type            Field
------  --------------  -------------------------
0x10    Guid (16 bytes) Id              (battle UUID)
0x20    int             RandomSeed
0x24    int (enum)      KindId          (battle type)
0x28    TeamSetup*      FirstTeam
0x30    TeamSetup*      SecondTeam
0x38    int             StageId         (game stage identifier)
0x3C    int             StageFormationIndex
```

---

## `BattleStatistics` class — field offsets

`TypeDefIndex: 12495`

```
Offset  Type                           Field
------  -----------------------------  -------------------------
0x10    Dictionary<int,HeroStatistics>* StatisticsByHero
0x18    AutoModeStatistics*             AutoModeStatistics
0x20    Dictionary<int,RoundStatistics>* StatisticsPerRound
```

---

## `HeroStatistics` class — field offsets

`TypeDefIndex: 13098`

```
Offset  Type                              Field
------  --------------------------------  -------------------------
0x10    long                              TeamOwnerId
0x18    int                               Id              (battleHeroId)
0x1C    int                               InventoryHeroId (links to Gestal heroId)
0x20    int                               Slot
0x24    int                               TypeId          (champion typeId)
0x28    int (enum)                        Grade           (star count)
0x2C    int                               Level
0x30    BattleStats*                      Stats
0x38    Dictionary<int,int>*              Skills
0x40    bool                              IsDead
0x48    Dictionary<int,HeroBattleStatistics>* _statsPerRound
0x50    HeroType*                         _heroType
0x58    bool                              IsSummoned
```

---

## `HeroBattleStatistics` class — field offsets

`TypeDefIndex: 13095`  (per-round statistics for one hero)

```
Offset  Type                                   Field
------  -------------------------------------  -------------------------
0x10    Dictionary<int,List<TurnStatistics>>*  _statisticsByTurn
0x18    Dictionary<int,List<SkillUsageInfo>>*  _skillInfoUsedByTurn
0x20    Dictionary<int,int>*                   _usedEffectsCount    (private)
0x28    Dictionary<int,int>*                   _damageCountByTarget (private)
0x30    List<HeroDeathStatistics>*             _deaths
0x38    int                                    KilledEnemiesCount
0x3C    int                                    KilledAlliesCount
0x40    int                                    KilledHydrasCount
0x48    Dictionary<int,MetamorphStatistics>*   MetamorphStatisticsByFormId
0x50    Fixed (long)                           HpOnStart
0x58    Fixed (long)                           HpOnFinish
0x60    int                                    TurnsCount
```

`Fixed` is a fixed-point decimal type — divide the raw long by 1000 to get HP as a float.

---

## AppModel TypeInfo RVAs (script.json)

| Symbol | RVA |
|--------|-----|
| `Client.Model.AppModel_TypeInfo` | `0x4E80990` |
| `SharedModel.Battle.Core.Result.BattleResult_TypeInfo` | `0x4DAFFC0` |
| `Client.Model.Gameplay.Battle.ResultCache.MessagePackBattleResultsCache_TypeInfo` | `0x4E6A3C8` |

---

## Alternative: read the battleResults file directly

`MessagePackBattleResultsCache` also persists results to disk after each battle:

```
Path: %LOCALAPPDATA%Low\Plarium\Raid_ Shadow Legends\battle-results\battleResults
Format: MessagePack (binary)
```

Watch this file with `FileSystemWatcher` as a lightweight alternative to memory reading.
The file is updated after each battle completes and the result is saved. 
Decode with the `MessagePack-CSharp` NuGet package using `MessagePackSerializer.Deserialize<List<BattleResult>>`.

Memory reading is preferred for real-time capture (before the file is flushed to disk).

---

## Output format: `gestal-sync/output/battle-log.json`

```json
[
  {
    "capturedAt": "2026-06-28T23:15:00Z",
    "resultType": "Victory",
    "finishCause": "OneOfTheTeamDefeated",
    "durationSeconds": 87.4,
    "allyTurns": 23,
    "manualSkillUsed": false,
    "setup": {
      "id": "a1b2c3d4-...",
      "kindId": 5,
      "stageId": 12345
    },
    "heroStats": [
      {
        "inventoryHeroId": 1,
        "typeId": 1513,
        "level": 40,
        "grade": 4,
        "isDead": false,
        "killedEnemiesCount": 2,
        "turnsCount": 8,
        "hpOnStart": 15420.5,
        "hpOnFinish": 11200.0
      }
    ]
  }
]
```

---

## Polling strategy

- Attach on startup; retry every 5 seconds if process not found
- Poll every 2 seconds while process is running
- Compare `List._size` with previous count — new results added at the end of the list
- Re-attach if process disappears (e.g., game restarted)
- Write the full log on each new result (not append-only) to keep output idempotent

---

## Implementation: `RslBattleReader/`

See `RslBattleReader/` subdirectory. Build and run:

```
cd RslBattleReader
dotnet run
```

Output path: `../output/battle-log.json` relative to the RslBattleReader directory.
