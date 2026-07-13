using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Il2Cpp;
using RslBattleReader.Memory;

namespace RslBattleReader;

/// <summary>
/// Reads per-hero Clan Boss damage from the result dialog while the result screen is open.
/// The values live ONLY in this transient UI context (the combat-side StatisticsByHero dict
/// is empty post-battle), so capture navigates the live dialog:
///
///   BattleFinishAllianceBossDialogContext              (the CB result dialog — one live instance)
///     +0x160 → UserContextList&lt;HeroBattleStatsContext&gt;
///       +0x078 → List&lt;HeroBattleStatsContext&gt;   (_items @0x10, _size @0x18)
///         element → HeroBattleStatsContext            (one hero row)
///           +0x080 → HeroAvatarContext                (identity)
///           +0x090 → HeroBattleStatContext (damage) ─┐ +0x50 → LongProperty → +0x28 = Int64
///           +0x098 → HeroBattleStatContext (defense)  ├─ (three stat rows, this order)
///           +0x0A0 → HeroBattleStatContext (healing) ─┘
///
/// Anchoring on the dialog (found by class name) yields exactly the current battle's heroes —
/// a global class scan also picks up stale/uninitialised contexts. Total damage = Σ damage.
/// PASSIVE READ ONLY. Offsets verified live 2026-07-12 (GameAssembly v11.60.0).
///
/// Usage:  RslBattleReader.exe --cbdamage
/// </summary>
[SupportedOSPlatform("windows")]
internal static class CbDamageReader
{
    private const string Ns   = "Client.ViewModel.Contextes.BattleFinishDialog";
    private const string Dialog = "BattleFinishAllianceBossDialogContext";

    private const int Dlg_HeroList  = 0x160; // UserContextList<HeroBattleStatsContext>*
    private const int UCL_List      = 0x078; // List<HeroBattleStatsContext>*
    private const int List_Items    = 0x010; // T[]
    private const int List_Size     = 0x018; // int
    private const int Array_Data    = 0x020; // element 0
    private const int HBSC_Avatar   = 0x080; // HeroAvatarContext*
    private const int HBSC_Damage   = 0x090; // HeroBattleStatContext* (damage row)
    private const int HBSC_Defense  = 0x098;
    private const int HBSC_Healing  = 0x0A0;
    private const int StatCtx_Prop  = 0x050; // LongProperty*
    private const int LongProp_Value = 0x028; // Int64

    public static void Run()
    {
        var (mem, proc) = Open();
        if (mem is null) return;
        using (mem)
        {
            var res = Capture(mem);
            if (res is null) { Console.WriteLine("[cbdamage] no CB result dialog open (or offsets shifted)."); return; }
            foreach (var h in res.Heroes)
                Console.WriteLine($"  slot {h.Slot}: damage={h.Damage,12}  defense={h.Defense,10}  heal={h.Healing,10}");
            Console.WriteLine($"\n[cbdamage] {res.Heroes.Count} hero(es), total damage dealt = {res.TotalDamage}");
        }
        proc?.Dispose();
    }

    public sealed record HeroDamage(int Slot, long Damage, long Defense, long Healing);
    public sealed record CbResult(IReadOnlyList<HeroDamage> Heroes, long TotalDamage);

    /// <summary>Reads the live CB result dialog, or null if none is open. Safe to poll.</summary>
    public static CbResult? Capture(ProcessMemory mem)
    {
        var gameAsm = mem.FindModuleBase("GameAssembly.dll");
        if (gameAsm == nint.Zero) return null;

        var klass = Il2CppClassResolver.Resolve(mem, gameAsm, 0, Dialog, Ns);
        if (klass == nint.Zero) return null;

        var dialog = FindLiveDialog(mem, klass);
        if (dialog == nint.Zero) return null;

        var ucl = mem.ReadPointer(dialog + Dlg_HeroList);
        if (!ProcessMemory.IsValidPointer(ucl)) return null;
        var list = mem.ReadPointer(ucl + UCL_List);
        if (!ProcessMemory.IsValidPointer(list)) return null;
        var items = mem.ReadPointer(list + List_Items);
        if (!ProcessMemory.IsValidPointer(items)) return null;
        int size = mem.ReadInt32(list + List_Size);
        if (size is <= 0 or > 12) return null;

        var heroes = new List<HeroDamage>(size);
        long total = 0;
        for (int i = 0; i < size; i++)
        {
            var hero = mem.ReadPointer(items + Array_Data + i * 8);
            if (!ProcessMemory.IsValidPointer(hero)) continue;
            long dmg = ReadStat(mem, hero, HBSC_Damage);
            long def = ReadStat(mem, hero, HBSC_Defense);
            long heal = ReadStat(mem, hero, HBSC_Healing);
            heroes.Add(new HeroDamage(i, dmg, def, heal));
            if (dmg > 0) total += dmg;
        }
        return heroes.Count == 0 ? null : new CbResult(heroes, total);
    }

    /// <summary>Scans the heap for the one live dialog instance. Prefers an instance whose
    /// hero list resolves to a non-empty size (a stale dialog's list has been torn down).</summary>
    private static nint FindLiveDialog(ProcessMemory mem, nint klass)
    {
        nint best = nint.Zero;
        var buf = new byte[8 * 1024 * 1024];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
        {
            for (long off = 0; off < size; off += buf.Length)
            {
                int chunk = (int)Math.Min(buf.Length, size - off);
                var view = chunk == buf.Length ? buf : new byte[chunk];
                if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                for (int i = 0; i + 8 <= chunk; i += 8)
                {
                    if (BitConverter.ToInt64(view, i) != (long)klass) continue;
                    var inst = (nint)((long)baseAddr + off + i);
                    var ucl = mem.ReadPointer(inst + Dlg_HeroList);
                    if (!ProcessMemory.IsValidPointer(ucl)) continue;
                    var list = mem.ReadPointer(ucl + UCL_List);
                    if (!ProcessMemory.IsValidPointer(list)) continue;
                    int sz = mem.ReadInt32(list + List_Size);
                    if (sz is > 0 and <= 12) return inst;   // a live dialog with a populated list
                    best = inst;                             // fallback: klass matched but list empty
                }
            }
        }
        return best;
    }

    private static long ReadStat(ProcessMemory mem, nint heroCtx, int statOff)
    {
        var statCtx = mem.ReadPointer(heroCtx + statOff);
        if (!ProcessMemory.IsValidPointer(statCtx)) return -1;
        var prop = mem.ReadPointer(statCtx + StatCtx_Prop);
        if (!ProcessMemory.IsValidPointer(prop)) return -1;
        return mem.ReadInt64(prop + LongProp_Value);
    }

    private static (ProcessMemory?, Process?) Open()
    {
        Process? proc = null;
        foreach (var n in new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" })
        {
            var p = Process.GetProcessesByName(n);
            if (p.Length > 0) { proc = p[0]; break; }
        }
        if (proc is null) { Console.WriteLine("[cbdamage] Raid not running."); return (null, null); }
        var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[cbdamage] could not open process (run as admin)."); return (null, proc); }
        return (mem, proc);
    }
}
