using RslBattleReader.Models;
using RslBattleReader.MsgPack;

namespace RslBattleReader;

/// <summary>
/// Extracts a BattleResultSnapshot from the Plarium battleResults file.
///
/// The file is a custom Plarium serialization (NOT standard MessagePack for the
/// payloads — see FORMAT_NOTES.md). The outer array IS standard MessagePack:
///   [ ext(header), bin(setup), bin(stats)?, bin(heroRounds), ... ]
///
/// Two fields are reliably recoverable:
///   • ResultType — the "setup" blob (the one starting F2 52 91) begins with
///     clean MessagePack: [-14, 82, [ map{ "i":ResultType, "c":0, "p":{...} } ]]
///     so setupBlob[8] = 1 (Victory) / 2 (Defeat) / 3 (Draw, assumed).
///   • Stage — identified by byte-signature fingerprint over the whole file
///     (StageFingerprint), since there is no explicit stage id.
///
/// AllyTurns / hero stats are encoded in the custom columnar regions and are
/// not yet decoded.
/// </summary>
internal static class BattleFileParser
{
    // Setup blob marker: -14, 82, fixarray(1), map16 …
    private static readonly byte[] SetupBlobMarker = [0xF2, 0x52, 0x91, 0xDE];

    private static readonly StageFingerprint Fingerprint = StageFingerprint.Load();

    private static byte[]? _lastSeenFile;

    public static List<BattleResultSnapshot> ParseAll(byte[] fileBytes)
    {
        var results = new List<BattleResultSnapshot>();
        try
        {
            // The fast poller fires repeatedly during the write window; only act
            // on a genuinely new file image.
            bool isNew = _lastSeenFile is null || !fileBytes.AsSpan().SequenceEqual(_lastSeenFile);
            if (!isNew) return results;
            _lastSeenFile = (byte[])fileBytes.Clone();

            DumpRawForAnalysis(fileBytes);

            int pos = 0;
            if (MsgPackReader.Read(fileBytes, ref pos) is not List<object?> outer || outer.Count < 2)
                return results;

            // Find the setup blob (carries the ResultType).
            byte[]? setup = null;
            foreach (var o in outer)
                if (o is byte[] blob && StartsWith(blob, SetupBlobMarker)) { setup = blob; break; }

            if (setup is null || setup.Length < 9)
            {
                Console.WriteLine("  [parse] setup blob not found — skipping");
                return results;
            }

            // setup[6..7] should be the "i" key (A1 69); setup[8] is its value.
            var resultType = (setup[6] == 0xA1 && setup[7] == 0x69)
                ? (BattleResultType)setup[8]
                : BattleResultType.Unknown;

            // setup[9..10] is the "c" key (A1 63); setup[11] is its value.
            // Empirically c=1 only on a manual retreat/cancel; c=0 for victories
            // and fought-to-the-end defeats. Treat c=1 as FinishCause=Retreat.
            var finishCause = (setup.Length > 11 && setup[9] == 0xA1 && setup[10] == 0x63 && setup[11] == 1)
                ? BattleFinishCause.Retreat
                : BattleFinishCause.Unknown;

            // Stage via fingerprint over the whole file (gives stage number +
            // difficulty for stages we've sampled).
            var stage = Fingerprint.Identify(fileBytes);

            // Dungeon via the explicit ENCOUNTER id. Maps many-to-one onto a
            // dungeon (robust, exact-int, team-independent). Primary source for
            // Dungeon; also supplies the stage number where the id is known to be
            // stage-specific. The fingerprint backstops both (and is the only
            // source of stage number for ids that span several stages).
            var dungeonId = DungeonId.Identify(fileBytes);
            var dungeonName = dungeonId?.Name ?? stage?.Dungeon;
            var stageNumber = dungeonId?.Stage ?? stage?.Stage;
            var stageLabel = stage?.Label
                ?? (dungeonName is null ? null
                    : stageNumber is int sn ? $"{dungeonName} Stage {sn}"
                    : $"{dungeonName} (stage unknown)");
            if (dungeonId is { Name: null } unknown)
                Console.WriteLine($"  [dungeon] unrecognised encounter id {unknown.Id} — add to DungeonId.Map");

            // AllyTurns: the "t":<turns> field, identified by the constant fields
            // that follow it — "b":true "g":false ("A1 62 C3 A1 67 C2"). The turns
            // value sits between the "t" key (A1 74) and that anchor. Absent on a
            // manual retreat (the game records no turn count).
            var allyTurns = ExtractAllyTurns(fileBytes);

            results.Add(new BattleResultSnapshot
            {
                CapturedAt  = DateTime.UtcNow.ToString("o"),
                ResultType  = resultType,
                FinishCause = finishCause,
                Dungeon     = dungeonName,
                StageNumber = stageNumber,
                Difficulty  = stage?.Difficulty,
                StageLabel  = stageLabel,
                AllyTurns   = allyTurns,
                HeroStats   = [],
                // Raw hero candidates (allies + enemies); validated/named in the
                // watcher against the resolved account's roster.
                Heroes      = HeroIdentity.Extract(fileBytes),
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  [parse] error: {ex.Message}");
        }
        return results;
    }

    public static BattleResultSnapshot? TryParse(byte[] fileBytes)
    {
        var all = ParseAll(fileBytes);
        return all.Count > 0 ? all[0] : null;
    }

    // Fields that immediately FOLLOW the turns value: "b":true "g":false.
    // Used to disambiguate the turns "t" from the ~17 other "t" keys in the file.
    private static readonly byte[] TurnsAnchor = [0xA1, 0x62, 0xC3, 0xA1, 0x67, 0xC2];

    /// <summary>
    /// Extracts AllyTurns: the value in "t":&lt;turns&gt; that is immediately
    /// followed by TurnsAnchor. Returns null if not present (e.g. manual retreat).
    /// Handles fixint, uint8 (CC) and uint16 (CD) encodings of the value.
    /// </summary>
    private static int? ExtractAllyTurns(byte[] data)
    {
        for (int i = IndexOf(data, TurnsAnchor); i >= 0; i = IndexOf(data, TurnsAnchor, i + 1))
        {
            // Walk back over the value to find the "t" key (A1 74).
            // Layouts: A1 74 <fixint>            -> value at i-1
            //          A1 74 CC <u8>             -> value at i-1
            //          A1 74 CD <u8 u8>          -> value at i-2..i-1
            if (i >= 3 && data[i - 3] == 0xA1 && data[i - 2] == 0x74 && data[i - 1] < 0x80)
                return data[i - 1];
            if (i >= 4 && data[i - 4] == 0xA1 && data[i - 3] == 0x74 && data[i - 2] == 0xCC)
                return data[i - 1];
            if (i >= 5 && data[i - 5] == 0xA1 && data[i - 4] == 0x74 && data[i - 3] == 0xCD)
                return (data[i - 2] << 8) | data[i - 1];
        }
        return null;
    }

    private static int IndexOf(byte[] haystack, byte[] needle, int start = 0)
    {
        int limit = haystack.Length - needle.Length;
        for (int i = start; i <= limit; i++)
        {
            int j = 0;
            while (j < needle.Length && haystack[i + j] == needle[j]) j++;
            if (j == needle.Length) return i;
        }
        return -1;
    }

    private static bool StartsWith(byte[] data, byte[] prefix)
    {
        if (data.Length < prefix.Length) return false;
        for (int i = 0; i < prefix.Length; i++)
            if (data[i] != prefix[i]) return false;
        return true;
    }

    // Dumps the full battleResults file + each inner blob next to the exe so the
    // stage-signature library can be grown offline. See tools/make-signature.py.
    private static void DumpRawForAnalysis(byte[] fileBytes)
    {
        try
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "battle-dumps");
            Directory.CreateDirectory(dir);
            var stamp = DateTime.Now.ToString("HHmmss");
            File.WriteAllBytes(Path.Combine(dir, $"file_{stamp}.bin"), fileBytes);

            int pos = 0;
            if (MsgPackReader.Read(fileBytes, ref pos) is List<object?> outer)
                for (int bi = 0; bi < outer.Count; bi++)
                    if (outer[bi] is byte[] blob)
                        File.WriteAllBytes(Path.Combine(dir, $"blob_{stamp}_{bi}.bin"), blob);

            Console.WriteLine($"  [dump] raw bytes → {dir} (stamp {stamp})");
        }
        catch (Exception ex) { Console.WriteLine($"  [dump] failed: {ex.Message}"); }
    }
}
