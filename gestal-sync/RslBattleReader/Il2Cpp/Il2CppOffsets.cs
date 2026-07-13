namespace RslBattleReader.Il2Cpp;

/// <summary>
/// All offsets sourced from dump.cs (Il2CppDumper v6.7.46, GameAssembly.dll v11.60.0).
/// RVAs sourced from script.json.
/// </summary>
internal static class Il2CppOffsets
{
    // ── GameAssembly.dll RVAs (from script.json) ────────────────────────────

    /// <summary>RVA of Client.Model.AppModel_TypeInfo in GameAssembly.dll</summary>
    public const long AppModel_TypeInfo_RVA = 0x4E80990;

    // ── Il2CppClass struct layout (64-bit IL2CPP, Unity 2021+) ──────────────
    // Il2CppClass_1 fields (see battle-reader.md for full layout):

    /// <summary>Offset of parent pointer within Il2CppClass_1 (=Il2CppClass)</summary>
    public const int ILClass_Parent = 0x58;

    /// <summary>Offset of static_fields pointer — immediately after Il2CppClass_1 (size 0xB8)</summary>
    public const int ILClass_StaticFields = 0xB8;

    // ── SingleInstance<AppModel> static fields ───────────────────────────────
    // struct Client_App_SingleInstance_AppModel__StaticFields { ILog* Log; AppModel* _instance; }

    public const int SI_AppModel_Log      = 0x00;
    public const int SI_AppModel_Instance = 0x08;

    // ── AppModel instance fields ─────────────────────────────────────────────
    // Il2CppObject header = klass*(8) + monitor*(8) = 0x10 before user fields

    /// <summary>AppModel.&lt;BattleResultsCache&gt;k__BackingField (dump.cs: 0x98)</summary>
    public const int AppModel_BattleResultsCache = 0x98;

    // ── MessagePackBattleResultsCache instance fields ────────────────────────

    /// <summary>MessagePackBattleResultsCache._cachedResults (List&lt;BattleResult&gt;) at 0x10</summary>
    public const int BattleResultsCache_List = 0x10;

    // ── C# List<T> in Il2Cpp ────────────────────────────────────────────────
    // struct: klass*(8) + monitor*(8) = header 0x10; _backingArray at 0x10, _size at 0x18

    public const int List_BackingArray = 0x10;
    public const int List_Size         = 0x18;

    // ── Il2Cpp Array (T[]) ───────────────────────────────────────────────────
    // header(0x10) + Il2CppArrayBounds*(0x08) + max_length(0x08) + elements start at 0x20

    public const int Array_MaxLength  = 0x18;
    public const int Array_DataOffset = 0x20;
    public const int Array_ElementSize = 8; // pointer elements (reference type)

    // ── BattleResult fields (dump.cs TypeDefIndex: 12946) ───────────────────

    public const int BR_ResultType        = 0x10; // int (BattleResultType enum)
    public const int BR_FinishCause       = 0x14; // int (BattleFinishCause enum)
    public const int BR_Setup             = 0x18; // BattleSetup*
    public const int BR_Record            = 0x20; // BattleRecord*
    public const int BR_FinalState        = 0x28; // BattleState*
    public const int BR_Statistics        = 0x30; // BattleStatistics*
    public const int BR_ManualSkillUsed   = 0x38; // bool
    public const int BR_DurationSeconds   = 0x3C; // float
    public const int BR_BattleSpeed       = 0x40; // Nullable<float> — value@0x40, hasValue@0x44
    public const int BR_BattleNumberInRow = 0x48; // Nullable<int>   — value@0x48, hasValue@0x4C
    public const int BR_AllyTurns         = 0x50; // Nullable<int>   — value@0x50, hasValue@0x54
    public const int BR_AlwaysAutoEnabled = 0x58; // Nullable<bool>
    public const int BR_ExceptionInfo     = 0x60; // ExceptionInfo*
    public const int BR_AutoClimbEnabled  = 0x6C; // Nullable<bool>
    public const int BR_GuaranteedEffect  = 0x6E; // bool
    public const int BR_SoldArtifacts     = 0x78; // List<Artifact>*

    // ── BattleSetup fields (dump.cs TypeDefIndex: 12910) ────────────────────

    public const int BS_Id                    = 0x10; // Guid (16 bytes)
    public const int BS_RandomSeed            = 0x20; // int
    public const int BS_KindId                = 0x24; // int (BattleKindId enum)
    public const int BS_StageId               = 0x38; // int

    // ── BattleState (BattleResult.FinalState) → per-hero survival ────────────
    // FinalState (BR_FinalState) is a SharedModel.Battle.Core.State.BattleState. Its ally
    // BattleTeam holds a List<BattleHero>; each BattleHero's current HP (a Fixed long at 0x58,
    // 0 = dead) gives survival. This is the working survival source — BattleStatistics.
    // StatisticsByHero is empty post-battle. Verified live 2026-07-12 (Pallas died → curHP 0,
    // all survivors nonzero). Offsets from the live object graph (BattleState/BattleTeam/
    // BattleHero class names confirmed via Il2Cpp klass).
    public const int BState_AllyTeam = 0x28; // BattleTeam* (ally); 0x30 is the enemy team
    public const int BTeam_Heroes    = 0x18; // List<BattleHero>
    public const int BHero_TypeId    = 0x18; // int (baseTypeId)
    public const int BHero_Slot      = 0x1C; // int (0-based team slot, screen left-to-right)
    public const int BHero_CurrentHp = 0x58; // Fixed (long) current HP — 0 = dead

    // ── BattleStatistics fields (dump.cs TypeDefIndex: 12495) ───────────────

    public const int BStats_StatisticsByHero  = 0x10; // Dictionary<int, HeroStatistics>*

    // ── HeroStatistics fields (dump.cs TypeDefIndex: 13098) ─────────────────

    public const int HS_TeamOwnerId     = 0x10; // long
    public const int HS_Id              = 0x18; // int  (battleHeroId)
    public const int HS_InventoryHeroId = 0x1C; // int  (links to Gestal heroId)
    public const int HS_Slot            = 0x20; // int
    public const int HS_TypeId          = 0x24; // int  (champion typeId)
    public const int HS_Grade           = 0x28; // int  (star count)
    public const int HS_Level           = 0x2C; // int
    public const int HS_Stats           = 0x30; // BattleStats*
    public const int HS_IsDead          = 0x40; // bool
    public const int HS_StatsPerRound   = 0x48; // Dictionary<int, HeroBattleStatistics>*

    // ── HeroBattleStatistics fields (dump.cs TypeDefIndex: 13095) ───────────

    public const int HBS_Deaths             = 0x30; // List<HeroDeathStatistics>*
    public const int HBS_KilledEnemiesCount = 0x38; // int
    public const int HBS_KilledAlliesCount  = 0x3C; // int
    public const int HBS_KilledHydrasCount  = 0x40; // int
    public const int HBS_HpOnStart          = 0x50; // Fixed (long) — divide by 1000 for HP float
    public const int HBS_HpOnFinish         = 0x58; // Fixed (long)
    public const int HBS_TurnsCount         = 0x60; // int

    // ── Il2Cpp Dictionary<TKey, TValue> ─────────────────────────────────────
    // Standard .NET Dictionary layout in Il2Cpp:
    // 0x10 = int[] _buckets
    // 0x18 = Entry[] _entries
    // 0x20 = int _count
    // _entries array element size = 8(hash)+4(next)+sizeof(TKey)+sizeof(TValue)

    public const int Dict_Entries = 0x18; // Entry[]*
    public const int Dict_Count   = 0x20; // int
    // For Dictionary<int, HeroStatistics> each Entry = {hash:4, next:4, key:4, pad:4, value:8} = 24 bytes
    public const int DictIntObj_EntrySize = 24;
    public const int DictIntObj_KeyOffset  = 8;  // within Entry
    public const int DictIntObj_ValOffset  = 16; // within Entry (pointer)

    // ── Roster (owned heroes) — Option B roster extractor ───────────────────
    // TypeInfo RVAs from script.json. Verified IDENTICAL between the v11.60.0 dump
    // and a fresh dump of the current installed build (same dump.cs/script.json
    // SHA-256), so unchanged. The RVA points to a slot holding the Il2CppClass*;
    // an object of that class carries the same pointer at its offset 0 (klass).
    // Stored as the exact decimal "Address" from script.json (hex in comment) to
    // avoid transcription error.
    public const long UserHeroData_TypeInfo_RVA = 82441240; // 0x4E9F418
    public const long Hero_TypeInfo_RVA         = 82209328; // 0x4E66A30

    // UserHeroData fields (TypeDefIndex 10585)
    public const int UHD_HeroById = 0x18; // Dictionary<int, Hero>

    // Hero fields (TypeDefIndex 10462)
    public const int Hero_Id           = 0x18;
    public const int Hero_TypeId       = 0x1C;
    public const int Hero_Grade        = 0x20; // stars (HeroGrade enum, 1-6)
    public const int Hero_Level        = 0x24;
    public const int Hero_EmpowerLevel = 0x30;
    public const int Hero_Locked       = 0x34;
    public const int Hero_InStorage    = 0x35; // bool
    // dump labels 0x36 "InBathhouse", but empirically it's the flag set for the
    // player-facing storage vault (Gestal counts it as inStorage). Treat either
    // 0x35 or 0x36 as "stored".
    public const int Hero_InBathhouse  = 0x36; // bool — storage vault

    // Artifact class (TypeDefIndex 11328). RVA decimal from script.json.
    public const long Artifact_TypeInfo_RVA = 82424840; // 0x4E9B408
    public const int Art_Id              = 0x10;
    public const int Art_Level           = 0x30;
    public const int Art_AscendLevel     = 0x34; // Nullable<int>: value@0x34, hasValue@0x38
    public const int Art_KindId          = 0x40; // ArtifactKindId enum (slot)
    public const int Art_RankId          = 0x44; // ArtifactRankId enum
    public const int Art_RarityId        = 0x48; // ItemRarity enum
    public const int Art_PrimaryBonus    = 0x50; // ArtifactBonus* (main stat)
    public const int Art_SecondaryBonuses= 0x58; // List<ArtifactBonus>* (substats)
    public const int Art_SetKindId       = 0x68; // ArtifactSetKindId enum (set)
}
