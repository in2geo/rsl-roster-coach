namespace RslBattleReader;

/// <summary>
/// Recovers the explicit ENCOUNTER id from the battleResults file and maps it to
/// a dungeon (and, where known, a stage number).
///
/// The file carries an explicit content id embedded as a MessagePack map
/// `82 A1 69 &lt;id&gt;` ("i":id) in the 200000–260000 band. IMPORTANT: this is a
/// per-ENCOUNTER id, NOT a per-dungeon id. It maps many-to-one onto a dungeon
/// (Arcane Keep stage 6 = 219929, stage 10 = 219911 — both Arcane Keep), but it
/// does NOT stay constant across every stage: some dungeons reuse one id across
/// several stages (Ice Golem 7/8/9 all = 221001; Spider 1/3 = 221801; Spirit
/// 6/8 = 220501), others change it per stage (Arcane 6 vs 10). So:
///   • id → dungeon NAME is reliable (many-to-one) once every encounter id is mapped.
///   • id → stage NUMBER is only set where the id is confirmed stage-specific
///     (i.e. we have observed the same dungeon at &gt;1 stage with distinct ids).
///     For ids that span stages, Stage is null and the fingerprint supplies it.
/// Unlike the byte fingerprint, this id is an exact integer (robust, not a fragile
/// substring) and is team-independent (it's the enemy setup, not the player team).
/// Ids decoded from the labeled dump set — see FORMAT_NOTES.md.
/// </summary>
internal static class DungeonId
{
    private readonly record struct Entry(string Dungeon, int? Stage);

    // Encounter-id → (dungeon, stage?). Stage is set only where the id is known to
    // be stage-specific (Arcane Keep: two stages observed with distinct ids).
    // Where one id spans multiple stages, Stage stays null and the fingerprint
    // disambiguates the stage number. Single-stage-sampled dungeons also keep
    // Stage null (we can't yet tell if their id is stage-specific or shared).
    private static readonly Dictionary<int, Entry> Map = new()
    {
        [221001] = new("Ice Golem's Peak", null),     // spans stages 7/8/9 → fingerprint for stage#
        [221801] = new("Spider's Den", null),         // spans stages 1/3 → fingerprint for stage#
        [220501] = new("Spirit Keep", null),          // spans stages 6/8 → fingerprint for stage#
        [219929] = new("Arcane Keep", 6),             // stage-specific (paired with 219911)
        [219911] = new("Arcane Keep", 10),            // stage-specific (paired with 219929)
        [221401] = new("Fire Knight's Castle", null), // single sample (st5) → fingerprint for stage#
        [220301] = new("Void Keep", null),            // single sample (st5)
        [220201] = new("Force Keep", null),           // spans stages 6/10 (confirmed) → fingerprint for stage#
        [220401] = new("Magic Keep", null),           // single sample (st6)
        [220601] = new("Dragon's Lair", 3),           // stage-specific (paired with 222601)
        [222601] = new("Dragon's Lair", 11),          // stage-specific (paired with 220601)
    };

    // StageId (from BattleSetup in memory) encodes <dungeon-prefix><stage:3 digits>,
    // e.g. 2059013 = Arcane Keep stage 13. The prefix is ONE per dungeon — more
    // complete than the per-stage encounter ids above — so it's the preferred dungeon
    // source when StageId is available. Confirmed from labeled captures + screenshots.
    // NOTE: difficulty is NOT encoded here (comes from the fingerprint); Hard variants
    // may use a different prefix — unverified, add when a Hard sample appears.
    private static readonly Dictionary<int, string> StageIdPrefixNames = new()
    {
        [2029] = "Spirit Keep",
        [2049] = "Force Keep",
        [2059] = "Arcane Keep",
        [2069] = "Dragon's Lair",
        [2079] = "Ice Golem's Peak",
        [2189] = "Event Dungeon",   // rotating event content (2189012 = Event stage 12, confirmed 2026-07-01)
    };

    /// <summary>Dungeon name from a StageId's prefix (stageId / 1000), or null if unmapped.</summary>
    public static string? DungeonFromStageId(int stageId) =>
        stageId > 1000 && StageIdPrefixNames.TryGetValue(stageId / 1000, out var n) ? n : null;

    public readonly record struct Match(int Id, string? Name, int? Stage);

    // Plausible band for encounter content ids (excludes the smaller team-setup
    // ids like 104101/44601 and the larger enemy-instance ids).
    private const int BandLo = 200000;
    private const int BandHi = 260000;

    /// <summary>
    /// Scans for embedded "i":&lt;id&gt; setup maps and returns the dungeon match.
    /// Prefers an id present in the known map; otherwise returns the lowest
    /// in-band id with Name=null so an unrecognised encounter can still be logged
    /// (and added to the table later). Returns null if none found.
    /// </summary>
    public static Match? Identify(byte[] data)
    {
        int? lowestInBand = null;
        // Pattern: 82 A1 69  then an int (fixint / CC / CD / CE).
        for (int i = 0; i + 3 < data.Length; i++)
        {
            if (data[i] != 0x82 || data[i + 1] != 0xA1 || data[i + 2] != 0x69) continue;
            int v = ReadInt(data, i + 3);
            if (v < BandLo || v >= BandHi) continue;
            if (Map.TryGetValue(v, out var e)) return new Match(v, e.Dungeon, e.Stage);
            if (lowestInBand is null || v < lowestInBand) lowestInBand = v;
        }
        return lowestInBand is int id ? new Match(id, null, null) : null;
    }

    // Reads a MessagePack-style unsigned int (positive fixint, uint8, uint16,
    // uint32). Returns -1 if the byte at p is not one of those.
    private static int ReadInt(byte[] d, int p)
    {
        if (p >= d.Length) return -1;
        byte b = d[p];
        if (b < 0x80) return b;
        return b switch
        {
            0xCC when p + 1 < d.Length => d[p + 1],
            0xCD when p + 2 < d.Length => (d[p + 1] << 8) | d[p + 2],
            0xCE when p + 4 < d.Length => (d[p + 1] << 24) | (d[p + 2] << 16) | (d[p + 3] << 8) | d[p + 4],
            _ => -1,
        };
    }
}
