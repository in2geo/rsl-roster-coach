using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Memory;

namespace RslBattleReader;

/// <summary>
/// Finds every heap location holding a pointer to a given object, and for each, identifies
/// the CONTAINING object (nearest preceding valid Il2CppClass) + its class and the field
/// offset. Walking up from the damage LongProperty this reveals the per-hero result
/// view-model and the collection that holds it — the named, stable anchor we can navigate
/// from AppModel instead of a fragile static-RVA pointer chain.
///
/// Usage:  RslBattleReader.exe --refs &lt;hexObjAddr&gt; [maxBack=0x600]
/// PASSIVE READ ONLY.
/// </summary>
[SupportedOSPlatform("windows")]
internal static class RefFinder
{
    public static void Run(long target, int maxBack)
    {
        var proc = FindRaid();
        if (proc is null) { Console.WriteLine("[refs] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[refs] could not open process (run as admin)."); return; }

        Console.WriteLine($"[refs] object @0x{target:X}  class = {ObjectInspector.ClassNameOf(mem, (nint)target) ?? "(unresolved)"}");

        var holders = new List<long>();
        var buf = new byte[8 * 1024 * 1024];
        foreach (var (baseAddr, size) in mem.EnumerateAllReadableRegions())
        {
            for (long off = 0; off < size; off += buf.Length)
            {
                int chunk = (int)Math.Min(buf.Length, size - off);
                var view = chunk == buf.Length ? buf : new byte[chunk];
                if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                for (int i = 0; i + 8 <= chunk; i += 8)
                    if (BitConverter.ToInt64(view, i) == target)
                        holders.Add((long)baseAddr + off + i);
            }
        }

        Console.WriteLine($"[refs] {holders.Count} location(s) point at 0x{target:X}:\n");
        foreach (var loc in holders)
        {
            // Find the containing object: nearest preceding qword that is a live klass pointer.
            string desc = "(no containing object found)";
            for (long c = loc; c >= loc - maxBack; c -= 8)
            {
                var cn = ObjectInspector.ClassNameOf(mem, (nint)c);
                if (cn != null) { desc = $"{{{cn}}} + 0x{loc - c:X}"; break; }
            }
            Console.WriteLine($"  0x{loc:X}  =>  {desc}");
        }
        proc.Dispose();
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
