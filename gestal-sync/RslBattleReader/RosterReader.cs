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
    public record SkillState(int SkillId, int Level, int MaxLevel);
    public record OwnedHero(int Id, int TypeId, int BaseTypeId, int Grade, int Level, int EmpowerLevel, bool InStorage,
        int[] MasteryIds, SkillState[] Skills);

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

        // Champion-parity extras — masteries + skills (booked). All offsets by field NAME.
        var hmdClass   = Il2CppClassResolver.ResolveByNameAny(mem, "HeroMasteryData", out _);
        var skillClass = Il2CppClassResolver.ResolveByNameAny(mem, "Skill", out _);
        var px = new ParityOffsets(
            MasteryData: Il2CppFieldResolver.OffsetOf(mem, heroClass, "MasteryData"),
            Skills:      Il2CppFieldResolver.OffsetOf(mem, heroClass, "Skills"),
            Masteries:   hmdClass   != nint.Zero ? Il2CppFieldResolver.OffsetOf(mem, hmdClass, "Masteries") : -1,
            SkTypeId:    skillClass != nint.Zero ? Il2CppFieldResolver.OffsetOf(mem, skillClass, "TypeId") : -1,
            SkLevel:     skillClass != nint.Zero ? Il2CppFieldResolver.OffsetOf(mem, skillClass, "Level") : -1);
        var skillMax = BuildSkillMaxLevels(mem, moduleBase);
        Console.WriteLine($"[roster] parity: MasteryData@{px.MasteryData} Skills@{px.Skills} Masteries@{px.Masteries} " +
                          $"Skill.TypeId@{px.SkTypeId}/.Level@{px.SkLevel}; skillMax map={skillMax.Count}");

        var heroes = ScanHeroes(mem, (long)heroClass, px, skillMax);
        if (heroes.Count == 0) { Console.WriteLine("[roster] no Hero objects found — is the account at the Champions screen?"); return; }

        int active = heroes.Count(h => !h.InStorage);
        Console.WriteLine($"[roster] {heroes.Count} heroes ({active} active, {heroes.Count - active} in storage):\n");
        Console.WriteLine($"  {"id",-10}{"typeId",-10}{"stars",-7}{"level",-7}{"empower",-9}storage");
        foreach (var h in heroes.OrderByDescending(h => h.Grade).ThenByDescending(h => h.Level))
            Console.WriteLine($"  {h.Id,-10}{h.TypeId,-10}{h.Grade,-7}{h.Level,-7}{h.EmpowerLevel,-9}{(h.InStorage ? "yes" : "")}");

        // Emit JSON for the validation diff against the Gestal export.
        var outPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "output", "roster-memory.json"));
        Directory.CreateDirectory(Path.GetDirectoryName(outPath)!);
        var shaped = heroes.Select(h => new {
            heroId = h.Id, typeId = h.TypeId, baseTypeId = h.BaseTypeId, stars = h.Grade, level = h.Level,
            empowerLevel = h.EmpowerLevel, inStorage = h.InStorage,
            masteryIds = h.MasteryIds,
            skills = h.Skills.Select(s => new { skillId = s.SkillId, level = s.Level, maxLevel = s.MaxLevel }),
        });
        File.WriteAllText(outPath, System.Text.Json.JsonSerializer.Serialize(shaped, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"\n[roster] wrote {outPath}");
    }

    private readonly record struct ParityOffsets(int MasteryData, int Skills, int Masteries, int SkTypeId, int SkLevel);

    // Read a hero's mastery ids (HeroMasteryData.Masteries : List<int>).
    private static int[] ReadMasteries(ProcessMemory mem, nint obj, ParityOffsets px)
    {
        if (px.MasteryData < 0 || px.Masteries < 0) return [];
        var hmd = mem.ReadPointer(obj + px.MasteryData);
        if (!ProcessMemory.IsValidPointer(hmd)) return [];
        var list = mem.ReadPointer(hmd + px.Masteries);
        if (!ProcessMemory.IsValidPointer(list)) return [];
        var arr = mem.ReadPointer(list + List_BackingArray);
        int sz = mem.ReadInt32(list + List_Size);
        if (!ProcessMemory.IsValidPointer(arr) || sz <= 0 || sz > 64) return [];
        var ids = new int[sz];
        for (int e = 0; e < sz; e++) ids[e] = mem.ReadInt32(arr + Array_DataOffset + e * 4);
        return ids;
    }

    // Read a hero's skills (Hero.Skills : List<Skill>); maxLevel from the static skillMax map.
    private static SkillState[] ReadSkills(ProcessMemory mem, nint obj, ParityOffsets px, Dictionary<int, int> skillMax)
    {
        if (px.Skills < 0 || px.SkTypeId < 0 || px.SkLevel < 0) return [];
        var list = mem.ReadPointer(obj + px.Skills);
        if (!ProcessMemory.IsValidPointer(list)) return [];
        var arr = mem.ReadPointer(list + List_BackingArray);
        int sz = mem.ReadInt32(list + List_Size);
        if (!ProcessMemory.IsValidPointer(arr) || sz <= 0 || sz > 12) return [];
        var skills = new List<SkillState>(sz);
        for (int e = 0; e < sz; e++)
        {
            var sk = mem.ReadPointer(arr + Array_DataOffset + e * 8);
            if (!ProcessMemory.IsValidPointer(sk)) continue;
            int tId = mem.ReadInt32(sk + px.SkTypeId);
            int lvl = mem.ReadInt32(sk + px.SkLevel);
            int max = skillMax.TryGetValue(tId, out var m) ? m : 1;
            skills.Add(new SkillState(tId, lvl, max));
        }
        return [.. skills];
    }

    // Walk readable regions; every 8-aligned slot equal to the Hero class pointer is
    // a Hero object's klass field (offset 0), i.e. an object base. Read + range-check
    // its fields; dedup by Id (the unique inventory hero id).
    private static List<OwnedHero> ScanHeroes(ProcessMemory mem, long heroClass, ParityOffsets px, Dictionary<int, int> skillMax)
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

                    // baseTypeId (the stable, un-ascended champion id the DB joins on): the game encodes
                    // ascension (0-6) as the ONES digit of typeId, so baseTypeId = typeId - (typeId % 10).
                    // Verified exact vs Gestal across 300 champions (Hero._type -> HeroType.Id gives the
                    // ASCENDED id, not the base, so the arithmetic rule is the correct source).
                    int baseTypeId = typeId - (typeId % 10);

                    bool stored = mem.ReadBool(obj + Hero_InStorage) || mem.ReadBool(obj + Hero_InBathhouse);
                    byId[id] = new OwnedHero(id, typeId, baseTypeId, grade, level,
                        mem.ReadInt32(obj + Hero_EmpowerLevel), stored,
                        ReadMasteries(mem, obj, px), ReadSkills(mem, obj, px, skillMax));
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

    // First heap object whose klass == the given class (singletons like StaticData).
    private static nint FindInstance(ProcessMemory mem, long klass)
    {
        const int chunk = 0x100000; var buf = new byte[chunk];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk, size - off);
                var rb = toRead == chunk ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                for (int i = 0; i + 8 <= toRead; i += 8)
                    if (BitConverter.ToInt64(rb, i) == klass) return baseAddr + (nint)(off + i);
            }
        return nint.Zero;
    }

    // Build a static typeId -> maxLevel map from StaticData.SkillData.SkillTypes (Dict<int,SkillType>);
    // maxLevel = SkillType.SkillLevelBonuses count + 1 (level 1 base + one per book bonus). All by name.
    public static Dictionary<int, int> BuildSkillMaxLevels(ProcessMemory mem, nint moduleBase)
    {
        var map = new Dictionary<int, int>();
        var sdClass = Il2CppClassResolver.ResolveByNameAny(mem, "StaticData", out _);
        var stClass = Il2CppClassResolver.ResolveByNameAny(mem, "SkillType", out _);
        if (sdClass == nint.Zero || stClass == nint.Zero) return map;
        bool dbg = Environment.GetEnvironmentVariable("SKILLDBG") == "1";

        // Navigate the REAL singleton: AppModel -> StaticDataManager -> StaticData (heap-scanning
        // for a StaticData object finds an uninitialized copy whose SkillData is null).
        var nav0 = new Il2CppNavigator(mem, moduleBase);
        var appModel = nav0.ResolveAppModelInstance();
        var appClass = Il2CppClassResolver.ResolveByNameAny(mem, "AppModel", out _);
        int oSDM = Il2CppFieldResolver.OffsetOf(mem, appClass, "<StaticDataManager>k__BackingField");
        var sdm = oSDM >= 0 ? mem.ReadPointer(appModel + oSDM) : nint.Zero;
        if (dbg && ProcessMemory.IsValidPointer(sdm))
        {
            var sdmClass = mem.ReadPointer(sdm);
            Console.WriteLine($"  [dbg] StaticDataManager ({mem.ReadCString(mem.ReadPointer(sdmClass + 0x10))}) fields:");
            foreach (var f in Il2CppFieldResolver.ReadFields(mem, sdmClass)) Console.WriteLine($"      +0x{f.Offset:X} {f.Name}");
        }
        int oSD = ProcessMemory.IsValidPointer(sdm) ? Il2CppFieldResolver.OffsetOf(mem, mem.ReadPointer(sdm), "<StaticData>k__BackingField") : -1;
        var sd = oSD >= 0 ? mem.ReadPointer(sdm + oSD) : nint.Zero;
        if (dbg) Console.WriteLine($"  [dbg] appModel=0x{appModel:X} sdm@{oSDM}=0x{sdm:X} StaticData@{oSD}=0x{sd:X}");
        if (sd == nint.Zero) return map;

        int oSkillData = Il2CppFieldResolver.OffsetOf(mem, sdClass, "SkillData");
        var ssd = mem.ReadPointer(sd + oSkillData);
        if (dbg) Console.WriteLine($"  [dbg] SkillData@{oSkillData} ssd=0x{ssd:X}");
        if (!ProcessMemory.IsValidPointer(ssd)) return map;
        var ssdClass = mem.ReadPointer(ssd);
        int oSkillTypes = Il2CppFieldResolver.OffsetOf(mem, ssdClass, "SkillTypes");
        int oLB = Il2CppFieldResolver.OffsetOf(mem, stClass, "SkillLevelBonuses");
        var dict = ProcessMemory.IsValidPointer((nint)oSkillTypes) || oSkillTypes >= 0 ? mem.ReadPointer(ssd + oSkillTypes) : nint.Zero;
        if (dbg) Console.WriteLine($"  [dbg] StaticSkillData.SkillTypes@{oSkillTypes} list=0x{dict:X} size={(ProcessMemory.IsValidPointer(dict) ? mem.ReadInt32(dict + List_Size) : -1)} SkillType.SkillLevelBonuses@{oLB}");
        int oStId = Il2CppFieldResolver.OffsetOf(mem, stClass, "Id");
        if (oSkillTypes < 0 || oLB < 0 || oStId < 0 || !ProcessMemory.IsValidPointer(dict)) return map;

        // SkillTypes is a List<SkillType> (not a dict). maxLevel = SkillLevelBonuses count + 1
        // (level 1 base + one level per book bonus).
        var arr = mem.ReadPointer(dict + List_BackingArray);
        int size = mem.ReadInt32(dict + List_Size);
        if (!ProcessMemory.IsValidPointer(arr) || size <= 0 || size > 100_000) return map;
        for (int i = 0; i < size; i++)
        {
            var st = mem.ReadPointer(arr + Array_DataOffset + (nint)i * 8);
            if (!ProcessMemory.IsValidPointer(st)) continue;
            int id = mem.ReadInt32(st + oStId);
            if (id <= 0) continue;
            var lb = mem.ReadPointer(st + oLB);
            int bonuses = ProcessMemory.IsValidPointer(lb) ? mem.ReadInt32(lb + List_Size) : 0;
            if (bonuses >= 0 && bonuses < 20) map[id] = bonuses + 1;
        }
        return map;
    }

    // Probe: verify the static skill-maxLevel map yields the right maxLevel for a champion's skills.
    public static void SkillMaxProbe(params int[] typeIds)
    {
        var proc = FindRaid(); if (proc is null) { Console.WriteLine("[skillmax] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id); if (mem is null) return;
        var mb = mem.FindModuleBase("GameAssembly.dll");
        if (mb == nint.Zero) return;
        var map = BuildSkillMaxLevels(mem, mb);
        Console.WriteLine($"[skillmax] built map of {map.Count} skill types.");
        foreach (var t in typeIds)
            Console.WriteLine($"    typeId {t} -> maxLevel {(map.TryGetValue(t, out var m) ? m.ToString() : "MISSING")}");
    }

    // Probe: for one hero, dump MasteryData.Masteries (List<int>) and Skills (List<Skill> with
    // TypeId/Level + SkillType.SkillLevelBonuses count = maxLevel) to confirm container shapes
    // before wiring the extraction. Usage: --parityprobe <heroId>
    public static void ParityProbe(int targetId)
    {
        var proc = FindRaid(); if (proc is null) { Console.WriteLine("[parity] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id); if (mem is null) return;
        var moduleBase = mem.FindModuleBase("GameAssembly.dll");
        var heroClass = Il2CppClassResolver.Resolve(mem, moduleBase, Hero_TypeInfo_RVA, "Hero", "SharedModel.Meta.Heroes");
        var hmdClass  = Il2CppClassResolver.ResolveByNameAny(mem, "HeroMasteryData", out _);
        var skillClass = Il2CppClassResolver.ResolveByNameAny(mem, "Skill", out _);
        var stClass    = Il2CppClassResolver.ResolveByNameAny(mem, "SkillType", out _);

        int oMastery  = Il2CppFieldResolver.OffsetOf(mem, heroClass, "MasteryData");
        int oSkills   = Il2CppFieldResolver.OffsetOf(mem, heroClass, "Skills");
        int oMasteries = Il2CppFieldResolver.OffsetOf(mem, hmdClass, "Masteries");
        int oSkTypeId = Il2CppFieldResolver.OffsetOf(mem, skillClass, "TypeId");
        int oSkLevel  = Il2CppFieldResolver.OffsetOf(mem, skillClass, "Level");
        int oSkType   = Il2CppFieldResolver.OffsetOf(mem, skillClass, "_type");
        int oLevelBonuses = Il2CppFieldResolver.OffsetOf(mem, stClass, "SkillLevelBonuses");
        Console.WriteLine($"[parity] Hero.MasteryData@{oMastery} .Skills@{oSkills}; HeroMasteryData.Masteries@{oMasteries}; " +
                          $"Skill.TypeId@{oSkTypeId}/.Level@{oSkLevel}/._type@{oSkType}; SkillType.SkillLevelBonuses@{oLevelBonuses}");

        const int chunk = 0x100000; var buf = new byte[chunk];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk, size - off);
                var rb = toRead == chunk ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                for (int i = 0; i + 8 <= toRead; i += 8)
                {
                    if (BitConverter.ToInt64(rb, i) != (long)heroClass) continue;
                    var obj = baseAddr + (nint)(off + i);
                    if (mem.ReadInt32(obj + Hero_Id) != targetId) continue;
                    Console.WriteLine($"[parity] hero {targetId} @0x{obj:X} typeId={mem.ReadInt32(obj + Hero_TypeId)} grade={mem.ReadInt32(obj + Hero_Grade)} level={mem.ReadInt32(obj + Hero_Level)}");

                    // Masteries: HeroMasteryData.Masteries as List<int>
                    var hmd = mem.ReadPointer(obj + oMastery);
                    if (ProcessMemory.IsValidPointer(hmd))
                    {
                        var listObj = mem.ReadPointer(hmd + oMasteries);
                        var arr = mem.ReadPointer(listObj + List_BackingArray);
                        int sz = mem.ReadInt32(listObj + List_Size);
                        var ids = new List<int>();
                        for (int e = 0; e < sz && e < 30; e++) ids.Add(mem.ReadInt32(arr + Array_DataOffset + e * 4));
                        Console.WriteLine($"  Masteries (List<int> size={sz}): [{string.Join(",", ids)}]");
                    }

                    // Base stats note: Hero._type is NULL (like Skill._type), so HeroType (and its
                    // Forms->BaseStats) is unreachable from the Hero. Base stats need static HeroData
                    // navigation by typeId + level/star scaling — deferred (estimateStats is the fallback).

                    // Skills: List<Skill>
                    var skList = mem.ReadPointer(obj + oSkills);
                    if (ProcessMemory.IsValidPointer(skList))
                    {
                        var arr = mem.ReadPointer(skList + List_BackingArray);
                        int sz = mem.ReadInt32(skList + List_Size);
                        Console.WriteLine($"  Skills (List size={sz}):");
                        for (int e = 0; e < sz && e < 8; e++)
                        {
                            var sk = mem.ReadPointer(arr + Array_DataOffset + e * 8);
                            if (!ProcessMemory.IsValidPointer(sk)) continue;
                            int tId = mem.ReadInt32(sk + oSkTypeId);
                            int lvl = mem.ReadInt32(sk + oSkLevel);
                            var st = mem.ReadPointer(sk + oSkType);
                            string stName = "-";
                            if (ProcessMemory.IsValidPointer(st) && mem.IsReadable(st))
                            {
                                var k = mem.ReadPointer(st);
                                if (ProcessMemory.IsValidPointer(k)) stName = mem.ReadCString(mem.ReadPointer(k + 0x10)) ?? "?";
                            }
                            Console.Write($"    skill typeId={tId} level={lvl} _type=0x{st:X}({stName})");
                            if (ProcessMemory.IsValidPointer(st) && mem.IsReadable(st))
                            {
                                int stId = mem.ReadInt32(st + 0x10); // SkillType.Id
                                var lb = mem.ReadPointer(st + oLevelBonuses);
                                int lbSize = ProcessMemory.IsValidPointer(lb) ? mem.ReadInt32(lb + List_Size) : -99;
                                Console.Write($" SkillType.Id={stId} SkillLevelBonuses=0x{lb:X} size={lbSize}");
                            }
                            Console.WriteLine();
                        }
                    }
                    return;
                }
            }
        Console.WriteLine($"[parity] hero {targetId} not found.");
    }
}
