using System.Text.Json;

namespace RslBattleReader;

/// <summary>
/// Identifies the dungeon/stage of a battle by matching known byte signatures
/// against the raw battleResults file.
///
/// The battleResults file contains no explicit stage id — the stage is encoded
/// implicitly via the enemy definition. Empirically, a stretch of that
/// enemy-definition region is byte-identical across every battle of a given
/// stage (regardless of the player's team, and regardless of win/loss) and
/// differs between stages. We store one such distinctive run per stage and
/// match by raw substring search. See FORMAT_NOTES.md.
/// </summary>
internal sealed class StageFingerprint
{
    public sealed class Signature
    {
        public string Dungeon { get; set; } = "";
        public int    Stage { get; set; }
        public string Difficulty { get; set; } = "";
        public string Label { get; set; } = "";
        public string SignatureHex { get; set; } = "";
        public byte[] Bytes { get; set; } = [];
    }

    private sealed class FileModel
    {
        public List<Signature> Signatures { get; set; } = [];
    }

    private readonly List<Signature> _sigs;

    private StageFingerprint(List<Signature> sigs) => _sigs = sigs;

    /// <summary>Loads stage-signatures.json from next to the executable.</summary>
    public static StageFingerprint Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "stage-signatures.json");
        if (!File.Exists(path))
        {
            Console.WriteLine($"[stage] no signature file at {path} — stage ID disabled");
            return new StageFingerprint([]);
        }

        try
        {
            var opts  = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var model = JsonSerializer.Deserialize<FileModel>(File.ReadAllText(path), opts)
                        ?? new FileModel();
            foreach (var s in model.Signatures)
                s.Bytes = Convert.FromHexString(s.SignatureHex);
            // Match longest signatures first (most distinctive).
            var ordered = model.Signatures.OrderByDescending(s => s.Bytes.Length).ToList();
            Console.WriteLine($"[stage] loaded {ordered.Count} stage signature(s)");
            return new StageFingerprint(ordered);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[stage] failed to load signatures: {ex.Message}");
            return new StageFingerprint([]);
        }
    }

    /// <summary>Returns the first signature whose bytes occur in the file, or null.</summary>
    public Signature? Identify(byte[] fileBytes)
    {
        foreach (var sig in _sigs)
            if (sig.Bytes.Length > 0 && IndexOf(fileBytes, sig.Bytes) >= 0)
                return sig;
        return null;
    }

    private static int IndexOf(byte[] haystack, byte[] needle)
    {
        int limit = haystack.Length - needle.Length;
        for (int i = 0; i <= limit; i++)
        {
            int j = 0;
            while (j < needle.Length && haystack[i + j] == needle[j]) j++;
            if (j == needle.Length) return i;
        }
        return -1;
    }
}
