using System.Text.Json.Serialization;

namespace RslBattleReader.Models;

/// <summary>
/// The serialized shape written to battle-log.json. Distinct from the internal
/// BattleResultSnapshot so we control the on-disk schema independently:
/// account-stamped, camelCase, flat. Property order here is the JSON field order.
///
/// Extra fields beyond the minimal {accountId, displayName, capturedAt, stage,
/// result, turns, heroes} set are retained (dungeon/stageNumber/difficulty/
/// finishCause/manualSkillUsed) so no captured signal — notably the retreat flag
/// in finishCause — is lost.
/// </summary>
internal sealed class BattleLogEntry
{
    public string? AccountId   { get; init; }
    public string? DisplayName { get; init; }
    public string  CapturedAt  { get; init; } = "";
    public string? Stage       { get; init; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public BattleResultType Result { get; init; }

    public int? Turns { get; init; }

    public string? Dungeon     { get; init; }
    public int?    StageNumber { get; init; }
    public string? Difficulty  { get; init; }

    // Authoritative stage id from game memory (BattleSetup.StageId). Captured raw so
    // a StageId→(dungeon,stage) map can be built from labeled battles, then used to
    // resolve stage numbers for shared-id dungeons the fingerprint can't split.
    public int? StageId      { get; init; }
    public int? BattleKindId { get; init; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public BattleFinishCause FinishCause { get; init; }

    public bool ManualSkillUsed { get; init; }

    /// <summary>Total damage dealt (Clan Boss only) — feeds the chest-tier pipeline.</summary>
    public long? TotalDamageDealt { get; init; }

    public List<BattleHero> Heroes { get; init; } = [];

    public static BattleLogEntry From(BattleResultSnapshot s) => new()
    {
        AccountId       = s.AccountId,
        DisplayName     = s.DisplayName,
        CapturedAt      = s.CapturedAt,
        Stage           = s.StageLabel,
        Result          = s.ResultType,
        Turns           = s.AllyTurns,
        Dungeon         = s.Dungeon,
        StageNumber     = s.StageNumber,
        Difficulty      = s.Difficulty,
        StageId         = s.StageId,
        BattleKindId    = s.BattleKindId,
        FinishCause     = s.FinishCause,
        ManualSkillUsed = s.ManualSkillUsed,
        TotalDamageDealt = s.TotalDamageDealt,
        Heroes          = s.Heroes,
    };
}
