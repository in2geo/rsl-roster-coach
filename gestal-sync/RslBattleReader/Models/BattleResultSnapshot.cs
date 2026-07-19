using System.Text.Json.Serialization;

namespace RslBattleReader.Models;

internal sealed class BattleResultSnapshot
{
    // Stamped by the watcher at capture time (resolved per battle so account
    // switches are reflected). Settable rather than init because the parser
    // creates the snapshot before the account is resolved.
    public string? AccountId   { get; set; }
    public string? DisplayName { get; set; }

    public string CapturedAt { get; init; } = "";

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public BattleResultType ResultType { get; init; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public BattleFinishCause FinishCause { get; init; }

    // DurationSeconds/BattleSpeed carry the battle's wall-clock time + speed multiplier —
    // the audience's real success metric. The file has no timing, so they are read from
    // the live BattleResult object in memory (BR+0x3C / +0x40) and stamped by the watcher
    // after the file parse. Settable for the same reason as StageId/TotalDamageDealt.
    // AllyTurns comes from the file parse (init).
    public float  DurationSeconds { get; set; }
    public int?   AllyTurns       { get; init; }
    public float? BattleSpeed     { get; set; }
    public bool   ManualSkillUsed { get; init; }

    // Stage identified via byte-signature fingerprint (no explicit id in file).
    // Dungeon/StageNumber/StageLabel are settable so the watcher can override them
    // with the authoritative values decoded from the in-memory StageId (dungeon from
    // the prefix, stage from stageId % 1000).
    public string? Dungeon     { get; set; }
    public int?    StageNumber { get; set; }
    public string? Difficulty  { get; init; }
    public string? StageLabel  { get; set; }

    // Explicit stage id read from the game's BattleSetup in process memory (the
    // authoritative source — the file carries no stage number for shared-id
    // dungeons). Settable: stamped by the watcher after the file parse. KindId is
    // the BattleKindId (content type) from the same setup.
    public int? StageId      { get; set; }
    public int? BattleKindId { get; set; }

    public BattleSetupSnapshot? Setup { get; init; }
    public List<HeroStatSnapshot> HeroStats { get; init; } = [];

    // Total damage dealt (Σ per-hero), read from the Clan Boss result dialog's view-model
    // in process memory (see CbDamageReader). Null for non-CB battles or when the result
    // dialog wasn't readable. Settable: stamped by the watcher after the file parse.
    public long? TotalDamageDealt { get; set; }

    // Per-hero identity recovered from the battleResults file (file-parse path).
    // Settable: the parser fills raw candidates; the watcher validates + names them
    // against the resolved account's roster.
    public List<BattleHero> Heroes { get; set; } = [];
}

internal sealed class BattleSetupSnapshot
{
    public string Id      { get; init; } = "";
    public int    KindId  { get; init; }
    public int    StageId { get; init; }
}

internal sealed class HeroStatSnapshot
{
    /// <summary>Links back to champions.heroId in Gestal output.</summary>
    public int  InventoryHeroId { get; init; }
    public int  BattleHeroId    { get; init; }
    public int  TypeId          { get; init; }
    public int  Grade           { get; init; }
    public int  Level           { get; init; }
    public int  Slot            { get; init; }
    public bool IsDead          { get; init; }

    // Aggregated across rounds (KEPT for backwards compatibility — every downstream consumer
    // reads these; Rounds below is additive).
    public int   KilledEnemiesCount { get; init; }
    public int   KilledAlliesCount  { get; init; }
    public int   TurnsCount         { get; init; }
    public float HpOnStart          { get; init; }
    public float HpOnFinish         { get; init; }

    /// <summary>
    /// PER-ROUND breakdown (added 2026-07-19). The game exposes a StatsPerRound dictionary per hero
    /// and the reader was already iterating it — it just SUMMED everything away, the same defect as
    /// INS-0032 (three stats read, two discarded at the join).
    ///
    /// Keeping the array answers four open questions that were all recorded as "not captured":
    ///   • DEATH ORDER  — the round where HpOnFinish first hits 0 (Mike: "if Pallas dies in the
    ///     waves, then the run is over" — wiping in the waves is a different failure from wiping
    ///     at the boss, and nothing downstream could tell them apart).
    ///   • PHASE BOUNDARY — early rounds with KilledEnemies > 0 are the wave; the transition to
    ///     zero kills marks the boss phase. This is the "phase timing" backlog item.
    ///   • TEMPO, MEASURED — Turns per round is how often the team actually acts, which tests the
    ///     turn-starvation hypothesis directly instead of inferring it from damage-taken rates.
    ///   • HP CURVES — who was under pressure, and when.
    ///
    /// LIVE-MEMORY ONLY: like healing/defense, this cannot be backfilled. Captures made before this
    /// build carry no round data, so the reader must be RUNNING during play.
    /// </summary>
    public List<HeroRoundSnapshot> Rounds { get; init; } = [];
}

/// <summary>One round of one hero's battle statistics, as the game records it.</summary>
internal sealed class HeroRoundSnapshot
{
    public int   Round             { get; init; }
    public int   KilledEnemiesCount { get; init; }
    public int   KilledAlliesCount  { get; init; }
    public int   TurnsCount         { get; init; }
    public float HpOnStart          { get; init; }
    public float HpOnFinish         { get; init; }
}

internal enum BattleResultType
{
    Unknown = 0,
    Victory = 1,
    Defeat  = 2,
    Draw    = 3,
}

internal enum BattleFinishCause
{
    Unknown               = -1,
    OneOfTheTeamDefeated  = 0,
    Retreat               = 1,
    TurnsLimitReached     = 2,
    PrematureResult       = 3,
    TimeLimitReached      = 4,
    UserConnectionTimeout = 5,
}
