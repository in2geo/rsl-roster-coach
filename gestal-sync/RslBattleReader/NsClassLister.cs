using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Memory;

namespace RslBattleReader;

/// <summary>
/// Diagnostic: list every Il2CppClass name in a given namespace, by scanning memory for the
/// namespace string and finding the classes whose namespace field (+0x18) points at it. Passive
/// read only. Used to discover sibling classes of a known one (e.g. the dungeon result-dialog
/// sibling of BattleFinishAllianceBossDialogContext). A class struct persists for the process
/// lifetime once any instance has existed, so the target screen need not be open at run time —
/// only at least once this session.
///
/// Usage:  RslBattleReader.exe --nsclasses Client.ViewModel.Contextes.BattleFinishDialog
/// </summary>
[SupportedOSPlatform("windows")]
internal static class NsClassLister
{
    private const int Class_Name         = 0x10; // const char*
    private const int Class_Namespace    = 0x18; // const char*
    private const int Class_ElementClass = 0x40; // Il2CppClass* — == self for a plain class

    public static void Run(string ns)
    {
        Process? proc = null;
        foreach (var n in new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" })
        {
            var p = Process.GetProcessesByName(n);
            if (p.Length > 0) { proc = p[0]; break; }
        }
        if (proc is null) { Console.WriteLine("[nsclasses] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[nsclasses] could not open process (run as admin)."); return; }

        // 1. Find the namespace string address(es).
        var needle = System.Text.Encoding.ASCII.GetBytes(ns + "\0");
        var nsAddrs = new HashSet<long>();
        foreach (var a in ScanBytes(mem, needle)) nsAddrs.Add((long)a);
        if (nsAddrs.Count == 0) { Console.WriteLine($"[nsclasses] namespace string \"{ns}\" not found in memory."); return; }
        Console.WriteLine($"[nsclasses] namespace string found at {nsAddrs.Count} address(es); scanning for classes…");

        // 2. Find 8-aligned qwords == an ns address, sitting at class + 0x18; validate + read name.
        const int chunk = 0x100000;
        var buf = new byte[chunk];
        var names = new SortedSet<string>();
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
        {
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk, size - off);
                var rb = toRead == chunk ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                for (int i = 0; i + 8 <= toRead; i += 8)
                {
                    if (!nsAddrs.Contains(BitConverter.ToInt64(rb, i))) continue;
                    var cls = baseAddr + (nint)(off + i) - Class_Namespace; // this qword is class + 0x18
                    if (!ProcessMemory.IsValidPointer(cls) || !mem.IsReadable(cls)) continue;
                    if (mem.ReadPointer(cls + Class_ElementClass) != cls) continue; // plain-class signal
                    var name = mem.ReadCString(mem.ReadPointer(cls + Class_Name));
                    if (!string.IsNullOrEmpty(name)) names.Add($"{name}");
                }
            }
        }
        Console.WriteLine($"[nsclasses] {names.Count} class(es) in {ns}:");
        foreach (var n in names) Console.WriteLine($"  {n}");
    }

    private static IEnumerable<nint> ScanBytes(ProcessMemory mem, byte[] needle)
    {
        const int chunk = 0x100000;
        int overlap = needle.Length - 1;
        var buf = new byte[chunk + overlap];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
        {
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk + overlap, size - off);
                var rb = toRead == buf.Length ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                int last = toRead - needle.Length;
                for (int i = 0; i <= last; i++)
                {
                    if (i >= chunk) break;
                    bool ok = true;
                    for (int k = 0; k < needle.Length; k++) if (rb[i + k] != needle[k]) { ok = false; break; }
                    if (ok) yield return baseAddr + (nint)(off + i);
                }
            }
        }
    }
}
