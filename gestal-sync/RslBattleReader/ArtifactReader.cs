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
    // game ArtifactKindId -> Gestal slotId (Weapon 5->0, Shield 6->2, Ring 7->6, …)
    private static readonly Dictionary<int, int> SlotMap = new()
    { [1] = 1, [2] = 4, [3] = 3, [4] = 5, [5] = 0, [6] = 2, [7] = 6, [8] = 7, [9] = 8 };

    // game StatKindId + isAbsolute -> Gestal statId (the scheme sync.js/import expects).
    // game kinds: HP=1 ATK=2 DEF=3 SPD=4 RES=5 ACC=6 CRATE=7 CDMG=8. Percent variants map to the
    // Gestal percent ids; flat-only and percent-only stats ignore the flag.
    private static int GestalStatId(int gameKind, bool isAbsolute) => gameKind switch
    {
        1 => isAbsolute ? 1 : 4,   // HP / HP%
        2 => isAbsolute ? 3 : 6,   // ATK / ATK%
        3 => isAbsolute ? 2 : 5,   // DEF / DEF%
        4 => isAbsolute ? 7 : 13,  // SPD / SPD%
        5 => 11,                   // RES (flat)
        6 => 10,                   // ACC (flat)
        7 => 8,                    // C.RATE (%)
        8 => 9,                    // C.DMG (%)
        _ => -1,
    };

    public sealed record BonusOut(int statId, int value);
    public sealed record ArtifactOut(
        int id, int slotId, int? gearSetId, int rarityId, int rank, int level, int ascensionLevel,
        int mainStatId, int mainStatValue, List<BonusOut> substats, int? equippedOnHeroId);

    public static void Run()
    {
        var proc = FindRaid();
        if (proc is null) { Console.WriteLine("[gear] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[gear] could not open process (run as admin)."); return; }
        var moduleBase = mem.FindModuleBase("GameAssembly.dll");
        if (moduleBase == nint.Zero) { Console.WriteLine("[gear] GameAssembly.dll not found."); return; }

        // Resolve every class by NAME and every field by NAME (durable across patches).
        var uad = ResolveUserArtifactData(mem, moduleBase, out var uadClass);
        if (uad == nint.Zero) { Console.WriteLine("[gear] UserArtifactData not resolved — open the game to the account, then retry."); return; }
        var hadClass  = Il2CppClassResolver.ResolveByNameAny(mem, "HeroArtifactData", out _);
        var artClass  = Il2CppClassResolver.ResolveByNameAny(mem, "Artifact", out _);
        var abClass   = Il2CppClassResolver.ResolveByNameAny(mem, "ArtifactBonus", out _);
        var bvClass   = Il2CppClassResolver.ResolveByNameAny(mem, "BonusValue", out _);

        int oArtifacts = Il2CppFieldResolver.OffsetOf(mem, uadClass, "Artifacts");
        int oByHero    = Il2CppFieldResolver.OffsetOf(mem, uadClass, "ArtifactDataByHeroId");
        int oByKind    = Il2CppFieldResolver.OffsetOf(mem, hadClass, "ArtifactIdByKind");
        int oId        = Il2CppFieldResolver.OffsetOf(mem, artClass, "_id");
        int oKind      = Il2CppFieldResolver.OffsetOf(mem, artClass, "_kindId");
        int oRank      = Il2CppFieldResolver.OffsetOf(mem, artClass, "_rankId");
        int oRarity    = Il2CppFieldResolver.OffsetOf(mem, artClass, "_rarityId");
        int oSet       = Il2CppFieldResolver.OffsetOf(mem, artClass, "_setKindId");
        int oLevel     = Il2CppFieldResolver.OffsetOf(mem, artClass, "_level");
        int oAscend    = Il2CppFieldResolver.OffsetOf(mem, artClass, "_ascendLevel"); // Nullable<int>
        int oPrimary   = Il2CppFieldResolver.OffsetOf(mem, artClass, "_primaryBonus");
        int oSecondary = Il2CppFieldResolver.OffsetOf(mem, artClass, "_secondaryBonuses");
        int oBonKind   = Il2CppFieldResolver.OffsetOf(mem, abClass, "_kindId");
        int oBonVal    = Il2CppFieldResolver.OffsetOf(mem, abClass, "_value");
        int oBvAbs     = Il2CppFieldResolver.OffsetOf(mem, bvClass, "_isAbsolute");
        int oBvVal     = Il2CppFieldResolver.OffsetOf(mem, bvClass, "_value");
        if (new[] { oArtifacts, oByHero, oByKind, oId, oKind, oRank, oRarity, oSet, oLevel, oAscend, oPrimary, oSecondary, oBonKind, oBonVal, oBvAbs, oBvVal }.Any(o => o < 0))
        { Console.WriteLine("[gear] a field offset failed to resolve — a class/field name may have changed."); return; }

        // Decode one ArtifactBonus -> (gestalStatId, value). Fixed int64 @ BonusValue._value / 2^32:
        // flat -> integer; percent -> integer-percent (×100). Returns null on a missing bonus.
        BonusOut? Decode(nint bonusPtr)
        {
            if (!ProcessMemory.IsValidPointer(bonusPtr)) return null;
            int gameKind = mem.ReadInt32(bonusPtr + oBonKind);
            var valObj = mem.ReadPointer(bonusPtr + oBonVal);
            if (!ProcessMemory.IsValidPointer(valObj)) return null;
            bool isAbs = mem.ReadBool(valObj + oBvAbs);
            double raw = mem.ReadInt64(valObj + oBvVal) / 4294967296.0; // /2^32
            int statId = GestalStatId(gameKind, isAbs);
            int value = (int)Math.Round(isAbs ? raw : raw * 100.0);
            return new BonusOut(statId, value);
        }

        // Equipped map: artifactId -> heroId, from ArtifactDataByHeroId (Dict<int,HeroArtifactData>)
        // -> each HeroArtifactData.ArtifactIdByKind (Dict<int kind,int artifactId>).
        var equippedByArt = new Dictionary<int, int>();
        {
            var byHero = mem.ReadPointer(uad + oByHero);
            var entries = mem.ReadPointer(byHero + Dict_Entries);
            long cap = mem.ReadInt64(entries + Array_MaxLength);
            for (long e = 0; e < cap; e++)
            {
                var entry = entries + Array_DataOffset + (nint)(e * 24);
                if (mem.ReadInt32(entry) < 0) continue;
                var had = mem.ReadPointer(entry + 16);
                if (!ProcessMemory.IsValidPointer(had) || mem.ReadPointer(had) != hadClass) continue;
                int heroId = mem.ReadInt32(entry + 8);
                var byKind = mem.ReadPointer(had + oByKind);
                var kEnt = mem.ReadPointer(byKind + Dict_Entries);
                long kcap = mem.ReadInt64(kEnt + Array_MaxLength);
                for (long k = 0; k < kcap; k++)
                {
                    var eb = kEnt + Array_DataOffset + (nint)(k * 16);
                    if (mem.ReadInt32(eb) < 0) continue;
                    int artId = mem.ReadInt32(eb + 12);
                    if (artId > 0) equippedByArt[artId] = heroId;
                }
            }
        }

        // Owned artifacts: the inline Artifacts list is empty once the account migrates gear to
        // external storage, so heap-scan every Artifact object (klass == artClass) — the proven,
        // storage-agnostic owned-set source — dedup by id. Decode scalars + bonuses, stamp equipped.
        long artClassL = (long)artClass;
        var byId = new Dictionary<int, ArtifactOut>();
        const int chunk = 0x100000; var buf = new byte[chunk];
        foreach (var (baseAddr, regionSize) in mem.EnumerateReadableRegions())
        {
            for (long off = 0; off < regionSize; off += chunk)
            {
                int toRead = (int)Math.Min(chunk, regionSize - off);
                var rb = toRead == chunk ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                for (int i = 0; i + 8 <= toRead; i += 8)
                {
                    if (BitConverter.ToInt64(rb, i) != artClassL) continue;
                    var obj = baseAddr + (nint)(off + i);
                    int id = mem.ReadInt32(obj + oId);
                    if (id <= 0 || id > 2_000_000_000) continue;
                    int slotKind = mem.ReadInt32(obj + oKind);
                    if (slotKind is < 1 or > 9) continue;              // valid ArtifactKindId
                    int rarity = mem.ReadInt32(obj + oRarity);
                    if (rarity is < 1 or > 6) continue;
                    int level = mem.ReadInt32(obj + oLevel);
                    if (level is < 0 or > 16) continue;
                    int set = mem.ReadInt32(obj + oSet);
                    var (asc, hasAsc) = mem.ReadNullableInt(obj, oAscend);

                    var main = Decode(mem.ReadPointer(obj + oPrimary));
                    var subs = new List<BonusOut>();
                    var secList = mem.ReadPointer(obj + oSecondary);
                    if (ProcessMemory.IsValidPointer(secList))
                    {
                        var arr = mem.ReadPointer(secList + List_BackingArray);
                        int sz = mem.ReadInt32(secList + List_Size);
                        for (int e = 0; e < sz && e < 8; e++)
                        {
                            var d = Decode(mem.ReadPointer(arr + Array_DataOffset + e * Array_ElementSize));
                            if (d is not null) subs.Add(d);
                        }
                    }
                    byId[id] = new ArtifactOut(
                        id,
                        SlotMap.TryGetValue(slotKind, out var s) ? s : -1,
                        set == 0 ? null : set,
                        rarity,
                        mem.ReadInt32(obj + oRank),
                        level,
                        hasAsc ? asc : 0,
                        main?.statId ?? 0, main?.value ?? 0,
                        subs,
                        equippedByArt.TryGetValue(id, out var h) ? h : null);
                }
            }
        }
        var arts = byId.Values.ToList();
        Console.WriteLine($"[gear] uad=0x{uad:X} equippedMap={equippedByArt.Count} heap-scanned artifacts={arts.Count}");

        int equipped = arts.Count(a => a.equippedOnHeroId != null);
        Console.WriteLine($"[gear] {arts.Count} owned artifacts; {equipped} equipped on {arts.Where(a => a.equippedOnHeroId != null).Select(a => a.equippedOnHeroId).Distinct().Count()} heroes.");

        var outPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "output", "artifacts-memory.json"));
        Directory.CreateDirectory(Path.GetDirectoryName(outPath)!);
        File.WriteAllText(outPath, System.Text.Json.JsonSerializer.Serialize(arts, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"[gear] wrote {outPath}");
    }

    // Lightweight completeness probe: total equipped pieces currently in memory. 0 = the inventory /
    // artifact data isn't loaded (the equipped map is empty). Used by the watch-and-capture loop.
    public static int EquippedCount(ProcessMemory mem, nint moduleBase)
    {
        var uad = ResolveUserArtifactData(mem, moduleBase, out _);
        if (uad == nint.Zero) return -1;
        var uadClass = Il2CppClassResolver.ResolveByNameAny(mem, "UserArtifactData", out _);
        var hadClass = Il2CppClassResolver.ResolveByNameAny(mem, "HeroArtifactData", out _);
        int oByHero = Il2CppFieldResolver.OffsetOf(mem, uadClass, "ArtifactDataByHeroId");
        int oByKind = Il2CppFieldResolver.OffsetOf(mem, hadClass, "ArtifactIdByKind");
        if (oByHero < 0 || oByKind < 0) return -1;
        var byHero = mem.ReadPointer(uad + oByHero);
        if (!ProcessMemory.IsValidPointer(byHero)) return -1;
        var entries = mem.ReadPointer(byHero + Dict_Entries);
        if (!ProcessMemory.IsValidPointer(entries)) return -1;
        long cap = mem.ReadInt64(entries + Array_MaxLength);
        if (cap < 0 || cap > 100_000) return -1;
        int total = 0;
        for (long e = 0; e < cap; e++)
        {
            var entry = entries + Array_DataOffset + (nint)(e * 24);
            if (mem.ReadInt32(entry) < 0) continue;
            var had = mem.ReadPointer(entry + 16);
            if (!ProcessMemory.IsValidPointer(had) || mem.ReadPointer(had) != hadClass) continue;
            var byKind = mem.ReadPointer(had + oByKind);
            var kEnt = mem.ReadPointer(byKind + Dict_Entries);
            if (!ProcessMemory.IsValidPointer(kEnt)) continue;
            long kcap = mem.ReadInt64(kEnt + Array_MaxLength);
            for (long k = 0; k < kcap && k < 20; k++)
            {
                var eb = kEnt + Array_DataOffset + (nint)(k * 16);
                if (mem.ReadInt32(eb) < 0) continue;
                if (mem.ReadInt32(eb + 12) > 0) total++;
            }
        }
        return total;
    }

    // Navigate AppModel._userWrapper -> UserWrapper.Artifacts (EquipmentWrapper) -> the object that
    // IS-A UserArtifactData (its live class is the derived UpdatableArtifactData). Returns the object
    // pointer; outputs the UserArtifactData BASE class (source of the inherited field offsets).
    internal static nint ResolveUserArtifactData(ProcessMemory mem, nint moduleBase, out nint uadBaseClass)
    {
        uadBaseClass = Il2CppClassResolver.ResolveByNameAny(mem, "UserArtifactData", out _);
        var nav = new Il2CppNavigator(mem, moduleBase);
        var appModel = nav.ResolveAppModelInstance();
        if (appModel == nint.Zero || uadBaseClass == nint.Zero) return nint.Zero;
        var appClass = Il2CppClassResolver.ResolveByNameAny(mem, "AppModel", out _);
        var uwClass  = Il2CppClassResolver.ResolveByNameAny(mem, "UserWrapper", out _);
        int oUW  = Il2CppFieldResolver.OffsetOf(mem, appClass, "_userWrapper");
        int oArt = Il2CppFieldResolver.OffsetOf(mem, uwClass, "Artifacts");
        if (oUW < 0 || oArt < 0) return nint.Zero;
        var artW = mem.ReadPointer(mem.ReadPointer(appModel + oUW) + oArt);

        bool IsA(nint obj, string target)
        {
            if (!ProcessMemory.IsValidPointer(obj) || !mem.IsReadable(obj)) return false;
            var k = mem.ReadPointer(obj);
            for (int hop = 0; hop < 8 && ProcessMemory.IsValidPointer(k) && mem.IsReadable(k); hop++)
            {
                if (mem.ReadCString(mem.ReadPointer(k + 0x10)) == target) return true;
                k = mem.ReadPointer(k + 0x58); // Il2CppClass.parent
            }
            return false;
        }
        return FindByClass(mem, artW, "UserArtifactData", IsA, depth: 3);
    }

    // BFS an object's pointer slots (0x10..0x100) for a descendant satisfying isA(child, target).
    private static nint FindByClass(ProcessMemory mem, nint root, string target, Func<nint, string, bool> isA, int depth)
    {
        var seen = new HashSet<nint>();
        var frontier = new List<nint> { root };
        for (int d = 0; d <= depth; d++)
        {
            var next = new List<nint>();
            foreach (var obj in frontier)
            {
                for (int o = 0x10; o <= 0x100; o += 8)
                {
                    var child = mem.ReadPointer(obj + o);
                    if (!ProcessMemory.IsValidPointer(child) || !seen.Add(child)) continue;
                    if (isA(child, target)) return child;
                    next.Add(child);
                }
            }
            frontier = next;
        }
        return nint.Zero;
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

    // Probe: locate the single UserArtifactData instance and confirm the container layouts
    // for the equipped linkage (ArtifactDataByHeroId : Dict<int,HeroArtifactData>; each
    // HeroArtifactData.ArtifactIdByKind : Dict<int kind,int artifactId>). Dynamic offsets.
    public static void DebugUserArtifactData()
    {
        var proc = FindRaid(); if (proc is null) { Console.WriteLine("[artdata] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id); if (mem is null) return;
        var moduleBase = mem.FindModuleBase("GameAssembly.dll");
        if (moduleBase == nint.Zero) { Console.WriteLine("[artdata] no GameAssembly."); return; }

        string ClassName(nint obj)
        {
            if (!ProcessMemory.IsValidPointer(obj) || !mem.IsReadable(obj)) return "-";
            var k = mem.ReadPointer(obj);
            if (!ProcessMemory.IsValidPointer(k) || !mem.IsReadable(k)) return "?";
            return mem.ReadCString(mem.ReadPointer(k + 0x10)) ?? "?";
        }

        // Canonical path: AppModel._userWrapper -> UserWrapper.Artifacts -> ... -> UserArtifactData.
        var nav = new Il2CppNavigator(mem, moduleBase);
        var appModel = nav.ResolveAppModelInstance();
        if (appModel == nint.Zero) { Console.WriteLine("[artdata] AppModel not resolved."); return; }

        var appClass = Il2CppClassResolver.ResolveByNameAny(mem, "AppModel", out _);
        var uwClass  = Il2CppClassResolver.ResolveByNameAny(mem, "UserWrapper", out _);
        int offUW  = Il2CppFieldResolver.OffsetOf(mem, appClass, "_userWrapper");
        int offArt = Il2CppFieldResolver.OffsetOf(mem, uwClass, "Artifacts");
        var uw   = mem.ReadPointer(appModel + offUW);
        var artW = mem.ReadPointer(uw + offArt);
        Console.WriteLine($"[artdata] AppModel=0x{appModel:X} _userWrapper@{offUW}=0x{uw:X} ({ClassName(uw)})");
        Console.WriteLine($"[artdata] UserWrapper.Artifacts@{offArt}=0x{artW:X} ({ClassName(artW)})");

        // The Artifacts slot is a generic guard/wrapper (no walkable field table). Find the
        // UserArtifactData child durably by scanning the wrapper's pointer slots for one whose
        // klass name == "UserArtifactData" (keys on the stable class name, not a fixed offset).
        // Durable child search: BFS the wrapper's pointer slots for the object that IS-A
        // "UserArtifactData" (the live object's class is the derived UpdatableArtifactData, whose
        // base is UserArtifactData — so we match on the klass->parent inheritance chain, not the
        // exact derived name, and never on a fixed offset).
        bool IsA(nint obj, string target)
        {
            if (!ProcessMemory.IsValidPointer(obj) || !mem.IsReadable(obj)) return false;
            var k = mem.ReadPointer(obj);
            for (int hop = 0; hop < 8 && ProcessMemory.IsValidPointer(k) && mem.IsReadable(k); hop++)
            {
                if (mem.ReadCString(mem.ReadPointer(k + 0x10)) == target) return true;
                k = mem.ReadPointer(k + 0x58); // Il2CppClass.parent
            }
            return false;
        }
        nint uad = FindByClass(mem, artW, "UserArtifactData", IsA, depth: 3);
        if (uad == nint.Zero) { Console.WriteLine("[artdata] UserArtifactData not found under EquipmentWrapper."); return; }
        Console.WriteLine($"[artdata] UserArtifactData = 0x{uad:X}");

        // Field offsets come from the UserArtifactData BASE class (the live object's class is the
        // derived UpdatableArtifactData, which does not re-declare the inherited fields).
        var uadClass = Il2CppClassResolver.ResolveByNameAny(mem, "UserArtifactData", out _);
        var hadClass = Il2CppClassResolver.ResolveByNameAny(mem, "HeroArtifactData", out _);
        int offByHero = Il2CppFieldResolver.OffsetOf(mem, uadClass, "ArtifactDataByHeroId");
        int offByKind = Il2CppFieldResolver.OffsetOf(mem, hadClass, "ArtifactIdByKind");
        var byHero = mem.ReadPointer(uad + offByHero);
        int count = mem.ReadInt32(byHero + Dict_Count);
        var entriesArr = mem.ReadPointer(byHero + Dict_Entries);
        long capacity = mem.ReadInt64(entriesArr + Array_MaxLength);
        Console.WriteLine($"[artdata] ArtifactDataByHeroId@{offByHero} dict=0x{byHero:X} ({ClassName(byHero)}) count={count} entries=0x{entriesArr:X} cap={capacity}");

        // Decode Dictionary<int, HeroArtifactData>: Entry{ i32 hash; i32 next; i32 key; i32 pad; ptr value } = 24B.
        int equippedHeroes = 0, pieces = 0, shown = 0;
        for (long e = 0; e < capacity; e++)
        {
            var entry = entriesArr + Array_DataOffset + (nint)(e * 24);
            int hash = mem.ReadInt32(entry);
            if (hash < 0) continue;
            var valPtr = mem.ReadPointer(entry + 16);
            if (ClassName(valPtr) != "HeroArtifactData") continue;
            int heroId = mem.ReadInt32(entry + 8);

            var byKind = mem.ReadPointer(valPtr + offByKind);
            var kEntries = mem.ReadPointer(byKind + Dict_Entries);
            long kcap = mem.ReadInt64(kEntries + Array_MaxLength);
            var pairs = new List<string>();
            for (long k = 0; k < kcap; k++)
            {
                var eb = kEntries + Array_DataOffset + (nint)(k * 16); // Dict<int,int> entry = 16B
                if (mem.ReadInt32(eb) < 0) continue;
                int kind = mem.ReadInt32(eb + 8), artId = mem.ReadInt32(eb + 12);
                if (kind is >= 1 and <= 9 && artId > 0) { pairs.Add($"{kind}:{artId}"); pieces++; }
            }
            if (pairs.Count > 0) { equippedHeroes++; if (shown++ < 8) Console.WriteLine($"    hero {heroId}: {{{string.Join(" ", pairs)}}}"); }
        }
        Console.WriteLine($"[artdata] {equippedHeroes} heroes with equipped gear; {pieces} equipped pieces total.");
    }
}
