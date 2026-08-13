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
    private const string DungeonDialog = "BattleFinishDungeonDialogContext"; // Spider/IG/Dragon/FK

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

    /// <summary>Diagnostic: find HeroBattleStatsContext instances directly (by class) and decode
    /// each one's damage/defense/heal via the CB chain. The current battle's heroes show the
    /// on-screen numbers; prints each instance's ADDRESS so we can --refs back to the container.
    /// Passive read. Usage: --herostats [max=40]</summary>
    public static void HeroStatsScan(int max = 40)
    {
        var (mem, proc) = Open();
        if (mem is null) return;
        using (mem)
        {
            var gameAsm = mem.FindModuleBase("GameAssembly.dll");
            var klass = Il2CppClassResolver.Resolve(mem, gameAsm, 0, "HeroBattleStatsContext", Ns);
            if (klass == nint.Zero) { Console.WriteLine("[herostats] HeroBattleStatsContext class not found."); proc?.Dispose(); return; }
            int shown = 0;
            var buf = new byte[8 * 1024 * 1024];
            foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            {
                for (long off = 0; off < size && shown < max; off += buf.Length)
                {
                    int chunk = (int)Math.Min(buf.Length, size - off);
                    var view = chunk == buf.Length ? buf : new byte[chunk];
                    if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                    for (int i = 0; i + 8 <= chunk && shown < max; i += 8)
                    {
                        if (BitConverter.ToInt64(view, i) != (long)klass) continue;
                        var hero = (nint)((long)baseAddr + off + i);
                        long dmg = ReadStat(mem, hero, HBSC_Damage);
                        long def = ReadStat(mem, hero, HBSC_Defense);
                        long heal = ReadStat(mem, hero, HBSC_Healing);
                        if (dmg <= 0 && def <= 0 && heal <= 0) continue; // skip empty/stale
                        Console.WriteLine($"  @0x{hero:X}  damage={dmg,12} defense={def,10} heal={heal,10}");
                        shown++;
                    }
                }
            }
            if (shown == 0) Console.WriteLine("[herostats] no non-empty HeroBattleStatsContext (open a result screen).");
        }
        proc?.Dispose();
    }

    /// <summary>--dungeondamage: read the live dungeon result dialog (Spider/IG/Dragon/FK).</summary>
    public static void DungeonRun()
    {
        var (mem, proc) = Open();
        if (mem is null) return;
        using (mem)
        {
            var res = CaptureDungeon(mem);
            if (res is null) { Console.WriteLine("[dungeondamage] no dungeon result dialog open (or hero-list offset differs — try --dungeoninspect)."); }
            else
            {
                foreach (var h in res.Heroes)
                    Console.WriteLine($"  slot {h.Slot}: damage={h.Damage,12}  defense={h.Defense,10}  heal={h.Healing,10}");
                Console.WriteLine($"\n[dungeondamage] {res.Heroes.Count} hero(es), total damage dealt = {res.TotalDamage}");
            }
        }
        proc?.Dispose();
    }

    public sealed record HeroDamage(int Slot, long Damage, long Defense, long Healing);
    public sealed record CbResult(IReadOnlyList<HeroDamage> Heroes, long TotalDamage);

    /// <summary>Reads the live CB result dialog, or null if none is open. Safe to poll.</summary>
    public static CbResult? Capture(ProcessMemory mem) => CaptureFrom(mem, Dialog, Dlg_HeroList);

    // The dungeon result dialog nests its hero list differently from CB (not a simple
    // UserContextList at a dialog slot). But the 5 live HeroBattleStatsContext objects for the
    // current battle are allocated CONTIGUOUSLY at a fixed stride, cleanly distinct from the stale/
    // uninitialised contexts (whose damage/def/heal are sentinels: -1, 0x120000, or huge garbage).
    // So: GATE on the dungeon dialog existing (result screen open), then read the contiguous run of
    // valid hero contexts. Verified live on IG-10 defeat 2026-07-15 (returned the exact screen
    // damages). Stride confirmed 0x1A0; team is stored in reverse screen order.
    private const int Hero_Stride = 0x1A0;
    // 0x120000 is a documented SENTINEL for an uninitialised/stale context (see the class notes). It
    // sits inside the "sane" range and was slipping through as a phantom 6th hero (verified live: an
    // extra 0x120000=1,179,648 context in both FK and IG captures, inflating the raw total). Exclude it.
    private static bool ValidStat(long v) => v >= 0 && v < 1_000_000_000 && v != 0x120000;

    /// <param name="expectedTeam">Team size from the battle FILE (authoritative). The heap scan is
    /// only trustworthy when it yields exactly one contiguous run of this length — see the staleness
    /// note above. Pass 0 only for the ad-hoc --dungeondamage diagnostic, which tolerates a guess.</param>
    /// <param name="logRejection">Whether to print WHY a read was refused. The caller retries while
    /// the previous battle's contexts are still being cleared, so most rejections are just
    /// mid-convergence noise — it passes true only on the final attempt, when the refusal is real.</param>
    public static CbResult? CaptureDungeon(ProcessMemory mem, int expectedTeam = 0, bool logRejection = true)
    {
        var gameAsm = mem.FindModuleBase("GameAssembly.dll");
        if (gameAsm == nint.Zero) return null;
        var dlgKlass = Il2CppClassResolver.Resolve(mem, gameAsm, 0, DungeonDialog, Ns);
        if (dlgKlass == nint.Zero) return null;
        var heroKlass = Il2CppClassResolver.Resolve(mem, gameAsm, 0, "HeroBattleStatsContext", Ns);
        if (heroKlass == nint.Zero) return null;

        // Gate: a dungeon result dialog must be live (else we'd read stale contexts between battles).
        var dialogs = EnumerateInstances(mem, dlgKlass);
        if (dialogs.Count == 0) return null;

        // ── PRIMARY (2026-08-13): navigate from the live dialog to ITS OWN hero list. ────────────────
        // The dialog holds exactly the 5 heroes the game just showed, so the stale-context problem the
        // heap scan fights (a PREVIOUS battle's HeroBattleStatsContext lingering in the heap and breaking
        // the "contiguous run of N" test — e.g. a Rathalos from a prior fight) simply cannot occur here.
        // Self-calibrating: the hero list is found by STRUCTURE (a List<HeroBattleStatsContext> of the
        // file's team size, either wrapped in a UserContextList — the CB shape — or a direct List at a
        // dialog slot) rather than a hardcoded offset, so a patch that moves the field does not break it.
        // The dungeon dialog nests its list at a DIFFERENT slot than CB (which is why the older code
        // heap-scanned); scanning the dialog's own pointer slots finds it without knowing that slot.
        foreach (var dialog in dialogs)
        {
            for (int o = 0x10; o <= 0x400; o += 8)
            {
                var p = mem.ReadPointer(dialog + o);
                if (!ProcessMemory.IsValidPointer(p)) continue;
                var addrs = TryHeroList(mem, mem.ReadPointer(p + UCL_List), heroKlass, expectedTeam)   // UserContextList wrapper (CB shape)
                         ?? TryHeroList(mem, p, heroKlass, expectedTeam);                              // p is itself a List<>
                if (addrs is null) continue;
                var found = new List<HeroDamage>(addrs.Count);
                long tot = 0;
                for (int i = 0; i < addrs.Count; i++)   // list order == screen order == the file's hero slots
                {
                    long dd = ReadStat(mem, addrs[i], HBSC_Damage), dff = ReadStat(mem, addrs[i], HBSC_Defense), hll = ReadStat(mem, addrs[i], HBSC_Healing);
                    found.Add(new HeroDamage(i, dd, dff, hll));
                    if (dd > 0) tot += dd;
                }
                Console.WriteLine($"[dungeondamage] dialog-nav read {found.Count} hero(es) from the live dialog (dialog+0x{o:X}) — stale-context-proof.");
                return new CbResult(found, tot);
            }
        }

        // ── FALLBACK: the legacy heap scan + contiguous-run guard (fragile vs stale objects; kept as a
        // net for the rare case the dialog nav finds no matching list). ─────────────────────────────
        // Collect all HeroBattleStatsContext instances whose 3 stats are all in a sane range.
        var valid = new List<(nint addr, long dmg, long def, long heal)>();
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
                    if (BitConverter.ToInt64(view, i) != (long)heroKlass) continue;
                    var h = (nint)((long)baseAddr + off + i);
                    long d = ReadStat(mem, h, HBSC_Damage), df = ReadStat(mem, h, HBSC_Defense), hl = ReadStat(mem, h, HBSC_Healing);
                    if (ValidStat(d) && ValidStat(df) && ValidStat(hl) && (d > 0 || df > 0 || hl > 0))
                        valid.Add((h, d, df, hl));
                }
            }
        }
        if (valid.Count < 2) return null;
        valid.Sort((a, b) => a.addr.CompareTo(b.addr));

        // ── Staleness guard (2026-07-19). ────────────────────────────────────────────────────────
        // The OLD code took ALL valid contexts whenever there were <= 6, on the assumption that only
        // the current battle's heroes are non-sentinel while the dialog is open. THAT IS FALSE: the
        // game does not reset a previous battle's HeroBattleStatsContext objects, so their stats stay
        // in the "sane" range indefinitely. A capture whose stale + fresh contexts summed to <= 6
        // therefore returned a UNION OF TWO BATTLES, silently and plausibly.
        //   Observed Spider-20, Don$Gnut: two different defeats (133 vs 44 turns, different teams)
        //   reported byte-identical per-hero triples, and the following VICTORY's slots 2-4 carried
        //   the defeat's slots 1-3. Three exact matches — misattributed damage on a real graded run.
        // The freshly-allocated team IS contiguous at Hero_Stride; stale survivors generally are not.
        // So ALWAYS segment into contiguous runs, and only trust an UNAMBIGUOUS one of the expected
        // length. Anything else returns null: a missing number is recoverable, a wrong one is not.
        var runs = new List<List<(nint addr, long dmg, long def, long heal)>>();
        var cur = new List<(nint addr, long dmg, long def, long heal)> { valid[0] };
        for (int i = 1; i < valid.Count; i++)
        {
            if ((long)valid[i].addr - (long)valid[i - 1].addr == Hero_Stride) cur.Add(valid[i]);
            else { runs.Add(cur); cur = new() { valid[i] }; }
        }
        runs.Add(cur);

        List<(nint addr, long dmg, long def, long heal)> best;
        if (expectedTeam > 0)
        {
            var exact = runs.FindAll(r => r.Count == expectedTeam);
            if (exact.Count == 0)
            {
                if (logRejection)
                    Console.WriteLine($"[dungeondamage] REJECTED: no contiguous run of {expectedTeam} hero context(s) " +
                                      $"(found runs: {string.Join(",", runs.ConvertAll(r => r.Count))}, " +
                                      $"{runs.Sum(r => r.Count)} valid contexts). Per-hero stats left null.");
                return null;
            }
            if (exact.Count > 1)
            {
                if (logRejection)
                    Console.WriteLine($"[dungeondamage] REJECTED: {exact.Count} candidate runs of {expectedTeam} — " +
                                      "cannot tell the current battle from a stale one. Per-hero stats left null.");
                return null;
            }
            best = exact[0];
        }
        else
        {
            best = runs[0];
            foreach (var r in runs) if (r.Count > best.Count) best = r;
        }
        if (best.Count < 2) return null;

        best.Reverse(); // contexts are stored in reverse screen order → slot 0 = leader
        var heroes = new List<HeroDamage>(best.Count);
        long total = 0;
        for (int i = 0; i < best.Count; i++) { heroes.Add(new HeroDamage(i, best[i].dmg, best[i].def, best[i].heal)); if (best[i].dmg > 0) total += best[i].dmg; }
        return new CbResult(heroes, total);
    }

    private static bool AnyInstanceExists(ProcessMemory mem, nint klass)
    {
        var buf = new byte[8 * 1024 * 1024];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            for (long off = 0; off < size; off += buf.Length)
            {
                int chunk = (int)Math.Min(buf.Length, size - off);
                var view = chunk == buf.Length ? buf : new byte[chunk];
                if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                for (int i = 0; i + 8 <= chunk; i += 8)
                    if (BitConverter.ToInt64(view, i) == (long)klass) return true;
            }
        return false;
    }

    /// <summary>All live instance addresses of <paramref name="klass"/> (object header @+0 == klass ptr).
    /// The dungeon dialog is normally one instance, but a torn-down stale dialog can coexist — the hero-list
    /// validation in <see cref="TryHeroList"/> rejects the stale one (empty/gone list).</summary>
    private static List<nint> EnumerateInstances(ProcessMemory mem, nint klass)
    {
        var found = new List<nint>();
        var buf = new byte[8 * 1024 * 1024];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            for (long off = 0; off < size; off += buf.Length)
            {
                int chunk = (int)Math.Min(buf.Length, size - off);
                var view = chunk == buf.Length ? buf : new byte[chunk];
                if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                for (int i = 0; i + 8 <= chunk; i += 8)
                    if (BitConverter.ToInt64(view, i) == (long)klass)
                        found.Add((nint)((long)baseAddr + off + i));
            }
        return found;
    }

    /// <summary>If <paramref name="listPtr"/> is a C# List&lt;HeroBattleStatsContext&gt; whose element count
    /// equals the team (or 2..8 when unknown) and every element is a HeroBattleStatsContext (klass check),
    /// return the element addresses in list order (screen order); else null. The klass check is what makes
    /// this immune to a random same-size list elsewhere in the dialog.</summary>
    private static List<nint>? TryHeroList(ProcessMemory mem, nint listPtr, nint heroKlass, int expectedTeam)
    {
        if (!ProcessMemory.IsValidPointer(listPtr)) return null;
        int sz = mem.ReadInt32(listPtr + List_Size);
        if (sz < 2 || sz > 8) return null;
        if (expectedTeam > 0 && sz != expectedTeam) return null;
        var items = mem.ReadPointer(listPtr + List_Items);
        if (!ProcessMemory.IsValidPointer(items)) return null;
        var addrs = new List<nint>(sz);
        for (int i = 0; i < sz; i++)
        {
            var e = mem.ReadPointer(items + Array_Data + i * 8);
            if (!ProcessMemory.IsValidPointer(e)) return null;
            if (mem.ReadPointer(e) != heroKlass) return null;   // every element must be a HeroBattleStatsContext
            addrs.Add(e);
        }
        return addrs;
    }

    /// <summary>Generalized capture: anchor on <paramref name="dialogClass"/>, walk the hero list at
    /// <paramref name="heroListOffset"/>, read each hero's damage/defense/healing.</summary>
    public static CbResult? CaptureFrom(ProcessMemory mem, string dialogClass, int heroListOffset)
    {
        var gameAsm = mem.FindModuleBase("GameAssembly.dll");
        if (gameAsm == nint.Zero) return null;

        var klass = Il2CppClassResolver.Resolve(mem, gameAsm, 0, dialogClass, Ns);
        if (klass == nint.Zero) return null;

        var dialog = FindLiveDialog(mem, klass, heroListOffset);
        if (dialog == nint.Zero) return null;

        var ucl = mem.ReadPointer(dialog + heroListOffset);
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
    private static nint FindLiveDialog(ProcessMemory mem, nint klass, int heroListOffset)
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
                    var ucl = mem.ReadPointer(inst + heroListOffset);
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

    /// <summary>Diagnostic: find the live dungeon dialog instance and dump its first N pointer slots
    /// (annotated with any that resolve to a UserContextList whose List size is a plausible team
    /// count). Used to CONFIRM the hero-list offset for BattleFinishDungeonDialogContext and to spot
    /// a wave/phase field. Passive read. Usage: --dungeoninspect [slots=80]</summary>
    public static void DungeonInspect(int slots = 80)
    {
        var (mem, proc) = Open();
        if (mem is null) return;
        using (mem)
        {
            var gameAsm = mem.FindModuleBase("GameAssembly.dll");
            var klass = Il2CppClassResolver.Resolve(mem, gameAsm, 0, DungeonDialog, Ns);
            if (klass == nint.Zero) { Console.WriteLine($"[dungeoninspect] class {DungeonDialog} not found."); proc?.Dispose(); return; }
            // find ANY instance of the class (open result screen).
            nint inst = nint.Zero;
            var buf = new byte[8 * 1024 * 1024];
            foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            {
                for (long off = 0; off < size && inst == nint.Zero; off += buf.Length)
                {
                    int chunk = (int)Math.Min(buf.Length, size - off);
                    var view = chunk == buf.Length ? buf : new byte[chunk];
                    if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                    for (int i = 0; i + 8 <= chunk; i += 8)
                        if (BitConverter.ToInt64(view, i) == (long)klass) { inst = (nint)((long)baseAddr + off + i); break; }
                }
                if (inst != nint.Zero) break;
            }
            if (inst == nint.Zero) { Console.WriteLine("[dungeoninspect] no live instance (open a dungeon result screen)."); proc?.Dispose(); return; }
            Console.WriteLine($"[dungeoninspect] {DungeonDialog} instance @ 0x{inst:X}.");
            // Try to POSITIVELY identify the hero list: for each slot, test it as a UserContextList
            // (list @ +0x078) and as a direct List<> (items @ +0x10, size @ +0x18). For any list of
            // size 3-6, decode element[0]'s damage via the CB chain (+0x090 → +0x50 → +0x28) and
            // print it — a match to an on-screen damage confirms the hero-list offset + wrapper shape.
            long ReadHeroDamage(nint hero) {
                if (!ProcessMemory.IsValidPointer(hero)) return -1;
                var sc = mem.ReadPointer(hero + HBSC_Damage); if (!ProcessMemory.IsValidPointer(sc)) return -1;
                var pr = mem.ReadPointer(sc + StatCtx_Prop);  if (!ProcessMemory.IsValidPointer(pr)) return -1;
                return mem.ReadInt64(pr + LongProp_Value);
            }
            void TryList(int o, nint listPtr, string shape) {
                if (!ProcessMemory.IsValidPointer(listPtr)) return;
                int sz = mem.ReadInt32(listPtr + List_Size);
                if (sz is < 2 or > 8) return;
                var items = mem.ReadPointer(listPtr + List_Items);
                if (!ProcessMemory.IsValidPointer(items)) return;
                var hero0 = mem.ReadPointer(items + Array_Data);
                long dmg0 = ReadHeroDamage(hero0);
                Console.WriteLine($"  +0x{o:X3} [{shape}] List size={sz}  element0.damage={dmg0}");
            }
            for (int o = 0; o <= slots * 8; o += 8)
            {
                var p = mem.ReadPointer(inst + o);
                if (!ProcessMemory.IsValidPointer(p)) continue;
                TryList(o, mem.ReadPointer(p + UCL_List), "UCL");   // UserContextList wrapper (CB shape)
                TryList(o, p, "direct");                            // p is itself a List<>
                // also: is p ITSELF a HeroBattleStatsContext held directly at this slot?
                long d = ReadHeroDamage(p);
                if (d is > 100 and < 100_000_000) {
                    long def = -1, heal = -1;
                    var sd = mem.ReadPointer(p + HBSC_Defense); if (ProcessMemory.IsValidPointer(sd)) { var pr = mem.ReadPointer(sd + StatCtx_Prop); if (ProcessMemory.IsValidPointer(pr)) def = mem.ReadInt64(pr + LongProp_Value); }
                    var sh = mem.ReadPointer(p + HBSC_Healing);  if (ProcessMemory.IsValidPointer(sh)) { var pr = mem.ReadPointer(sh + StatCtx_Prop); if (ProcessMemory.IsValidPointer(pr)) heal = mem.ReadInt64(pr + LongProp_Value); }
                    Console.WriteLine($"  +0x{o:X3} HERO? damage={d,12} defense={def,10} heal={heal,10}");
                }
            }
            Console.WriteLine("  (small-int slots, possible wave/phase index:)");
            for (int o = 0; o <= slots * 8; o += 8) {
                int v = mem.ReadInt32(inst + o);
                if (v is >= 0 and <= 6) Console.WriteLine($"  +0x{o:X3}  int={v}");
            }
        }
        proc?.Dispose();
    }

    private static long ReadStat(ProcessMemory mem, nint heroCtx, int statOff)
    {
        var statCtx = mem.ReadPointer(heroCtx + statOff);
        if (!ProcessMemory.IsValidPointer(statCtx)) return -1;
        var prop = mem.ReadPointer(statCtx + StatCtx_Prop);
        if (!ProcessMemory.IsValidPointer(prop)) return -1;
        return mem.ReadInt64(prop + LongProp_Value);
    }

    /// <summary>
    /// DIAGNOSTIC (2026-07-21): can we still reach PER-ROUND hero stats after a battle?
    ///
    /// ReadHeroStat already builds a full `perRound` list (death order, phase boundary, per-round
    /// tempo) — it just always comes back EMPTY, because it walks BattleResult -> BR_Statistics ->
    /// StatisticsByHero, and that dictionary is cleared once the battle ends. The data structure
    /// is not missing; we are reading it at the wrong moment.
    ///
    /// So: skip the BattleResult path entirely and heap-scan for BattleStatistics instances
    /// directly, exactly as the damage capture scans for HeroBattleStatsContext. If any instance
    /// still holds a populated StatisticsByHero, then per-round HP — i.e. PHASE-AT-DEATH, which
    /// round the reviver died in — is recoverable post-battle with no in-battle sampling at all.
    ///
    /// Prints, per hero: typeId, slot, isDead, and every round key with its HP start/finish,
    /// turns and kills. Usage: --roundstats [maxObjects=20]
    /// </summary>
    public static void RoundStatsScan(int max = 20)
    {
        var (mem, proc) = Open();
        if (mem is null) return;
        using (mem)
        {
            var gameAsm = mem.FindModuleBase("GameAssembly.dll");
            if (gameAsm == nint.Zero) { Console.WriteLine("[roundstats] GameAssembly.dll not found."); proc?.Dispose(); return; }

            var klass = Il2CppClassResolver.Resolve(mem, gameAsm, 0, "BattleStatistics", "SharedModel.Battle.Core");
            if (klass == nint.Zero) { Console.WriteLine("[roundstats] BattleStatistics class not found."); proc?.Dispose(); return; }

            Console.WriteLine($"[roundstats] BattleStatistics klass=0x{klass:X}; scanning heap (this walks the whole address space and is slow)...");
            var nav = new Il2Cpp.Il2CppNavigator(mem, gameAsm);
            int found = 0, withHeroes = 0, errors = 0;
            var buf = new byte[8 * 1024 * 1024];

            foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
            {
                for (long off = 0; off < size && found < max; off += buf.Length)
                {
                    int chunk = (int)Math.Min(buf.Length, size - off);
                    var view = chunk == buf.Length ? buf : new byte[chunk];
                    if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                    for (int i = 0; i + 8 <= chunk && found < max; i += 8)
                    {
                        if (BitConverter.ToInt64(view, i) != (long)klass) continue;
                        var stats = (nint)((long)baseAddr + off + i);
                        found++;
                        if (found % 25 == 0) Console.WriteLine($"[roundstats]   ...{found} instance(s) seen, {withHeroes} populated, {errors} unreadable");
                        try {
                        var dict = mem.ReadPointer(stats + Il2Cpp.Il2CppOffsets.BStats_StatisticsByHero);
                        if (!ProcessMemory.IsValidPointer(dict)) continue;
                        var heroes = nav.IterateDictIntObj(dict).ToList();
                        if (heroes.Count == 0) continue;
                        withHeroes++;
                        Console.WriteLine();
                        Console.WriteLine($"[roundstats] BattleStatistics @0x{stats:X} — {heroes.Count} hero entry(ies)");
                        foreach (var (hk, hptr) in heroes)
                        {
                            if (!ProcessMemory.IsValidPointer(hptr)) continue;
                            int typeId = mem.ReadInt32(hptr + Il2Cpp.Il2CppOffsets.HS_TypeId);
                            int slot   = mem.ReadInt32(hptr + Il2Cpp.Il2CppOffsets.HS_Slot);
                            bool dead  = mem.ReadBool(hptr  + Il2Cpp.Il2CppOffsets.HS_IsDead);
                            var rd     = mem.ReadPointer(hptr + Il2Cpp.Il2CppOffsets.HS_StatsPerRound);
                            var rounds = ProcessMemory.IsValidPointer(rd) ? nav.IterateDictIntObj(rd).ToList() : new List<(int key, nint valuePtr)>();
                            Console.WriteLine($"   hero key={hk} typeId={typeId} slot={slot} isDead={dead} rounds={rounds.Count}");
                            foreach (var (rk, rptr) in rounds.OrderBy(r => r.key))
                            {
                                if (!ProcessMemory.IsValidPointer(rptr)) continue;
                                long hp0 = mem.ReadInt64(rptr + Il2Cpp.Il2CppOffsets.HBS_HpOnStart);
                                long hp1 = mem.ReadInt64(rptr + Il2Cpp.Il2CppOffsets.HBS_HpOnFinish);
                                int  trn = mem.ReadInt32(rptr + Il2Cpp.Il2CppOffsets.HBS_TurnsCount);
                                int  ke  = mem.ReadInt32(rptr + Il2Cpp.Il2CppOffsets.HBS_KilledEnemiesCount);
                                Console.WriteLine($"      round {rk,3}: hpStart={hp0 / 1000f,10:F0} hpFinish={hp1 / 1000f,10:F0} turns={trn,3} kills={ke}");
                            }
                        }
                        } catch { errors++; }   // garbage pointer — skip, never abort the scan
                    }
                }
            }
            Console.WriteLine();
            Console.WriteLine($"[roundstats] unreadable instances (bad pointers): {errors}");
            Console.WriteLine($"[roundstats] scanned: {found} BattleStatistics instance(s), {withHeroes} with a populated StatisticsByHero.");
            if (withHeroes == 0)
                Console.WriteLine("[roundstats] => the dictionary is cleared post-battle on every instance; per-round data needs IN-BATTLE sampling.");
        }
        proc?.Dispose();
    }

    /// <summary>
    /// PROBE (2026-08-10): can we read LIVE per-hero current HP DURING a battle? The game's
    /// per-round StatisticsByHero dict is empty both mid- and post-battle (see RoundStatsScan), so a
    /// ready-made timeline isn't readable. But BattleHero.CurrentHp (0x58) IS live — the plan is to
    /// SAMPLE it each poll and build the HP-over-time series ourselves. This confirms the live
    /// BattleHero objects are reachable + which offset holds current HP.
    ///
    /// Pause a battle mid-fight, then run --livehp. Prints every BattleHero with hp>0: typeId, slot,
    /// current HP. The player's team should show 5 rows with partial HP. Passive read.
    /// </summary>
    public static void LiveHpScan()
    {
        var (mem, proc) = Open();
        if (mem is null) return;
        using (mem)
        {
            var gameAsm = mem.FindModuleBase("GameAssembly.dll");
            if (gameAsm == nint.Zero) { Console.WriteLine("[livehp] GameAssembly.dll not found."); proc?.Dispose(); return; }

            // BattleHero lives in the live battle state; its namespace is unknown, so resolve by name
            // only and report the namespace we land on.
            nint klass = Il2CppClassResolver.ResolveByNameAny(mem, "BattleHero", out var usedNs);
            if (klass == nint.Zero) { Console.WriteLine("[livehp] no class named 'BattleHero' in memory (is a battle live? or the name differs)."); proc?.Dispose(); return; }
            Console.WriteLine($"[livehp] BattleHero klass=0x{klass:X} (ns={usedNs}); scanning heap...");

            int TID = Il2Cpp.Il2CppOffsets.BHero_TypeId, SLOT = Il2Cpp.Il2CppOffsets.BHero_Slot, HP = Il2Cpp.Il2CppOffsets.BHero_CurrentHp;
            var hits = new List<(nint addr, int tid, int slot, long hp)>();
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
                        var h = (nint)((long)baseAddr + off + i);
                        int tid = mem.ReadInt32(h + TID);
                        int slot = mem.ReadInt32(h + SLOT);
                        long hp = mem.ReadInt64(h + HP);
                        if (tid > 0 && tid < 100000 && hp > 0) hits.Add((h, tid, slot, hp));
                    }
                }
            }
            hits.Sort((a, b) => a.addr.CompareTo(b.addr));
            Console.WriteLine($"[livehp] {hits.Count} BattleHero instance(s) with hp>0 (showing up to 60):");
            foreach (var (addr, tid, slot, hp) in hits.Take(60))
                Console.WriteLine($"  @0x{addr:X}  typeId={tid,6}  slot={slot,3}  curHp={hp / 1000f,12:F0}  (raw={hp})");
            if (hits.Count == 0)
                Console.WriteLine("[livehp] none found — either no battle is live, or BattleHero's HP offset differs (try a fresh dump).");
        }
        proc?.Dispose();
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
