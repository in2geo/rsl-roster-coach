using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Memory;

namespace RslBattleReader;

/// <summary>
/// Reads an IL2CPP object at a given address: its class name/namespace (obj→klass→name)
/// and a field dump where every pointer slot is annotated with the class of the object it
/// points at. Used to identify the per-hero result view-model that holds the damage value,
/// so a stable class-named path can replace the runtime address a --scan reports.
///
/// Usage:  RslBattleReader.exe --inspect &lt;hexAddr&gt; [slotCount=32]
/// PASSIVE READ ONLY.
/// </summary>
[SupportedOSPlatform("windows")]
internal static class ObjectInspector
{
    private const int Class_Name          = 0x10; // const char* within Il2CppClass
    private const int Class_Namespace     = 0x18;
    private const int Class_ElementClass  = 0x40; // == self for a plain class (structural signal)

    public static void Run(long addr, int slots)
    {
        var proc = FindRaid();
        if (proc is null) { Console.WriteLine("[inspect] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[inspect] could not open process (run as admin)."); return; }

        Console.WriteLine($"[inspect] object @0x{addr:X}  class = {ClassNameOf(mem, (nint)addr) ?? "(unresolved)"}");
        Console.WriteLine($"[inspect] {slots} slots:");
        for (int i = 0; i < slots; i++)
        {
            int o = i * 8;
            long q = mem.ReadInt64((nint)(addr + o));
            int lo = mem.ReadInt32((nint)(addr + o));
            int hi = mem.ReadInt32((nint)(addr + o + 4));
            string ann = "";
            if (ProcessMemory.IsValidPointer((nint)q))
            {
                var cn = ClassNameOf(mem, (nint)q);
                ann = cn != null ? $"  → {cn}" : "  <ptr>";
            }
            Console.WriteLine($"    +0x{o:X3}: 0x{q:X16}  int32=({lo,12}, {hi,6}){ann}");
        }
        proc.Dispose();
    }

    /// <summary>"Namespace.Name" of the IL2CPP object at <paramref name="objPtr"/>, or null
    /// if it doesn't look like a live managed object (klass→element_class must equal klass).</summary>
    internal static string? ClassNameOf(ProcessMemory mem, nint objPtr)
    {
        if (!ProcessMemory.IsValidPointer(objPtr) || !mem.IsReadable(objPtr)) return null;
        var klass = mem.ReadPointer(objPtr);
        if (!ProcessMemory.IsValidPointer(klass) || !mem.IsReadable(klass)) return null;
        if (mem.ReadPointer(klass + Class_ElementClass) != klass) return null; // structural sanity
        var name = mem.ReadCString(mem.ReadPointer(klass + Class_Name));
        if (string.IsNullOrEmpty(name)) return null;
        var ns = mem.ReadCString(mem.ReadPointer(klass + Class_Namespace));
        return string.IsNullOrEmpty(ns) ? name : $"{ns}.{name}";
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
