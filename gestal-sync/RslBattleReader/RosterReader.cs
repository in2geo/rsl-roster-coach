using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Il2Cpp;
using RslBattleReader.Memory;
using static RslBattleReader.Il2Cpp.Il2CppOffsets;

namespace RslBattleReader;

/// <summary>
/// Option B — direct game-memory roster reader (champions). Resolves the Hero
/// Il2CppClass via its TypeInfo RVA (same mechanism the battle reader uses for
/// AppModel), then signature-scans the heap for Hero objects (klass pointer ==
/// that class), reading each owned Hero's fields. Dedups by Id. Passive read only —
/// same technique as the battle reader, no injection.
///
/// We scan Hero objects directly rather than navigating UserHeroData.HeroById: the
/// Hero class resolves cleanly (167 heap hits for a loaded roster) and this sidesteps
/// both the generic UserGuard&lt;UserWrapper&gt; static and the bad UserHeroData RVA.
/// Caveat: a champions-screen-loaded account holds its owned heroes as Hero objects;
/// validate the result vs the Gestal export to confirm the count matches (and that no
/// non-owned Hero objects — previews/enemies — leak in).
/// </summary>
[SupportedOSPlatform("windows")]
internal static class RosterReader
{
    public record OwnedHero(int Id, int TypeId, int Grade, int Level, int EmpowerLevel, bool InStorage);

    public static void Run()
    {
        var proc = FindRaid();
        if (proc is null) { Console.WriteLine("[roster] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[roster] could not open process (run as admin)."); return; }

        var moduleBase = mem.FindModuleBase("GameAssembly.dll");
        if (moduleBase == nint.Zero) { Console.WriteLine("[roster] GameAssembly.dll not found in process."); return; }

        var heroClass = Il2CppClassResolver.Resolve(
            mem, moduleBase, Hero_TypeInfo_RVA, "Hero", "SharedModel.Meta.Heroes", verbose: true);
        if (heroClass == nint.Zero)
        {
            Console.WriteLine("[roster] Hero class not present in memory — open the Champion " +
                              "Collection so the game initializes it, then retry.");
            return;
        }
        Console.WriteLine($"[roster] Hero class = 0x{heroClass:X}; scanning heap for Hero objects…");

        var heroes = ScanHeroes(mem, (long)heroClass);
        if (heroes.Count == 0) { Console.WriteLine("[roster] no Hero objects found — is the account at the Champions screen?"); return; }

        int active = heroes.Count(h => !h.InStorage);
        Console.WriteLine($"[roster] {heroes.Count} heroes ({active} active, {heroes.Count - active} in storage):\n");
        Console.WriteLine($"  {"id",-10}{"typeId",-10}{"stars",-7}{"level",-7}{"empower",-9}storage");
        foreach (var h in heroes.OrderByDescending(h => h.Grade).ThenByDescending(h => h.Level))
            Console.WriteLine($"  {h.Id,-10}{h.TypeId,-10}{h.Grade,-7}{h.Level,-7}{h.EmpowerLevel,-9}{(h.InStorage ? "yes" : "")}");

        // Emit JSON for the validation diff against the Gestal export.
        var outPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "output", "roster-memory.json"));
        Directory.CreateDirectory(Path.GetDirectoryName(outPath)!);
        var shaped = heroes.Select(h => new { heroId = h.Id, typeId = h.TypeId, stars = h.Grade, level = h.Level, empowerLevel = h.EmpowerLevel, inStorage = h.InStorage });
        File.WriteAllText(outPath, System.Text.Json.JsonSerializer.Serialize(shaped, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"\n[roster] wrote {outPath}");
    }

    // Walk readable regions; every 8-aligned slot equal to the Hero class pointer is
    // a Hero object's klass field (offset 0), i.e. an object base. Read + range-check
    // its fields; dedup by Id (the unique inventory hero id).
    private static List<OwnedHero> ScanHeroes(ProcessMemory mem, long heroClass)
    {
        var byId = new Dictionary<int, OwnedHero>();
        const int chunk = 0x100000;
        var buf = new byte[chunk];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
        {
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk, size - off);
                var rb = toRead == chunk ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                for (int i = 0; i + 8 <= toRead; i += 8)
                {
                    if (BitConverter.ToInt64(rb, i) != heroClass) continue;
                    var obj = baseAddr + (nint)(off + i);
                    int id     = mem.ReadInt32(obj + Hero_Id);
                    int typeId = mem.ReadInt32(obj + Hero_TypeId);
                    int grade  = mem.ReadInt32(obj + Hero_Grade);
                    int level  = mem.ReadInt32(obj + Hero_Level);
                    if (id <= 0 || id > 2_000_000_000) continue;
                    if (typeId is <= 0 or > 10_000_000) continue;
                    if (grade is < 1 or > 6) continue;
                    if (level is < 1 or > 60) continue;
                    bool stored = mem.ReadBool(obj + Hero_InStorage) || mem.ReadBool(obj + Hero_InBathhouse);
                    byId[id] = new OwnedHero(id, typeId, grade, level,
                        mem.ReadInt32(obj + Hero_EmpowerLevel), stored);
                }
            }
        }
        return [.. byId.Values];
    }

    // Debug: dump every Hero object matching a heroId, showing the bytes around the
    // storage/flag region so we can locate the real in-storage flag.
    public static void DebugHero(int targetId)
    {
        var proc = FindRaid(); if (proc is null) { Console.WriteLine("[hero] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id); if (mem is null) return;
        var moduleBase = mem.FindModuleBase("GameAssembly.dll");
        var heroClass = (long)Il2CppClassResolver.Resolve(
            mem, moduleBase, Hero_TypeInfo_RVA, "Hero", "SharedModel.Meta.Heroes");
        Console.WriteLine($"[hero] searching Hero objects with Id={targetId}…");
        const int chunk = 0x100000; var buf = new byte[chunk]; int found = 0;
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk, size - off);
                var rb = toRead == chunk ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                for (int i = 0; i + 8 <= toRead; i += 8)
                {
                    if (BitConverter.ToInt64(rb, i) != heroClass) continue;
                    var obj = baseAddr + (nint)(off + i);
                    if (mem.ReadInt32(obj + Hero_Id) != targetId) continue;
                    found++;
                    Console.WriteLine($"  obj=0x{obj:X} typeId={mem.ReadInt32(obj + Hero_TypeId)} grade={mem.ReadInt32(obj + Hero_Grade)} level={mem.ReadInt32(obj + Hero_Level)}");
                    // Find the equipped-gear collection: scan Hero fields for a pointer that reads as a
                    // List<Artifact> (backing array @+0x10, size @+0x18) whose elements' Art_Id look like gear ids.
                    var ob = new byte[0x600]; mem.TryReadBytes(obj, ob);
                    for (int k = 0x38; k + 8 <= 0x600; k += 8)
                    {
                        long p = BitConverter.ToInt64(ob, k);
                        if (p < 0x10000000000L || p > 0x300000000000L) continue;
                        // (a) try as Dictionary<K,Artifact>: count@0x20, entries array@0x18 (data@0x20), 24-byte entries, value ptr @ entry+0x10
                        int dcount = mem.ReadInt32((nint)p + 0x20);
                        if (dcount is >= 4 and <= 12)
                        {
                            var entA = (long)mem.ReadPointer((nint)p + 0x18);
                            if (entA > 0x10000000000L)
                            {
                                var dids = new List<int>();
                                for (int e = 0; e < dcount; e++)
                                {
                                    var vptr = (long)mem.ReadPointer((nint)entA + Array_DataOffset + e * 24 + 0x10);
                                    var key = mem.ReadInt32((nint)entA + Array_DataOffset + e * 24 + 0x08);
                                    if (vptr > 0x10000000000L) dids.Add(mem.ReadInt32((nint)vptr + Art_Id));
                                    else dids.Add(-key);
                                }
                                Console.WriteLine($"    DICT@0x{k:X2}=0x{p:X} count={dcount} valArtIds=[{string.Join(",", dids)}]");
                            }
                        }
                        var arrP = (long)mem.ReadPointer((nint)p + List_BackingArray);
                        int sz = mem.ReadInt32((nint)p + List_Size);
                        if (sz <= 0 || sz > 12 || arrP < 0x10000000000L) continue;
                        // read backing array as int32 elements (List<int> = artifact ids) AND as 8-byte pointers→Art_Id
                        var arrHdr = new byte[Array_DataOffset + sz * 8];
                        mem.TryReadBytes((nint)arrP, arrHdr);
                        var asInts = new List<int>();
                        for (int e = 0; e < sz; e++) asInts.Add(BitConverter.ToInt32(arrHdr, Array_DataOffset + e * 4));
                        var asPtrIds = new List<int>();
                        for (int e = 0; e < sz; e++) { var el = BitConverter.ToInt64(arrHdr, Array_DataOffset + e * 8); if (el > 0x10000000000L) asPtrIds.Add(mem.ReadInt32((nint)el + Art_Id)); }
                        Console.WriteLine($"    ptr@0x{k:X2}=0x{p:X} size={sz} asInt32=[{string.Join(",", asInts)}] asPtr→id=[{string.Join(",", asPtrIds)}]");
                        if (sz == 6)
                        {
                            var el0 = BitConverter.ToInt64(arrHdr, Array_DataOffset);
                            if (el0 > 0x10000000000L)
                            {
                                var eb = new byte[0x40]; mem.TryReadBytes((nint)el0, eb);
                                var es = new System.Text.StringBuilder($"      elem[0]@0x{el0:X} ints: ");
                                for (int j = 0x10; j < 0x40; j += 4) es.Append($"[{j:X2}]{BitConverter.ToInt32(eb, j)} ");
                                Console.WriteLine(es.ToString());
                            }
                        }
                    }
                }
            }
        Console.WriteLine($"[hero] {found} object(s) for Id={targetId}.");
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
