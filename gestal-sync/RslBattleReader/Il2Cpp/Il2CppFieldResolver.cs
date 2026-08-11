using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Memory;

namespace RslBattleReader.Il2Cpp;

/// <summary>
/// DURABLE field-offset resolution: reads a field's byte offset from the game's own
/// live Il2CppClass metadata BY FIELD NAME, instead of hardcoding offsets that shift
/// every patch. Class names and field names are stable across patches (only numeric
/// offsets move), so an offset resolved this way survives updates with no re-dump.
///
/// This is the signature-scan reader's core: pair it with <see cref="Il2CppClassResolver"/>
/// (class-by-name) to navigate the object graph entirely by stable names.
///
/// Il2CppClass in-memory layout (Unity 2021 / il2cpp-v27+, 64-bit) — anchored by the four
/// offsets already confirmed live in this project (element_class@0x40, declaringType@0x50,
/// parent@0x58, static_fields@0xB8), which pin the standard struct and therefore fields@0x80:
///   +0x80  FieldInfo* fields;   // array of the fields DECLARED in this class
/// FieldInfo (stride 0x20): name*(0x00) type*(0x08) parent*(0x10) int32 offset(0x18) token(0x1C).
/// `offset` is the field's absolute byte offset from the object base (klass @ 0). We walk the
/// array until FieldInfo.parent stops pointing back at the class — no field_count needed.
///
/// Passive read only; no injection.
/// </summary>
[SupportedOSPlatform("windows")]
internal static class Il2CppFieldResolver
{
    private const int Class_Fields = 0x80; // FieldInfo* fields
    private const int FieldInfo_Stride = 0x20;
    private const int FI_Name   = 0x00; // const char*
    private const int FI_Parent = 0x10; // Il2CppClass*
    private const int FI_Offset = 0x18; // int32 (absolute offset within instance)

    // (classPtr, fieldName) -> offset. Offsets are stable for the process lifetime.
    private static readonly ConcurrentDictionary<(long, string), int> _cache = new();

    public readonly record struct FieldEntry(string Name, int Offset);

    /// <summary>
    /// Enumerate the fields declared on <paramref name="classPtr"/> as (name, offset),
    /// read live from Il2CppClass.fields. Stops when the FieldInfo.parent back-pointer no
    /// longer equals the class (end of this class's declared-field run) or a name fails to
    /// read. <paramref name="cap"/> guards against a mislocated array.
    /// </summary>
    public static IReadOnlyList<FieldEntry> ReadFields(ProcessMemory mem, nint classPtr, int cap = 256)
    {
        var list = new List<FieldEntry>();
        if (!ProcessMemory.IsValidPointer(classPtr) || !mem.IsReadable(classPtr)) return list;

        var fields = mem.ReadPointer(classPtr + Class_Fields);
        if (!ProcessMemory.IsValidPointer(fields) || !mem.IsReadable(fields)) return list;

        for (int i = 0; i < cap; i++)
        {
            var fi = fields + i * FieldInfo_Stride;
            if (!mem.IsReadable(fi)) break;
            var parent = mem.ReadPointer(fi + FI_Parent);
            if (parent != classPtr) break; // past this class's declared fields
            var name = mem.ReadCString(mem.ReadPointer(fi + FI_Name));
            if (string.IsNullOrEmpty(name)) break;
            list.Add(new FieldEntry(name, mem.ReadInt32(fi + FI_Offset)));
        }
        return list;
    }

    /// <summary>
    /// Offset of <paramref name="fieldName"/> declared on <paramref name="classPtr"/>, or -1
    /// if not found. Cached per (class, field).
    /// </summary>
    public static int OffsetOf(ProcessMemory mem, nint classPtr, string fieldName)
    {
        var key = ((long)classPtr, fieldName);
        if (_cache.TryGetValue(key, out var cached)) return cached;
        foreach (var f in ReadFields(mem, classPtr))
            if (f.Name == fieldName)
                return _cache[key] = f.Offset;
        return -1;
    }

    /// <summary>
    /// Diagnostic: resolve a class by name (namespace-independent) and print every declared
    /// field with its offset. Used to calibrate the field-table layout against live memory
    /// and (separately) against Gestal's offsets_cache.json.
    /// </summary>
    public static void DumpFields(ProcessMemory mem, string className)
    {
        var cls = Il2CppClassResolver.ResolveByNameAny(mem, className, out var ns);
        if (cls == nint.Zero)
        {
            Console.WriteLine($"[fields] class '{className}' not found in memory " +
                              "(open the relevant screen so the game initializes it).");
            return;
        }
        Console.WriteLine($"[fields] {ns}.{className} class = 0x{cls:X}  (fields ptr @ +0x{Class_Fields:X})");
        var fields = ReadFields(mem, cls);
        if (fields.Count == 0)
        {
            Console.WriteLine("[fields] no fields read — fields-ptr offset may be wrong for this build; " +
                              "probing candidate class offsets 0x70–0x90…");
            ProbeFieldsOffset(mem, cls);
            return;
        }
        foreach (var f in fields)
            Console.WriteLine($"    +0x{f.Offset:X3} ({f.Offset,4})  {f.Name}");
        Console.WriteLine($"[fields] {fields.Count} declared field(s).");
    }

    /// <summary>
    /// Entry point for the --fields diagnostic. Opens the running Raid client and dumps the
    /// declared fields (name + offset) of each requested class. Usage: --fields Artifact,Hero,...
    /// </summary>
    public static void Run(string classesCsv)
    {
        var proc = new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" }
            .SelectMany(Process.GetProcessesByName).FirstOrDefault();
        if (proc is null) { Console.WriteLine("[fields] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[fields] could not open process (run as admin)."); return; }
        if (mem.FindModuleBase("GameAssembly.dll") == nint.Zero)
        { Console.WriteLine("[fields] GameAssembly.dll not found."); return; }

        foreach (var name in classesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            DumpFields(mem, name);
            Console.WriteLine();
        }
    }

    // Fallback calibration: if fields aren't at 0x80, find the class offset whose pointer leads
    // to a FieldInfo array (entry[0].parent == class, entry[0].name reads as a string).
    private static void ProbeFieldsOffset(ProcessMemory mem, nint cls)
    {
        for (int co = 0x70; co <= 0x90; co += 8)
        {
            var arr = mem.ReadPointer(cls + co);
            if (!ProcessMemory.IsValidPointer(arr) || !mem.IsReadable(arr)) continue;
            if (mem.ReadPointer(arr + FI_Parent) != cls) continue;
            var name = mem.ReadCString(mem.ReadPointer(arr + FI_Name));
            if (string.IsNullOrEmpty(name)) continue;
            Console.WriteLine($"    candidate fields ptr @ class+0x{co:X}: entry0 name='{name}' " +
                              $"offset=0x{mem.ReadInt32(arr + FI_Offset):X}");
        }
    }
}
