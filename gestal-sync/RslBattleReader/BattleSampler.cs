using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.Versioning;
using System.Text.Json;
using RslBattleReader.Il2Cpp;
using RslBattleReader.Memory;

namespace RslBattleReader;

/// <summary>
/// IN-BATTLE HP SAMPLER (2026-08-10). The game keeps NO readable per-round timeline
/// (StatisticsByHero is empty mid- and post-battle), so we BUILD the timeline ourselves by
/// sampling live BattleHero.CurrentHp — HP-over-time per champion (→ phase-at-death) AND boss
/// HP-over-time (→ damage-to-boss per turn, the CB/Dragon-calibration signal).
///
/// Live BattleHero = SharedModel.Battle.Core.Hero.BattleHero: typeId@0x18, slot@0x1C, curHp@0x58
/// (fixed-point; raw ÷ 2^32 ≈ HP). Allies = slots 0-4; enemies/boss = higher slots.
///
/// DESIGN: IL2CPP's GC is non-moving, so an object stays at its address for its lifetime — we read
/// HP cheaply at cached addresses each ~150ms. But multi-wave battles SPAWN new units after the
/// start (wave 2/3, the boss), so a one-time scan misses them. A background thread therefore
/// re-scans the heap every ~3s and merges newly-appeared BattleHero objects into the tracked set;
/// the fast main loop samples every tracked unit continuously. Stale objects from previous battles
/// are also picked up but filtered at emit time (only units whose HP actually MOVED are "live").
///
/// Passive read only. Usage: --samplebattle [maxSeconds]
/// </summary>
[SupportedOSPlatform("windows")]
internal static class BattleSampler
{
    private const int Hdr_Klass = 0x00;
    private const int BH_TypeId = 0x18;
    private const int BH_Slot   = 0x1C;
    private const int BH_CurHp  = 0x58;
    private const int BH_HeroState  = 0xC0; // → HeroState
    private const int BH_BattleStats = 0x88; // → BattleStats (maxHP@+0x10)
    private const int HS_Effects    = 0x38; // HeroState → List<AppliedEffect> (active buffs/debuffs)
    private const int List_SizeOff  = 0x18;
    private const int BS_MaxHp      = 0x10;
    private const double FIXED  = 4294967296.0; // 2^32

    private sealed record Unit(nint Addr, int TypeId, int Slot);

    private sealed class Track
    {
        public nint Addr; public int TypeId; public int Slot;
        public readonly List<long> T = new();   // tMs
        public readonly List<long> Hp = new();  // raw hp; -1 = freed/dead-read
        public readonly List<int> Debuffs = new(); // active-effect count at each sample (SampleOneBattle only)
        public readonly List<Dictionary<int, int>?> Kinds = new(); // per-sample debuff count by producer typeId (enemies only)
        public long RangeVal() { long mn = long.MaxValue, mx = long.MinValue; foreach (var v in Hp) { if (v < 0) continue; if (v < mn) mn = v; if (v > mx) mx = v; } return mx == long.MinValue ? 0 : mx - mn; }
        public long? FirstHp() { foreach (var v in Hp) if (v >= 0) return v; return null; }
        public long? LastHp() { for (int k = Hp.Count - 1; k >= 0; k--) if (Hp[k] >= 0) return Hp[k]; return null; }
    }

    public static void Run(int maxSeconds = 220)
    {
        Process? proc = null;
        foreach (var n in new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" })
        { var p = Process.GetProcessesByName(n); if (p.Length > 0) { proc = p[0]; break; } }
        if (proc is null) { Console.WriteLine("[sample] Raid not running."); return; }

        var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[sample] could not open process (run as admin)."); proc.Dispose(); return; }

        using (mem)
        {
            var gameAsm = mem.FindModuleBase("GameAssembly.dll");
            if (gameAsm == nint.Zero) { Console.WriteLine("[sample] GameAssembly.dll not found."); proc.Dispose(); return; }
            var klass = Il2CppClassResolver.ResolveByNameAny(mem, "BattleHero", out var ns);
            if (klass == nint.Zero) { Console.WriteLine("[sample] BattleHero class not found."); proc.Dispose(); return; }
            Console.WriteLine($"[sample] BattleHero klass=0x{klass:X} (ns={ns}). Waiting for an ACTIVE battle — start one now (up to 90s)…");

            // ── Phase 1: acquire (an ACTIVE slot 0-4 team) ──
            List<Unit>? seed = null;
            var acquireDeadline = DateTime.UtcNow.AddSeconds(90);
            while (DateTime.UtcNow < acquireDeadline)
            {
                var found = ScanUnits(mem, klass);
                if (found.Count(u => u.Slot is >= 0 and <= 4) >= 5 && LooksActive(mem, klass, found)) { seed = found; break; }
                Thread.Sleep(300);
            }
            if (seed is null) { Console.WriteLine("[sample] no active battle within 90s."); proc.Dispose(); return; }

            // ── Tracked set (address-keyed), grown by a background re-scan thread ──
            var tracks = new ConcurrentDictionary<long, Track>();
            void Merge(IEnumerable<Unit> us) { foreach (var u in us) tracks.TryAdd((long)u.Addr, new Track { Addr = u.Addr, TypeId = u.TypeId, Slot = u.Slot }); }
            Merge(seed);
            Console.WriteLine($"[sample] locked on {tracks.Count} unit(s); re-scanning for new spawns every ~3s while sampling…");

            bool stop = false;
            var rescan = new Thread(() =>
            {
                while (!stop)
                {
                    try { Merge(ScanUnits(mem, klass)); } catch { /* transient read failure — retry next cycle */ }
                    for (int s = 0; s < 30 && !stop; s++) Thread.Sleep(100); // ~3s, but responsive to stop
                }
            }) { IsBackground = true };
            rescan.Start();

            // ── Phase 2: fast-sample every tracked unit ──
            var sw = Stopwatch.StartNew();
            var lastSeen = new Dictionary<long, long>();
            long lastChangeMs = 0;
            while (sw.Elapsed.TotalSeconds < maxSeconds)
            {
                long t = sw.ElapsedMilliseconds;
                bool changed = false, anyLive = false;
                foreach (var kv in tracks)
                {
                    var tr = kv.Value;
                    long hp = mem.ReadPointer(tr.Addr + Hdr_Klass) == klass ? mem.ReadInt64(tr.Addr + BH_CurHp) : -1;
                    if (hp >= 0) anyLive = true;
                    tr.T.Add(t); tr.Hp.Add(hp);
                    if (lastSeen.TryGetValue(kv.Key, out var pv) && hp >= 0 && hp != pv) changed = true;
                    lastSeen[kv.Key] = hp;
                }
                if (changed) lastChangeMs = t;
                if (t > 5000 && !anyLive) { Console.WriteLine("[sample] all tracked units freed — battle ended."); break; }
                if (t > 10000 && t - lastChangeMs > 12000) { Console.WriteLine("[sample] no HP movement for 12s — battle ended."); break; }
                Thread.Sleep(150);
            }
            stop = true; rescan.Join(1000);
            sw.Stop();
            Console.WriteLine($"[sample] {tracks.Count} units tracked; sampled {sw.Elapsed.TotalSeconds:F1}s.");

            EmitSummary(tracks.Values.ToList());
            DumpJson(proc.Id, ns, tracks.Values.ToList());
        }
        proc.Dispose();
    }

    /// <summary>
    /// INSPECTION PASS (2026-08-10): dump the full field layout of a live ally BattleHero and the
    /// boss, to locate offsets for max HP, Turn Meter, and the buff/debuff list. Pause a battle
    /// mid-fight (ideally with debuffs on the boss), then run --inspecthero. Each slot shows the raw
    /// qword, its two int32s, the low int32 as a float (TM is usually a 0..1 float or 0..100), the
    /// qword ÷2^32 (HP-like Fixed values), and the class any pointer resolves to (List = a buff list).
    /// </summary>
    public static void InspectHeroes(int slots = 96)
    {
        Process? proc = null;
        foreach (var n in new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" })
        { var p = Process.GetProcessesByName(n); if (p.Length > 0) { proc = p[0]; break; } }
        if (proc is null) { Console.WriteLine("[inspecthero] Raid not running."); return; }
        var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[inspecthero] could not open process (admin?)."); proc.Dispose(); return; }
        using (mem)
        {
            var gameAsm = mem.FindModuleBase("GameAssembly.dll");
            var klass = Il2CppClassResolver.ResolveByNameAny(mem, "BattleHero", out var ns);
            if (klass == nint.Zero) { Console.WriteLine("[inspecthero] BattleHero class not found."); proc.Dispose(); return; }
            var units = ScanUnits(mem, klass);
            var ally = units.Where(u => u.Slot is >= 0 and <= 4).OrderBy(u => u.Slot).FirstOrDefault();
            var boss = units.Where(u => u.Slot > 4).OrderByDescending(u => mem.ReadInt64(u.Addr + BH_CurHp)).FirstOrDefault();
            foreach (var (label, u) in new[] { ("ALLY", ally), ("BOSS", boss) })
            {
                if (u is null) { Console.WriteLine($"[inspecthero] no {label} found."); continue; }
                Console.WriteLine($"\n===== {label}  @0x{u.Addr:X}  typeId={u.TypeId} slot={u.Slot}  (curHp@0x58={mem.ReadInt64(u.Addr + BH_CurHp) / FIXED:F0}) =====");
                for (int i = 0; i < slots; i++)
                {
                    int o = i * 8;
                    long q = mem.ReadInt64(u.Addr + o);
                    int lo = mem.ReadInt32(u.Addr + o), hi = mem.ReadInt32(u.Addr + o + 4);
                    float f = BitConverter.Int32BitsToSingle(lo);
                    string fx = (q > 1000 && q < 5_000_000_000_000_000L) ? $" fx={q / FIXED,10:F0}" : "";
                    string fs = (f > 0.0001f && f < 100000f) ? $" f32={f,10:F3}" : "";
                    string ann = "";
                    if (ProcessMemory.IsValidPointer((nint)q)) { var cn = ObjectInspector.ClassNameOf(mem, (nint)q); ann = cn != null ? $"  -> {cn}" : "  <ptr>"; }
                    Console.WriteLine($"  +0x{o:X3}: {q,20}  i32=({lo,11},{hi,6}){fs}{fx}{ann}");
                }
                Drill(mem, label, u.Addr);
            }
        }
        proc.Dispose();
    }

    /// <summary>Follow the interesting BattleHero sub-objects: HeroState (TM + flags), BattleStats
    /// (max HP + live stats), and every List field (size + element class → the buff/debuff list is a
    /// small List of effect objects).</summary>
    private static void Drill(ProcessMemory mem, string label, nint hero)
    {
        void DumpObj(string what, nint p, int n)
        {
            if (!ProcessMemory.IsValidPointer(p)) { Console.WriteLine($"  {what}: null"); return; }
            Console.WriteLine($"  {what} @0x{p:X} ({ObjectInspector.ClassNameOf(mem, p) ?? "?"}):");
            for (int i = 0; i < n; i++)
            {
                int o = i * 8; long q = mem.ReadInt64(p + o); int lo = mem.ReadInt32(p + o), hi = mem.ReadInt32(p + o + 4);
                float f = BitConverter.Int32BitsToSingle(lo);
                string fs = (Math.Abs(f) > 0.0001f && Math.Abs(f) < 1e7f) ? $" f32={f,10:F4}" : "";
                string fx = (q > 1000 && q < 5_000_000_000_000_000L) ? $" fx={q / FIXED,9:F0}" : "";
                string ann = ""; if (ProcessMemory.IsValidPointer((nint)q)) { var cn = ObjectInspector.ClassNameOf(mem, (nint)q); if (cn != null) ann = $" -> {cn}"; }
                Console.WriteLine($"      +0x{o:X2}: {q,18}  i32=({lo,11},{hi,6}){fs}{fx}{ann}");
            }
        }
        void DumpLists(string where, nint obj, int span)
        {
            for (int o = 0; o <= span; o += 8)
            {
                var p = mem.ReadPointer(obj + o);
                if (!ProcessMemory.IsValidPointer(p) || ObjectInspector.ClassNameOf(mem, p) != "System.Collections.Generic.List`1") continue;
                int size = mem.ReadInt32(p + 0x18); var items = mem.ReadPointer(p + 0x10);
                string el0 = "-"; if (size is > 0 and < 64 && ProcessMemory.IsValidPointer(items)) el0 = ObjectInspector.ClassNameOf(mem, mem.ReadPointer(items + 0x20)) ?? "?";
                Console.WriteLine($"      List @{where}+0x{o:X3}  size={size,3}  el0={el0}");
            }
        }

        Console.WriteLine($"\n--- DRILL {label} ---");
        var hs = mem.ReadPointer(hero + 0xC0);
        DumpObj("HeroState(0xC0)", hs, 20);
        Console.WriteLine("  Lists inside HeroState (buff/debuff candidates):");
        if (ProcessMemory.IsValidPointer(hs))
        {
            DumpLists("HS", hs, 0x100);
            var dict = mem.ReadPointer(hs + 0x70);
            if (ProcessMemory.IsValidPointer(dict)) Console.WriteLine($"      Dict @HS+0x070  count={mem.ReadInt32(dict + 0x20)}");

            // Decode the AppliedEffect elements (the actual debuffs/buffs) from HeroState+0x38.
            var lst = mem.ReadPointer(hs + 0x38);
            if (ProcessMemory.IsValidPointer(lst))
            {
                int size = mem.ReadInt32(lst + 0x18); var items = mem.ReadPointer(lst + 0x10);
                Console.WriteLine($"  AppliedEffect elements (HeroState+0x38, size {size}):");
                for (int e = 0; e < Math.Min(size, 6) && ProcessMemory.IsValidPointer(items); e++)
                    DumpObj($"[{e}]", mem.ReadPointer(items + 0x20 + e * 8), 24);
            }
        }
        Console.WriteLine("  BattleStats blocks (0x78/0x88/0x90/0x98) — first stat rows:");
        foreach (int so in new[] { 0x78, 0x88, 0x90, 0x98 })
        {
            var bs = mem.ReadPointer(hero + so);
            if (!ProcessMemory.IsValidPointer(bs)) continue;
            Console.Write($"      @hero+0x{so:X2}: ");
            for (int k = 0; k < 10; k++) { long v = mem.ReadInt64(bs + k * 8); Console.Write($"{v / FIXED:F0} "); }
            Console.WriteLine();
        }
        Console.WriteLine("  Skills list on the hero:");
        DumpLists("hero", hero, 0x300);
    }

    /// <summary>
    /// Sample ONE battle and return a compact timeline, or null if no active battle appeared within
    /// acquireWaitMs. Reuses the watcher's ProcessMemory + a pre-resolved BattleHero klass so the
    /// watcher can drive it on a background thread. Same acquire/track/re-scan logic as Run(), plus a
    /// per-sample boss debuff count. Ends ~12s after the last HP movement (after the result is
    /// already emitted — the watcher attaches this retroactively).
    /// </summary>
    public static Models.BattleTimeline? SampleOneBattle(ProcessMemory mem, nint klass, int acquireWaitMs, int maxSec, CancellationToken ct)
    {
        List<Unit>? seed = null;
        var deadline = DateTime.UtcNow.AddMilliseconds(acquireWaitMs);
        while (DateTime.UtcNow < deadline && !ct.IsCancellationRequested)
        {
            var found = ScanUnits(mem, klass);
            if (found.Count(u => u.Slot is >= 0 and <= 4) >= 5 && LooksActive(mem, klass, found)) { seed = found; break; }
            Thread.Sleep(300);
        }
        if (seed is null) return null;

        var tracks = new ConcurrentDictionary<long, Track>();
        void Merge(IEnumerable<Unit> us) { foreach (var u in us) tracks.TryAdd((long)u.Addr, new Track { Addr = u.Addr, TypeId = u.TypeId, Slot = u.Slot }); }
        Merge(seed);

        bool stop = false;
        var rescan = new Thread(() => { while (!stop) { try { Merge(ScanUnits(mem, klass)); } catch { } for (int s = 0; s < 30 && !stop; s++) Thread.Sleep(100); } }) { IsBackground = true };
        rescan.Start();

        var sw = Stopwatch.StartNew();
        var lastSeen = new Dictionary<long, long>();
        long lastChangeMs = 0;
        while (sw.Elapsed.TotalSeconds < maxSec && !ct.IsCancellationRequested)
        {
            long t = sw.ElapsedMilliseconds; bool changed = false, anyLive = false;
            foreach (var kv in tracks)
            {
                var tr = kv.Value; long hp = -1; int deb = 0; Dictionary<int, int>? kinds = null;
                if (mem.ReadPointer(tr.Addr + Hdr_Klass) == klass)
                {
                    anyLive = true; hp = mem.ReadInt64(tr.Addr + BH_CurHp);
                    if (tr.Slot > 4) (deb, kinds) = ReadDebuffBreakdown(mem, tr.Addr); // per-producer, enemies only
                }
                tr.T.Add(t); tr.Hp.Add(hp); tr.Debuffs.Add(deb); tr.Kinds.Add(kinds);
                if (lastSeen.TryGetValue(kv.Key, out var pv) && hp >= 0 && hp != pv) changed = true;
                lastSeen[kv.Key] = hp;
            }
            if (changed) lastChangeMs = t;
            if (t > 5000 && !anyLive) break;
            if (t > 10000 && t - lastChangeMs > 12000) break;
            Thread.Sleep(150);
        }
        stop = true; rescan.Join(1000); sw.Stop();
        return BuildTimeline(mem, klass, tracks.Values.ToList(), sw.Elapsed.TotalSeconds);
    }

    // Read a hero's active-effect list and group by PRODUCER champion typeId (effect+0x18 → BattleHero
    // → typeId@0x18). Returns (total, byProducer). Grouping by producer is the reliable, nameable kind
    // proxy — the true EffectType isn't at a fixed offset from the skill (see the effect-kind memory).
    private static (int total, Dictionary<int, int> byProducer) ReadDebuffBreakdown(ProcessMemory mem, nint hero)
    {
        var by = new Dictionary<int, int>();
        var hs = mem.ReadPointer(hero + BH_HeroState); if (!ProcessMemory.IsValidPointer(hs)) return (0, by);
        var lst = mem.ReadPointer(hs + HS_Effects); if (!ProcessMemory.IsValidPointer(lst)) return (0, by);
        int n = mem.ReadInt32(lst + List_SizeOff); if (n is < 0 or >= 64) return (0, by);
        var items = mem.ReadPointer(lst + 0x10); if (!ProcessMemory.IsValidPointer(items)) return (n, by);
        for (int e = 0; e < n; e++)
        {
            var eff = mem.ReadPointer(items + 0x20 + e * 8); if (!ProcessMemory.IsValidPointer(eff)) continue;
            var prod = mem.ReadPointer(eff + 0x18); if (!ProcessMemory.IsValidPointer(prod)) continue;
            int tid = mem.ReadInt32(prod + BH_TypeId);
            if (tid is > 0 and < 100000) by[tid] = by.GetValueOrDefault(tid) + 1;
        }
        return (n, by);
    }

    private static Models.BattleTimeline BuildTimeline(ProcessMemory mem, nint klass, List<Track> tracks, double durSec)
    {
        var allies = new List<Models.TimelineHero>();
        for (int slot = 0; slot <= 4; slot++)
        {
            var cands = tracks.Where(t => t.Slot == slot).ToList();
            if (cands.Count == 0) continue;
            var tr = cands.OrderByDescending(t => t.RangeVal()).First(); // varying copy = live
            var sv = tr.FirstHp(); if (sv is null) continue;
            long start = sv.Value, end = tr.LastHp() ?? start, min = start; double? death = null;
            for (int k = 0; k < tr.Hp.Count; k++) { if (tr.Hp[k] > 0) min = Math.Min(min, tr.Hp[k]); if (death is null && tr.Hp[k] == 0) death = tr.T[k] / 1000.0; }
            allies.Add(new Models.TimelineHero { Slot = slot, TypeId = tr.TypeId, StartHp = start, EndHp = end, MinHp = min, DeathSec = death });
        }

        var enemies = tracks.Where(t => t.Slot > 4 && t.RangeVal() > 0 && t.FirstHp() is not null).ToList();
        Models.TimelineBoss? boss = null;
        if (enemies.Count > 0)
        {
            var b = enemies.OrderByDescending(t => t.FirstHp()!.Value).First();
            long start = b.FirstHp()!.Value, end = b.LastHp()!.Value, maxHp = start;
            if (mem.ReadPointer(b.Addr + Hdr_Klass) == klass) { var bs = mem.ReadPointer(b.Addr + BH_BattleStats); if (ProcessMemory.IsValidPointer(bs)) { long m = mem.ReadInt64(bs + BS_MaxHp); if (m > start && m < 50_000_000_000_000_000L) maxHp = m; } }
            var trace = new List<Models.TimelinePoint>();
            int n = b.Hp.Count, pts = Math.Min(20, n);
            for (int k = 0; k < pts; k++)
            {
                int j = pts <= 1 ? 0 : k * (n - 1) / (pts - 1);
                if (b.Hp[j] < 0) continue;
                var by = j < b.Kinds.Count ? b.Kinds[j] : null;
                trace.Add(new Models.TimelinePoint { TSec = b.T[j] / 1000.0, Hp = b.Hp[j], Debuffs = j < b.Debuffs.Count ? b.Debuffs[j] : 0, ByProducer = by is { Count: > 0 } ? by : null });
            }
            boss = new Models.TimelineBoss { Slot = b.Slot, TypeId = b.TypeId, MaxHp = maxHp, StartHp = start, EndHp = end, Trace = trace };
        }
        return new Models.BattleTimeline { FixedDivisor = FIXED, DurationSec = durSec, FrameCount = tracks.Count == 0 ? 0 : tracks.Max(t => t.Hp.Count), Allies = allies, Boss = boss };
    }

    /// <summary>
    /// EFFECT-KIND PROBE (2026-08-10): dump the boss's AppliedEffect objects to find where the
    /// debuff KIND (Poison / Decrease DEF / HP Burn …) is encoded. Per effect: key int fields,
    /// producer typeId, and its source BattleSkill — scanning both for any pointer that resolves to
    /// an EffectType/Kind class or a readable name string. Run on a boss whose debuffs you KNOW, then
    /// correlate. Usage: --inspecteffect
    /// </summary>
    public static void InspectEffects()
    {
        Process? proc = null;
        foreach (var n in new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" })
        { var p = Process.GetProcessesByName(n); if (p.Length > 0) { proc = p[0]; break; } }
        if (proc is null) { Console.WriteLine("[inspecteffect] Raid not running."); return; }
        var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[inspecteffect] could not open process."); proc.Dispose(); return; }
        using (mem)
        {
            var klass = Il2CppClassResolver.ResolveByNameAny(mem, "BattleHero", out _);
            if (klass == nint.Zero) { Console.WriteLine("[inspecteffect] BattleHero not found."); proc.Dispose(); return; }
            var units = ScanUnits(mem, klass);
            var boss = units.Where(u => u.Slot > 4).OrderByDescending(u => mem.ReadInt64(u.Addr + BH_CurHp)).FirstOrDefault();
            if (boss is null) { Console.WriteLine("[inspecteffect] no boss/enemy found."); proc.Dispose(); return; }

            // Try to read an IL2CPP System.String (len@0x10, UTF-16 chars@0x14).
            string? Str(nint p)
            {
                if (!ProcessMemory.IsValidPointer(p)) return null;
                int len = mem.ReadInt32(p + 0x10);
                if (len is < 1 or > 96) return null;
                var bytes = new byte[len * 2];
                if (!mem.TryReadBytes(p + 0x14, bytes)) return null;
                var s = System.Text.Encoding.Unicode.GetString(bytes);
                return s.All(c => c >= ' ' && c < 0x7f) ? s : null; // printable ASCII only
            }
            void ScanForKind(string where, nint obj, int span)
            {
                for (int o = 0; o <= span; o += 8)
                {
                    var p = mem.ReadPointer(obj + o);
                    if (!ProcessMemory.IsValidPointer(p)) continue;
                    var cn = ObjectInspector.ClassNameOf(mem, p);
                    var s = Str(p);
                    if (s != null) Console.WriteLine($"      {where}+0x{o:X3}: string \"{s}\"");
                    else if (cn != null && (cn.Contains("Effect") || cn.Contains("Kind") || cn.Contains("Type") || cn.Contains("Skill")))
                        Console.WriteLine($"      {where}+0x{o:X3}: -> {cn}  @0x{p:X}");
                }
            }

            var hs = mem.ReadPointer(boss.Addr + BH_HeroState);
            var lst = ProcessMemory.IsValidPointer(hs) ? mem.ReadPointer(hs + HS_Effects) : nint.Zero;
            int size = ProcessMemory.IsValidPointer(lst) ? mem.ReadInt32(lst + List_SizeOff) : 0;
            var items = ProcessMemory.IsValidPointer(lst) ? mem.ReadPointer(lst + 0x10) : nint.Zero;
            Console.WriteLine($"[inspecteffect] boss typeId {boss.TypeId} slot {boss.Slot}: {size} effect(s)");
            for (int e = 0; e < Math.Min(size, 8) && ProcessMemory.IsValidPointer(items); e++)
            {
                var eff = mem.ReadPointer(items + 0x20 + e * 8);
                if (!ProcessMemory.IsValidPointer(eff)) continue;
                var prod = mem.ReadPointer(eff + 0x18);
                int prodTid = ProcessMemory.IsValidPointer(prod) ? mem.ReadInt32(prod + BH_TypeId) : -1;
                Console.WriteLine($"\n  Effect[{e}] @0x{eff:X}  producerTypeId={prodTid}  " +
                                  $"turns(0x48)={mem.ReadInt32(eff + 0x48)}  " +
                                  $"ints: 0x10={mem.ReadInt32(eff + 0x10)} 0x14={mem.ReadInt32(eff + 0x14)} " +
                                  $"0x28={mem.ReadInt64(eff + 0x28)} 0x38lo={mem.ReadInt32(eff + 0x38)} 0x38hi={mem.ReadInt32(eff + 0x3C)} " +
                                  $"0x40lo={mem.ReadInt32(eff + 0x40)} 0x40hi={mem.ReadInt32(eff + 0x44)}");
                Console.WriteLine("    scan EFFECT for kind/type/string:");
                ScanForKind("eff", eff, 0x80);
                var skill = mem.ReadPointer(eff + 0x30);
                if (ProcessMemory.IsValidPointer(skill))
                {
                    Console.WriteLine($"    skill @0x{skill:X} ({ObjectInspector.ClassNameOf(mem, skill)}) — scan for kind/type/string:");
                    ScanForKind("skill", skill, 0x140);
                }
            }
        }
        proc.Dispose();
    }

    /// <summary>Read an IL2CPP System.String at addr (len@0x10, UTF-16 chars@0x14). Usage: --readstr &lt;hexAddr&gt;</summary>
    public static void ReadStringAt(long addr)
    {
        Process? proc = null;
        foreach (var n in new[] { "Raid", "RaidShadowLegends", "Raid Shadow Legends" })
        { var p = Process.GetProcessesByName(n); if (p.Length > 0) { proc = p[0]; break; } }
        if (proc is null) { Console.WriteLine("[readstr] Raid not running."); return; }
        var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[readstr] could not open process."); proc.Dispose(); return; }
        using (mem)
        {
            int len = mem.ReadInt32((nint)addr + 0x10);
            if (len is < 1 or > 512) { Console.WriteLine($"[readstr] @0x{addr:X} not a string (len={len})."); proc.Dispose(); return; }
            var bytes = new byte[len * 2];
            if (!mem.TryReadBytes((nint)addr + 0x14, bytes)) { Console.WriteLine("[readstr] read failed."); proc.Dispose(); return; }
            Console.WriteLine($"[readstr] @0x{addr:X} len={len}: \"{System.Text.Encoding.Unicode.GetString(bytes)}\"");
        }
        proc.Dispose();
    }

    private static List<Unit> ScanUnits(ProcessMemory mem, nint klass)
    {
        var units = new List<Unit>();
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
                    var a = (nint)((long)baseAddr + off + i);
                    int tid = mem.ReadInt32(a + BH_TypeId), slot = mem.ReadInt32(a + BH_Slot);
                    long hp = mem.ReadInt64(a + BH_CurHp);
                    if (tid > 0 && tid < 100000 && hp > 0 && slot is >= 0 and < 60) units.Add(new Unit(a, tid, slot));
                }
            }
        }
        return units;
    }

    private static bool LooksActive(ProcessMemory mem, nint klass, List<Unit> units)
    {
        var first = units.Select(u => mem.ReadPointer(u.Addr + Hdr_Klass) == klass ? mem.ReadInt64(u.Addr + BH_CurHp) : long.MinValue).ToArray();
        var changed = new HashSet<int>();
        for (int probe = 0; probe < 20; probe++)
        {
            Thread.Sleep(150);
            for (int i = 0; i < units.Count; i++)
            {
                if (mem.ReadPointer(units[i].Addr + Hdr_Klass) != klass) continue;
                if (mem.ReadInt64(units[i].Addr + BH_CurHp) != first[i]) changed.Add(i);
            }
            if (changed.Count >= 2) return true;
        }
        return false;
    }

    private static void EmitSummary(List<Track> tracks)
    {
        if (tracks.Count == 0) { Console.WriteLine("[sample] no units."); return; }
        double Hp(long raw) => raw <= 0 ? raw : raw / FIXED;

        Console.WriteLine("\n-- ALLIES (live copy per slot) --");
        for (int slot = 0; slot <= 4; slot++)
        {
            var cands = tracks.Where(t => t.Slot == slot).ToList();
            if (cands.Count == 0) continue;
            var tr = cands.OrderByDescending(t => t.RangeVal()).First(); // the copy that moved = live
            var sv = tr.FirstHp();
            if (sv is null) { Console.WriteLine($"  slot {slot}  typeId {tr.TypeId,6}  (no valid samples)"); continue; }
            long start = sv.Value, end = tr.LastHp() ?? start, minHp = start, deathMs = -1;
            for (int k = 0; k < tr.Hp.Count; k++) { if (tr.Hp[k] > 0) minHp = Math.Min(minHp, tr.Hp[k]); if (deathMs < 0 && tr.Hp[k] == 0) deathMs = tr.T[k]; }
            Console.WriteLine($"  slot {slot}  typeId {tr.TypeId,6}  {Hp(start),10:F0} -> {Hp(end),10:F0}  (min {Hp(minHp),8:F0})  " +
                              (deathMs >= 0 ? $"DIED @ {deathMs / 1000.0:F1}s" : "survived") + (tr.RangeVal() == 0 ? "  [STATIC]" : ""));
        }

        // Live enemies = enemy-slot units that actually LOST HP (filters stale/frozen leftovers).
        var enemies = tracks.Where(t => t.Slot > 4 && t.RangeVal() > 0 && t.FirstHp() is not null).ToList();
        Console.WriteLine("\n-- ENEMIES that took damage (the live battle) --");
        if (enemies.Count == 0) { Console.WriteLine("  (none varied)"); return; }
        foreach (var tr in enemies.OrderByDescending(t => t.FirstHp()!.Value).Take(8))
            Console.WriteLine($"  slot {tr.Slot,3}  typeId {tr.TypeId,6}  HP {Hp(tr.FirstHp()!.Value),12:F0} -> {Hp(tr.LastHp()!.Value),12:F0}  dmg {Hp(tr.FirstHp()!.Value - tr.LastHp()!.Value),12:F0}");
        var boss = enemies.OrderByDescending(t => t.FirstHp()!.Value).First();
        var pts = new List<string>();
        int n = boss.Hp.Count;
        for (int k = 0; k < 12; k++) { int j = Math.Min(n - 1, k * n / 12); if (boss.Hp[j] >= 0) pts.Add($"{boss.T[j] / 1000.0:F0}s:{Hp(boss.Hp[j]):F0}"); }
        Console.WriteLine($"\n  BOSS (slot {boss.Slot}, typeId {boss.TypeId}) HP trace: " + string.Join("  ", pts));
    }

    private static void DumpJson(int pid, string ns, List<Track> tracks)
    {
        var dir = Path.Combine(Directory.GetCurrentDirectory(), "battle-samples");
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, $"sample_{DateTime.Now:HHmmss}.json");
        var payload = new
        {
            capturedAt = DateTime.Now.ToString("o"), pid, battleHeroNs = ns, fixedDivisor = FIXED,
            units = tracks.Select(t => new { addr = t.Addr.ToString("X"), t.TypeId, t.Slot, t = t.T, hp = t.Hp }),
        };
        File.WriteAllText(path, JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = false }));
        Console.WriteLine($"[sample] full timeline → {path}  ({tracks.Count} units)");
    }
}
