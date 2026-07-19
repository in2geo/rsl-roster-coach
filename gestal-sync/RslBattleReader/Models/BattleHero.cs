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

    // ── Added 2026-07-19 after an audit prompted by Mike: "what other info are we discarding?" ──
    // All of the below were ALREADY being read into HeroStatSnapshot from process memory and then
    // dropped at the join (BattleWatcher ~L841 took only IsDead + KilledEnemiesCount from a snapshot
    // carrying twelve fields). This is the THIRD instance of the same defect: healing/defense were
    // discarded the same way until 2026-07-18, and the per-round array added earlier today would have
    // been discarded at this very join too. Nothing new is read from memory — this is plumbing.

    /// <summary>Star grade AT BATTLE TIME. Lets a run be graded against the roster as it WAS, rather
    /// than against a current snapshot that may have changed since.</summary>
    public int? Grade { get; init; }

    /// <summary>Champion level AT BATTLE TIME. Same reason as Grade — this is the development-verdict
    /// input (level/stars) frozen at the moment the run happened.</summary>
    public int? Level { get; init; }

    /// <summary>Turns THIS champion took, summed across rounds. TEMPO, measured per champion —
    /// previously only inferable from damage-taken rates.</summary>
    public int? TurnsCount { get; init; }

    /// <summary>Effective HP at battle start — the champion's REAL built HP, measured. `estimate-stats.js`
    /// currently guesses this and is documented over-estimating under-levelled champs ~3.3x
    /// (see the stat-estimator-accuracy memory). Direct input to gear-tier calibration.</summary>
    public float? HpOnStart { get; init; }

    /// <summary>HP remaining at battle end. Distinguishes a comfortable survivor from one that
    /// finished at 2% — invisible in the boolean `Survived`.</summary>
    public float? HpOnFinish { get; init; }

    /// <summary>Allies this champion killed (sacrifice/HP-transfer mechanics). Usually 0.</summary>
    public int? KilledAlliesCount { get; init; }

    /// <summary>
    /// PER-ROUND breakdown — death ORDER, the wave/boss phase boundary, per-round tempo, HP curves.
    /// Empty for captures made before 2026-07-19; live-memory only, cannot be backfilled.
    /// </summary>
    public List<HeroRoundSnapshot>? Rounds { get; init; }
}
