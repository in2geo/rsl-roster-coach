using System.Runtime.Versioning;
using RslBattleReader;
using RslBattleReader.Account;

[assembly: SupportedOSPlatform("windows")]

// Diagnostic: print the resolved account and exit. Handy for verifying which
// account the reader will stamp after switching accounts in Gestal/Plarium.
if (args.Contains("--whoami"))
{
    var who = AccountResolver.Resolve();
    Console.WriteLine($"accountId   = {who.AccountId ?? "(none)"}");
    Console.WriteLine($"displayName = {who.DisplayName ?? "(none)"}");
    return;
}

// Option B: read the owned champion roster directly from game memory (no Gestal).
// Requires Raid running with the account loaded. Validate output vs the Gestal export.
if (args.Contains("--roster"))
{
    RosterReader.Run();
    return;
}

if (args.Contains("--gear"))
{
    ArtifactReader.Run();
    return;
}

// Debug: dump Hero objects matching a heroId. Usage: --hero 11
{
    int hi = Array.IndexOf(args, "--hero");
    if (hi >= 0 && hi + 1 < args.Length && int.TryParse(args[hi + 1], out var id))
    {
        RosterReader.DebugHero(id);
        return;
    }
}

// Diagnostic: scan the game's heap for on-screen values (find the result-screen
// view-model). Usage: --scan 85907,64079,120779,87497,17880
{
    int si = Array.IndexOf(args, "--scan");
    if (si >= 0 && si + 1 < args.Length)
    {
        var targets = args[si + 1].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var v) ? v : 0).Where(v => v != 0).ToArray();
        if (targets.Length == 0) { Console.WriteLine("Usage: --scan 85907,64079,120779,87497,17880"); return; }
        MemoryScanner.Run(targets);
        return;
    }
}

// Diagnostic: find a STABLE pointer chain from a fixed root (module static / AppModel) to
// the runtime address a prior --scan reported for the damage cluster. See PointerScanner.cs.
// Usage: --ptrscan <targetHex> [maxDepth=6] [maxOffsetHex=800]
{
    int pi = Array.IndexOf(args, "--ptrscan");
    if (pi >= 0 && pi + 1 < args.Length)
    {
        static long ParseAddr(string s)
        {
            s = s.Trim();
            if (s.StartsWith("0x", StringComparison.OrdinalIgnoreCase)) s = s[2..];
            return long.TryParse(s, System.Globalization.NumberStyles.HexNumber,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }
        long target = ParseAddr(args[pi + 1]);
        if (target == 0) { Console.WriteLine("Usage: --ptrscan <targetHex> [maxDepth=6] [maxOffsetHex=800]"); return; }
        int depth  = (pi + 2 < args.Length && int.TryParse(args[pi + 2], out var d)) ? d : 6;
        int maxOff = (pi + 3 < args.Length) ? (int)ParseAddr(args[pi + 3]) : 0x800;
        RslBattleReader.PointerScanner.Run(target, depth, maxOff);
        return;
    }
}

// Read per-hero battle-result damage/defense/heal from the BattleFinishDialog VM.
// Usage: --cbdamage  (result screen must be open)
if (args.Contains("--cbdamage"))
{
    RslBattleReader.CbDamageReader.Run();
    return;
}

// Diagnostic: list every Il2CppClass in a namespace (find sibling classes of a known one).
// Usage: --nsclasses Client.ViewModel.Contextes.BattleFinishDialog
{
    int ni = Array.IndexOf(args, "--nsclasses");
    if (ni >= 0 && ni + 1 < args.Length)
    {
        RslBattleReader.NsClassLister.Run(args[ni + 1]);
        return;
    }
}

// Read per-hero DUNGEON result damage (Spider/IG/Dragon/FK). Result screen must be open.
// Usage: --dungeondamage
if (args.Contains("--dungeondamage")) { RslBattleReader.CbDamageReader.DungeonRun(); return; }

// Diagnostic: find HeroBattleStatsContext instances directly + decode damage. Usage: --herostats [max]
{
    int rsi = Array.IndexOf(args, "--roundstats");
    if (rsi >= 0) { int m = (rsi + 1 < args.Length && int.TryParse(args[rsi + 1], out var rv)) ? rv : 20; RslBattleReader.CbDamageReader.RoundStatsScan(m); return; }

    int hi = Array.IndexOf(args, "--herostats");
    if (hi >= 0) { int m = (hi + 1 < args.Length && int.TryParse(args[hi + 1], out var v)) ? v : 40; RslBattleReader.CbDamageReader.HeroStatsScan(m); return; }
}

// Diagnostic: dump the dungeon result dialog's slots to confirm the hero-list offset + spot a
// wave/phase field. Result screen must be open. Usage: --dungeoninspect [slots=80]
{
    int di = Array.IndexOf(args, "--dungeoninspect");
    if (di >= 0)
    {
        int slots = (di + 1 < args.Length && int.TryParse(args[di + 1], out var s)) ? s : 80;
        RslBattleReader.CbDamageReader.DungeonInspect(slots);
        return;
    }
}

// Diagnostic: find all locations pointing at an object + their containing class.
// Usage: --refs <hexObjAddr> [maxBackHex=600]
{
    int ri = Array.IndexOf(args, "--refs");
    if (ri >= 0 && ri + 1 < args.Length)
    {
        static long ParseAddr(string s)
        {
            s = s.Trim();
            if (s.StartsWith("0x", StringComparison.OrdinalIgnoreCase)) s = s[2..];
            return long.TryParse(s, System.Globalization.NumberStyles.HexNumber,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }
        long addr = ParseAddr(args[ri + 1]);
        if (addr == 0) { Console.WriteLine("Usage: --refs <hexObjAddr> [maxBackHex=600]"); return; }
        int maxBack = (ri + 2 < args.Length) ? (int)ParseAddr(args[ri + 2]) : 0x600;
        RslBattleReader.RefFinder.Run(addr, maxBack);
        return;
    }
}

// Diagnostic: inspect an IL2CPP object (class name + annotated field dump).
// Usage: --inspect <hexAddr> [slotCount=32]
{
    int ii = Array.IndexOf(args, "--inspect");
    if (ii >= 0 && ii + 1 < args.Length)
    {
        static long ParseAddr(string s)
        {
            s = s.Trim();
            if (s.StartsWith("0x", StringComparison.OrdinalIgnoreCase)) s = s[2..];
            return long.TryParse(s, System.Globalization.NumberStyles.HexNumber,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }
        long addr = ParseAddr(args[ii + 1]);
        if (addr == 0) { Console.WriteLine("Usage: --inspect <hexAddr> [slotCount=32]"); return; }
        int slots = (ii + 2 < args.Length && int.TryParse(args[ii + 2], out var s2)) ? s2 : 32;
        RslBattleReader.ObjectInspector.Run(addr, slots);
        return;
    }
}

// Diagnostic: parse an existing battle dump offline (no game needed). Verifies the
// file-parse path against a captured dump — handy after a game-format change.
// Usage: --parse <path-to-file_HHMMSS.bin>
{
    int pi = Array.IndexOf(args, "--parse");
    if (pi >= 0 && pi + 1 < args.Length)
    {
        var bytes = File.ReadAllBytes(args[pi + 1]);
        var results = BattleFileParser.ParseAll(bytes);
        if (results.Count == 0) { Console.WriteLine("no results parsed (setup blob not found?)"); return; }
        foreach (var r in results)
            Console.WriteLine($"parsed: {r.ResultType} | dungeon={r.Dungeon ?? "?"} stage={r.StageNumber?.ToString() ?? "?"} " +
                              $"turns={r.AllyTurns?.ToString() ?? "?"} finish={r.FinishCause} heroCandidates={r.Heroes.Count}");
        return;
    }
}

var outputPath = Path.GetFullPath(
    Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "output", "battle-log.json"));

// Allow overriding output path via first argument (ignore flags like --whoami)
if (args.Length > 0 && !args[0].StartsWith("--")) outputPath = Path.GetFullPath(args[0]);

Console.WriteLine("RSL Battle Reader");
Console.WriteLine("=================");
Console.WriteLine($"Output: {outputPath}");
Console.WriteLine("Press Ctrl+C to stop.\n");

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cts.Cancel();
};

var watcher = new BattleWatcher(outputPath);
await watcher.RunAsync(cts.Token);
Console.WriteLine("\n[stopped]");
