namespace RslBattleReader.Models;

/// <summary>
/// Compact in-battle HP timeline attached to a battle-log entry, built by the live sampler
/// (BattleSampler.SampleOneBattle). Per-champion HP course (→ phase-at-death / near-death) plus the
/// boss's HP-over-time with debuff count (→ damage-to-boss + debuff-uptime per interval — the sim
/// calibration signal). Raw HP values are Fixed-point: divide by FixedDivisor for the integer HP.
/// </summary>
internal sealed class BattleTimeline
{
    public double FixedDivisor { get; init; }
    public double DurationSec  { get; init; }
    public int    FrameCount   { get; init; }
    public List<TimelineHero> Allies { get; init; } = [];
    public TimelineBoss? Boss { get; init; }
}

internal sealed class TimelineHero
{
    public int     Slot     { get; init; }
    public int     TypeId   { get; init; }
    public long    StartHp  { get; init; }
    public long    EndHp    { get; init; }
    public long    MinHp    { get; init; }   // lowest HP reached — the near-death / phase-at-death signal
    public double? DeathSec { get; init; }   // when HP first hit 0, else null (survived)
    // Fine-resolution HP CHANGE-points (not downsampled like the boss): every frame where this ally's HP
    // moved, so a single boss AoE hit (all allies dropping at the same TSec) is recoverable for deriving the
    // real DEF→mitigation curve first-party. Compact (only changes are stored, not every frame).
    public List<TimelinePoint> Trace { get; init; } = [];
}

internal sealed class TimelineBoss
{
    public int  Slot    { get; init; }
    public int  TypeId  { get; init; }
    public long MaxHp   { get; init; }
    public long StartHp { get; init; }
    public long EndHp   { get; init; }
    public List<TimelinePoint> Trace { get; init; } = [];  // downsampled HP-over-time
}

internal sealed class TimelinePoint
{
    public double TSec    { get; init; }
    public long   Hp      { get; init; }
    public int    Debuffs { get; init; }  // total active debuffs on the boss at this point
    /// <summary>Debuff count grouped by PRODUCER champion typeId (which champion applied them) —
    /// e.g. {"10123":6,"9943":2}. Nameable downstream via the roster/tags (producer → champion →
    /// its debuff kinds). Poison stacks show as the poisoner's count; the key IS a stable typeId.</summary>
    public Dictionary<int, int>? ByProducer { get; init; }
}
