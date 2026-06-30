using System.Text.Json;

namespace RslBattleReader.Account;

/// <summary>
/// Loads the player's Gestal roster export (heroId → name + typeId) so battle
/// hero candidates can be validated and named. Reads the normalized export that
/// sync.js writes to gestal-sync/output/&lt;name&gt;_&lt;accountId&gt;.json (the
/// reader's own output lives in a sibling dir, so the path is relative to the exe).
/// Cached by file path + mtime so the file is only re-parsed when it changes.
/// </summary>
internal static class RosterLookup
{
    public readonly record struct Champ(string Name, int TypeId);

    private static string? _cachedFile;
    private static long _cachedMtime;
    private static Dictionary<int, Champ> _cache = new();

    // gestal-sync/output, relative to the exe (…/RslBattleReader/bin/Release/<tfm>/win-x64).
    private static string OutputDir => Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "output"));

    /// <summary>heroId → champion (name, typeId) for the given account. Empty if unavailable.</summary>
    public static Dictionary<int, Champ> ForAccount(string? accountId)
    {
        if (accountId is null || !Directory.Exists(OutputDir)) return _cache = new();

        var file = Directory.GetFiles(OutputDir, "*.json")
            .Where(f =>
            {
                var n = Path.GetFileName(f);
                return n == $"{accountId}.json" || n.EndsWith($"_{accountId}.json");
            })
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .FirstOrDefault();
        if (file is null) return _cache = new();

        var mtime = File.GetLastWriteTimeUtc(file).Ticks;
        if (file == _cachedFile && mtime == _cachedMtime) return _cache;

        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(file));
            var map = new Dictionary<int, Champ>();
            if (doc.RootElement.TryGetProperty("champions", out var champs))
                foreach (var c in champs.EnumerateArray())
                    if (c.TryGetProperty("heroId", out var h) && c.TryGetProperty("typeId", out var t))
                    {
                        var name = c.TryGetProperty("name", out var n) ? n.GetString() : null;
                        map[h.GetInt32()] = new Champ(name ?? "", t.GetInt32());
                    }
            _cachedFile = file; _cachedMtime = mtime; _cache = map;
            return map;
        }
        catch
        {
            return _cache = new();
        }
    }
}
