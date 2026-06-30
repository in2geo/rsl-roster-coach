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
