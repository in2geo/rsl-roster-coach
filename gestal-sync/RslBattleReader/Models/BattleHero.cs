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

    /// <summary>Damage dealt this battle, from the Clan Boss result dialog (joined by slot).
    /// Null for non-CB battles or when the result dialog wasn't readable.</summary>
    public long? Damage { get; init; }

    /// <summary>
    /// The result dialog's second per-hero stat (HeroBattleStatContext +0x098, named "Defense" in
    /// the VM) — the middle/blue bar on the result screen. CbDamageReader has always read this; it
    /// was simply discarded at the join until 2026-07-18.
    ///
    /// SEMANTICS NOT YET CONFIRMED: the VM calls it Defense, and the observed values cluster in a
    /// way consistent with damage TAKEN (Don$Gnut CB Nightmare 2026-07-18: 63,928 / 77,919 / 64,642
    /// / 63,373 / 45,311), but that is inference from one capture, not a verified mapping. Do NOT
    /// build scoring on this field until a --cbdamage run has been matched against a result-screen
    /// screenshot bar-for-bar. Kept under the VM's own name rather than an interpreted one for
    /// exactly that reason.
    /// </summary>
    public long? Defense { get; init; }

    /// <summary>
    /// Healing done this battle (HeroBattleStatContext +0x0A0) — the green bar on the result screen.
    ///
    /// WHY THIS MATTERS: per-hero DAMAGE systematically understates supports (CLAUDE.md damage
    /// mechanics §4). Glorious Pallas on the 2026-07-18 Don$Gnut run shows 228,252 damage — 1.7% of
    /// team output, which reads as dead weight — while healing 330,038, the most on the team by
    /// 2.4x. Capturing this turns "sustain is multiplicative" (§3) from an argument into a
    /// measurement, and is a direct input to the blocked survival calibration (INS-0018).
    /// </summary>
    public long? Healing { get; init; }
}
