namespace RslBattleReader.Models;

/// <summary>
/// One champion that took part in a battle, recovered from the battleResults file.
/// Identity only (this is the first hero-decode tier): which champion, in what
/// slot. Survival / skills-used are not decoded yet.
/// </summary>
internal sealed record BattleHero
{
    /// <summary>Battle slot, left-to-right (0-based), by file appearance order.</summary>
    public int Slot { get; init; }

    /// <summary>Inventory hero id — joins to the Gestal roster's heroId.</summary>
    public int HeroId { get; init; }

    /// <summary>Champion type id (the 16-bit value preceding the "h" key).</summary>
    public int TypeId { get; init; }

    /// <summary>Resolved champion name (from the roster). Null until validated.</summary>
    public string? Name { get; init; }

    /// <summary>
    /// True for the team leader — whose aura applies. The leader is slot 0 (first
    /// hero in file order = left-most on the battle-result screen; it's the right-most
    /// on the team-SELECT screen). Confirmed on labeled battles and corroborated by an
    /// explicit leader-ref record in the file. The aura EFFECT is the leader champion's
    /// static aura skill (resolved separately from champion data), not in the file.
    /// </summary>
    public bool IsLeader { get; init; }

    /// <summary>
    /// Whether the champion was alive at battle end (true) or died (false). Null if
    /// the in-memory hero statistics weren't readable for this capture. Read from
    /// HeroStatistics.IsDead in process memory and joined by heroId.
    /// </summary>
    public bool? Survived { get; init; }

    /// <summary>Enemies this champion killed (summed across rounds). Null if unread.</summary>
    public int? Kills { get; init; }
}
