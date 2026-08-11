using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Il2Cpp;
using RslBattleReader.Memory;
using static RslBattleReader.Il2Cpp.Il2CppOffsets;

namespace RslBattleReader;

/// <summary>
/// Option B — direct game-memory gear reader (artifacts). Same signature-scan
/// approach as the champion reader: resolve the Artifact Il2CppClass via its
/// TypeInfo RVA, scan the heap for Artifact objects, read fields, dedup by id.
/// First pass reads the scalar identity/upgrade fields (slot/set/rank/rarity/
/// level/ascend); main stat + substats + equipped-hero are a follow-up pass.
/// Passive read only.
/// </summary>
[SupportedOSPlatform("windows")]
internal static class ArtifactReader
{
    public record Artifact(int Id, int SlotId, int RankId, int RarityId, int GearSetId, int Level, int? AscensionLevel);

    // game ArtifactKindId -> Gestal slotId (Weapon 5->0, Shield 6->2, Ring 7->6, …)
    private static readonly Dictionary<int, int> SlotMap = new()
    { [1] = 1, [2] = 4, [3] = 3, [4] = 5, [5] = 0, [6] = 2, [7] = 6, [8] = 7, [9] = 8 };

    // RE diagnostic: DUMP_ART=<artifactId> dumps that artifact's ArtifactBonus bytes (main + substats) so the
    // statKind/value/isAbsolute layout can be pinned against a known piece (e.g. id 121 = Mikey boots SPD +40).
    private static readonly int DumpId = int.TryParse(Environment.GetEnvironmentVariable("DUMP_ART"), out var d) ? d : -1;

    private static void DumpBonus(ProcessMemory mem, nint addr, string label)
    {
        if (addr == nint.Zero) { Console.WriteLine($"{label}: null"); return; }
        var b = new byte[48];
        if (!mem.TryReadBytes(addr, b)) { Console.WriteLine($"{label} @0x{addr:X}: unreadable"); return; }
        int kind = BitConverter.ToInt32(b, 0x10);
        var ptr18 = mem.ReadPointer(addr + 0x18);
        Console.WriteLine($"{label} @0x{addr:X}: kind@10={kind}  ptr@18=0x{ptr18:X}");
        if (ptr18 != nint.Zero)
        {
            var v = new byte[40];
            if (mem.TryReadBytes(ptr18, v))
            {
                var sb = new System.Text.StringBuilder("        behind ptr@18: ");
                for (int k = 0; k < 40; k += 4) sb.Append($"[{k:X2}]{BitConverter.ToInt32(v, k)}/{BitConverter.ToSingle(v, k):0.##} ");
                Console.WriteLine(sb.ToString());
                Console.WriteLine($"        i64@10={BitConverter.ToInt64(v, 0x10)}  d@10={BitConverter.ToDouble(v, 0x10):0.####}  d@18={BitConverter.ToDouble(v, 0x18):0.####}");
            }
        }
    }

    public static void Run()
    {
        var proc = FindRaid();
        if (proc is null) { Console.WriteLine("[gear] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[gear] could not open process (run as admin)."); return; }

        var moduleBase = mem.FindModuleBase("GameAssembly.dll");
        if (moduleBase == nint.Zero) { Console.WriteLine("[gear] GameAssembly.dll not found."); return; }

        var artClass = (long)Il2CppClassResolver.Resolve(
            mem, moduleBase, Artifact_TypeInfo_RVA, "Artifact", "SharedModel.Meta.Artifacts", verbose: true);
        if (artClass == 0) { Console.WriteLine("[gear] Artifact class not present in memory — open the gear/inventory screen, then retry."); return; }
        Console.WriteLine($"[gear] Artifact class = 0x{artClass:X}; scanning heap…");

        var arts = Scan(mem, artClass);
        if (arts.Count == 0) { Console.WriteLine("[gear] no Artifact objects found."); return; }

        Console.WriteLine($"[gear] {arts.Count} artifacts. By slot:");
        foreach (var g in arts.GroupBy(a => a.SlotId).OrderBy(g => g.Key))
            Console.WriteLine($"    slotId {g.Key}: {g.Count()}");

        var outPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "output", "artifacts-memory.json"));
        Directory.CreateDirectory(Path.GetDirectoryName(outPath)!);
        var shaped = arts.Select(a => new {
            id = a.Id,
            slotId = SlotMap.TryGetValue(a.SlotId, out var s) ? s : -1,
            rankId = a.RankId,
            rarityId = a.RarityId,
            gearSetId = a.GearSetId == 0 ? (int?)null : a.GearSetId, // 0 = no set (accessories)
            level = a.Level,
            ascensionLevel = a.AscensionLevel ?? 0,                  // null = not ascended = 0
        });
        File.WriteAllText(outPath, System.Text.Json.JsonSerializer.Serialize(shaped, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"[gear] wrote {outPath}");
    }

    private static List<Artifact> Scan(ProcessMemory mem, long artClass)
    {
        var byId = new Dictionary<int, Artifact>();
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
                    if (BitConverter.ToInt64(rb, i) != artClass) continue;
                    var obj = baseAddr + (nint)(off + i);
                    int id      = mem.ReadInt32(obj + Art_Id);
                    int slot    = mem.ReadInt32(obj + Art_KindId);
                    int rank    = mem.ReadInt32(obj + Art_RankId);
                    int rarity  = mem.ReadInt32(obj + Art_RarityId);
                    int set     = mem.ReadInt32(obj + Art_SetKindId);
                    int level   = mem.ReadInt32(obj + Art_Level);
                    if (id <= 0 || id > 2_000_000_000) continue;
                    if (slot is < 0 or > 30) continue;
                    if (rank is < 0 or > 10) continue;
                    if (rarity is < 1 or > 8) continue;
                    if (set is < 0 or > 500) continue;
                    if (level is < 0 or > 16) continue;
                    var (asc, hasAsc) = mem.ReadNullableInt(obj, Art_AscendLevel);
                    byId[id] = new Artifact(id, slot, rank, rarity, set, level, hasAsc ? asc : null);

                    if (id == DumpId)
                    {
                        Console.WriteLine($"\n[bonus-RE] artifact {id} @0x{obj:X} (slotKind={slot} set={set} rank={rank} lvl={level})");
                        var ob = new byte[0x90];
                        if (mem.TryReadBytes(obj, ob)) { var s = new System.Text.StringBuilder("  ARTIFACT OBJ ints: "); for (int k = 0x10; k < 0x90; k += 4) s.Append($"[{k:X2}]{BitConverter.ToInt32(ob, k)} "); Console.WriteLine(s.ToString()); }
                        DumpBonus(mem, mem.ReadPointer(obj + Art_PrimaryBonus), "  PRIMARY");
                        var listPtr = mem.ReadPointer(obj + Art_SecondaryBonuses);
                        if (listPtr != nint.Zero)
                        {
                            var arr = mem.ReadPointer(listPtr + List_BackingArray);
                            int sz = mem.ReadInt32(listPtr + List_Size);
                            Console.WriteLine($"  SecondaryBonuses list @0x{listPtr:X} size={sz}");
                            for (int e = 0; e < sz && e < 8; e++)
                                DumpBonus(mem, mem.ReadPointer(arr + Array_DataOffset + e * Array_ElementSize), $"  SUB[{e}]");
                        }
                    }
                }
            }
        }
        return [.. byId.Values];
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
