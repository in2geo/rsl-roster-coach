using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Memory;

namespace RslBattleReader;

/// <summary>
/// One-shot heap scanner for finding the result-screen view-model. The per-hero
/// stats (damage/tank/heal) are NOT in the combat-logic StatisticsByHero dict (that's
/// empty post-battle); they're held by whatever the result UI binds to, and stay
/// stable for as long as the screen is open. So: with the result screen open, scan
/// the game's heap for the on-screen numbers and report where several of them cluster
/// — that cluster is the per-hero array we can then map (incl. a survival flag).
///
/// Usage:  RslBattleReader.exe --scan 85907,64079,120779,87497,17880
/// (pass the five damage numbers — or any stable on-screen values — comma-separated)
/// </summary>
[SupportedOSPlatform("windows")]
internal static class MemoryScanner
{
    public static void Run(int[] targets)
    {
        var proc = FindRaid();
        if (proc is null) { Console.WriteLine("[scan] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[scan] could not open process (run as admin)."); return; }

        var set = new HashSet<int>(targets);
        var hits = new List<(long addr, int val)>();
        long scanned = 0; int regions = 0;
        var buf = new byte[8 * 1024 * 1024];

        Console.WriteLine($"[scan] searching heap for {targets.Length} value(s): {string.Join(", ", targets)}");
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
        {
            regions++;
            for (long off = 0; off < size; off += buf.Length)
            {
                int chunk = (int)Math.Min(buf.Length, size - off);
                var view = chunk == buf.Length ? buf : new byte[chunk];
                if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                scanned += chunk;
                for (int i = 0; i + 4 <= chunk; i += 4)   // 4-byte aligned ints
                {
                    int v = BitConverter.ToInt32(view, i);
                    if (set.Contains(v)) hits.Add(((long)baseAddr + off + i, v));
                }
            }
        }
        Console.WriteLine($"[scan] {regions} regions, {scanned / (1024 * 1024)} MB, {hits.Count} raw hit(s).");

        hits.Sort((a, b) => a.addr.CompareTo(b.addr));
        Console.WriteLine("\n[scan] raw hits (feed one of these addresses to --ptrscan):");
        foreach (var h in hits)
            Console.WriteLine($"  0x{h.addr:X}  = {h.val}");

        // Cluster: windows (≤2048 bytes) holding ≥2 distinct target values — the per-hero
        // array is ~5×0xD0=1040 bytes wide, so 512 was too tight to catch adjacent heroes.
        const int WindowBytes = 2048;
        Console.WriteLine($"\n[scan] clusters (≥2 distinct values within {WindowBytes} bytes):");
        int clusters = 0;
        for (int i = 0; i < hits.Count; i++)
        {
            var window = new List<(long addr, int val)> { hits[i] };
            for (int j = i + 1; j < hits.Count && hits[j].addr - hits[i].addr <= WindowBytes; j++)
                window.Add(hits[j]);
            int distinct = window.Select(h => h.val).Distinct().Count();
            if (distinct >= 2)
            {
                clusters++;
                Console.WriteLine($"  @0x{hits[i].addr:X} spans {window[^1].addr - hits[i].addr}B, {distinct} distinct:");
                foreach (var h in window)
                    Console.WriteLine($"     +0x{h.addr - hits[i].addr:X3}  0x{h.addr:X}  = {h.val}");
                i += window.Count - 1;
            }
        }
        if (clusters == 0)
            Console.WriteLine("  none — values may be float/long/string-formatted, or screen was closed. " +
                              "Confirm the result screen is open and the numbers match exactly.");
    }

    private static Process? FindRaid()
    {
        foreach (var n in new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" })
        {
            var p = Process.GetProcessesByName(n);
            if (p.Length > 0) return p[0];
        }
        return null;
    }
}
