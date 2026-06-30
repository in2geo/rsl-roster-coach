using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Memory;
using static RslBattleReader.Il2Cpp.Il2CppOffsets;

namespace RslBattleReader;

/// <summary>
/// Option B — direct game-memory roster reader (champions). Resolves the
/// UserHeroData Il2CppClass via its TypeInfo RVA, signature-scans the heap for the
/// live instance (object whose klass pointer == that class, validated by a plausible
/// HeroById dictionary of Hero records), then reads each owned Hero. Passive read
/// only — same technique as the battle reader, no injection.
///
/// This deliberately sidesteps the generic UserGuard&lt;UserWrapper&gt; static: the
/// klass-scan lands directly on UserHeroData.HeroById (the owned roster).
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

        var klass = mem.ReadPointer(moduleBase + (nint)UserHeroData_TypeInfo_RVA);
        if (!ProcessMemory.IsValidPointer(klass)) { Console.WriteLine("[roster] UserHeroData class pointer not resolved (stale RVA?)."); return; }
        Console.WriteLine($"[roster] UserHeroData class = 0x{klass:X}; scanning heap for the live instance…");

        var instance = ScanForInstance(mem, klass);
        if (instance == nint.Zero)
        {
            Console.WriteLine("[roster] no valid UserHeroData instance found — is the account loaded (past login/loading)?");
            return;
        }
        Console.WriteLine($"[roster] UserHeroData instance = 0x{instance:X}");

        var heroes = ReadRoster(mem, instance);
        var owned   = heroes.Count(h => !h.InStorage);
        Console.WriteLine($"[roster] {heroes.Count} heroes total ({owned} active, {heroes.Count - owned} in storage):\n");
        Console.WriteLine($"  {"id",-9}{"typeId",-10}{"stars",-7}{"level",-7}{"empower",-9}storage");
        foreach (var h in heroes.OrderByDescending(h => h.Grade).ThenByDescending(h => h.Level))
            Console.WriteLine($"  {h.Id,-9}{h.TypeId,-10}{h.Grade,-7}{h.Level,-7}{h.EmpowerLevel,-9}{(h.InStorage ? "yes" : "")}");
    }

    // Walks readable regions; for each 8-aligned slot equal to the UserHeroData
    // class pointer, treats the slot address as a candidate object base (klass@0)
    // and validates it via HeroById. Returns the first valid instance.
    private static nint ScanForInstance(ProcessMemory mem, nint klass)
    {
        long target = (long)klass;
        const int chunk = 0x100000; // 1 MB
        var buf = new byte[chunk];
        long hits = 0;
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
        {
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk, size - off);
                var readBuf = toRead == chunk ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, readBuf)) continue;
                for (int i = 0; i + 8 <= toRead; i += 8)
                {
                    if (BitConverter.ToInt64(readBuf, i) != target) continue;
                    hits++;
                    var candidate = baseAddr + (nint)(off + i);
                    if (ValidateUserHeroData(mem, candidate))
                    {
                        Console.WriteLine($"[roster] class-pointer hits scanned so far={hits}; validated instance.");
                        return candidate;
                    }
                }
            }
        }
        Console.WriteLine($"[roster] class-pointer appeared {hits} time(s) but none validated as a populated UserHeroData.");
        return nint.Zero;
    }

    // A real UserHeroData has HeroById = a Dictionary<int,Hero> with a plausible
    // count whose first entry is a Hero with sane typeId/grade/level. Filters the
    // false positives where the class pointer appears inside vtables/static data.
    private static bool ValidateUserHeroData(ProcessMemory mem, nint obj)
    {
        var dict = mem.ReadPointer(obj + UHD_HeroById);
        if (!ProcessMemory.IsValidPointer(dict)) return false;
        int count = mem.ReadInt32(dict + Dict_Count);
        if (count < 1 || count > 5000) return false;
        var entries = mem.ReadPointer(dict + Dict_Entries);
        if (!ProcessMemory.IsValidPointer(entries)) return false;
        // Check the first several entries (some may be empty/deleted slots) — accept
        // if ANY holds a Hero with sane typeId/grade/level.
        int probe = Math.Min(count, 32);
        for (int i = 0; i < probe; i++)
        {
            var entry = entries + Array_DataOffset + (nint)(i * DictIntObj_EntrySize);
            if (mem.ReadInt32(entry) < 0) continue;
            var hero = mem.ReadPointer(entry + DictIntObj_ValOffset);
            if (!ProcessMemory.IsValidPointer(hero)) continue;
            int typeId = mem.ReadInt32(hero + Hero_TypeId);
            int grade  = mem.ReadInt32(hero + Hero_Grade);
            int level  = mem.ReadInt32(hero + Hero_Level);
            if (typeId is > 0 and < 1_000_000 && grade is >= 1 and <= 6 && level is >= 1 and <= 60)
                return true;
        }
        return false;
    }

    private static List<OwnedHero> ReadRoster(ProcessMemory mem, nint instance)
    {
        var dict = mem.ReadPointer(instance + UHD_HeroById);
        int count = mem.ReadInt32(dict + Dict_Count);
        var entries = mem.ReadPointer(dict + Dict_Entries);
        var list = new List<OwnedHero>(count);
        for (int i = 0; i < count; i++)
        {
            var entry = entries + Array_DataOffset + (nint)(i * DictIntObj_EntrySize);
            if (mem.ReadInt32(entry) < 0) continue; // hash < 0 => empty/deleted slot
            var hero = mem.ReadPointer(entry + DictIntObj_ValOffset);
            if (!ProcessMemory.IsValidPointer(hero)) continue;
            list.Add(new OwnedHero(
                mem.ReadInt32(hero + Hero_Id),
                mem.ReadInt32(hero + Hero_TypeId),
                mem.ReadInt32(hero + Hero_Grade),
                mem.ReadInt32(hero + Hero_Level),
                mem.ReadInt32(hero + Hero_EmpowerLevel),
                mem.ReadBool(hero + Hero_InStorage)));
        }
        return list;
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
