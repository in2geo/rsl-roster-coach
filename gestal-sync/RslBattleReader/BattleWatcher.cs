using System.Diagnostics;
using System.Runtime.Versioning;
using System.Text.Json;
using RslBattleReader.Account;
using RslBattleReader.Il2Cpp;
using RslBattleReader.Memory;
using RslBattleReader.Models;
using RslBattleReader.MsgPack;
using static RslBattleReader.Il2Cpp.Il2CppOffsets;

namespace RslBattleReader;

[SupportedOSPlatform("windows")]
internal sealed class BattleWatcher(string outputPath)
{
    private static readonly string[] ProcessNames = ["Raid", "RaidShadowLegends", "Raid Shadow Legends"];
    private static readonly TimeSpan AttachRetry  = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(2);

    // Plarium writes this file after every battle — use it as a reliable trigger
    private static readonly string BattleResultsFile =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + "Low",
                     @"Plarium\Raid_ Shadow Legends\battle-results\battleResults");

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented       = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters          = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };

    // Holds the on-disk entry shape so the log survives restarts: it's loaded from
    // battle-log.json on startup and appended to, instead of starting empty.
    private readonly List<BattleLogEntry> _log = [];
    private readonly object _captureLock = new();

    private DateTime _lastFileWrite = DateTime.MinValue;
    // Last-write-time (ticks) of the battleResults file already processed by the fast
    // poller — the change-detection gate that stops it re-parsing the same result.
    private long _lastWriteTicks = 0;

    // Shared with the file-capture path so it can read the authoritative StageId
    // from the live game's BattleSetup at capture time. Set while attached.
    private ProcessMemory?  _mem;
    private Il2CppNavigator? _nav;

    // The game's in-memory results cache is transient (populated then cleared around
    // battle-end, like the file). Polling it in the 100ms file loop catches the
    // StageId the instant it appears, instead of racing it only at file-capture time.
    private int _lastMemBattleCount = -1;
    private (int stageId, int kindId, DateTime at)? _latestMemSetup;
    // Wall-clock timing snapshotted from the live BattleResult before the game clears its
    // cache (same reason as _latestMemSetup). duration/speed feed the <5-min success metric.
    private (float duration, float? speed, int? turns, DateTime at)? _latestMemTiming;
    // Per-hero stats (survival, kills, …) keyed by inventory heroId, snapshotted the
    // moment the battle appears in the cache. Joined to the file-built hero list.
    private (Dictionary<int, HeroStatSnapshot> stats, DateTime at)? _latestMemHeroStats;
    private bool _pendingHeroStats;   // a battle is present but its stats dict hasn't filled yet
    private int  _heroStatsTries;
    // Per-hero survival read from BattleResult.FinalState → ally BattleTeam (current HP 0 = dead),
    // keyed by team slot. StatisticsByHero is empty post-battle, so this is the survival source.
    private (Dictionary<int, (int typeId, bool survived)> map, DateTime at)? _latestSurvival;

    // ── Entry point ───────────────────────────────────────────────────────────

    public async Task RunAsync(CancellationToken ct)
    {
        LoadExistingLog();
        Console.WriteLine($"[RslBattleReader] output → {outputPath}");
        Console.WriteLine($"[watch] battle-results file: {BattleResultsFile}");
        if (File.Exists(BattleResultsFile))
        {
            _lastFileWrite = File.GetLastWriteTimeUtc(BattleResultsFile);
            Console.WriteLine($"[watch] file exists, last write = {_lastFileWrite:HH:mm:ss}");
        }
        else
            Console.WriteLine("[warn] battle-results file not found — file trigger disabled");

        // Poll at 100ms to catch momentary result writes before the game clears them
        _ = Task.Run(() => FastFilePollerAsync(ct), ct);

        while (!ct.IsCancellationRequested)
        {
            var proc = FindRaidProcess();
            if (proc is null)
            {
                Console.WriteLine($"[wait] Raid not running — retrying in {AttachRetry.TotalSeconds}s…");
                await Task.Delay(AttachRetry, ct);
                continue;
            }

            Console.WriteLine($"[attach] PID {proc.Id} — {proc.ProcessName}");
            await PollProcessAsync(proc, ct);

            if (!ct.IsCancellationRequested)
            {
                Console.WriteLine("[detach] Process ended — waiting for restart…");
                await Task.Delay(AttachRetry, ct);
            }
        }
    }

    // ── Process polling ───────────────────────────────────────────────────────

    private async Task PollProcessAsync(Process proc, CancellationToken ct)
    {
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null)
        {
            Console.WriteLine("[error] Could not open process — run as Administrator?");
            return;
        }

        var gameAssemblyBase = mem.FindModuleBase("GameAssembly.dll");
        if (gameAssemblyBase == nint.Zero)
        {
            Console.WriteLine("[error] GameAssembly.dll not found in process modules");
            return;
        }

        var nav      = new Il2CppNavigator(mem, gameAssemblyBase);
        _mem = mem; _nav = nav;   // expose to the file-capture path for StageId reads
        int prevCount   = -1;
        int failedResolve = 0;

        try
        {
        while (!ct.IsCancellationRequested && !proc.HasExited)
        {
            var appModel = nav.ResolveAppModelInstance();
            if (!ProcessMemory.IsValidPointer(appModel))
            {
                failedResolve++;
                if (failedResolve == 1 || failedResolve % 30 == 0)
                    Console.WriteLine($"[warn] AppModel not resolved yet (attempt {failedResolve}) — game may still be loading");
                await Task.Delay(PollInterval, ct);
                continue;
            }

            if (prevCount == -1)
            {
                Console.WriteLine("[ready] AppModel confirmed — file poller is capturing battles.");
                // One-shot: verify the StageId memory path against whatever battles
                // are already in this session's cache (e.g. the last fight).
                int cached = nav.ReadBattleResultCount(appModel);
                var s = ReadLatestBattleSetup();
                Console.WriteLine($"[stageid-check] cached battle results={cached} " +
                                  $"latest stageId={s?.stageId.ToString() ?? "?"} kindId={s?.kindId.ToString() ?? "?"}");
                prevCount = 0;
            }

            await Task.Delay(PollInterval, ct);
        }
        }
        finally { _mem = null; _nav = null; }
    }

    /// <summary>
    /// Reads the authoritative (StageId, BattleKindId) from the latest BattleResult
    /// in the live game's memory cache. Returns null if not attached / unreadable.
    /// Called from the file-capture path the moment a battle is captured — the just-
    /// finished battle is the last element of the in-memory results list.
    /// </summary>
    private (int stageId, int kindId)? ReadLatestBattleSetup()
    {
        // Prefer the value the 100ms poller caught when the battle appeared (the
        // cache may already be cleared by the time the file capture runs).
        if (_latestMemSetup is { } s && (DateTime.UtcNow - s.at).TotalSeconds < 15)
            return (s.stageId, s.kindId);
        return ReadLatestBattleSetupDirect();
    }

    private (int stageId, int kindId)? ReadLatestBattleSetupDirect()
    {
        var mem = _mem; var nav = _nav;
        if (mem is null || nav is null) return null;
        try
        {
            var appModel = nav.ResolveAppModelInstance();
            if (!ProcessMemory.IsValidPointer(appModel)) return null;
            int count = nav.ReadBattleResultCount(appModel);
            if (count <= 0) return null;

            var ptrs = nav.ReadBattleResultPointers(appModel, count - 1);
            if (ptrs.Count == 0) return null;

            var setupPtr = mem.ReadPointer(ptrs[^1] + BR_Setup);
            if (!ProcessMemory.IsValidPointer(setupPtr)) return null;

            int stageId = mem.ReadInt32(setupPtr + BS_StageId);
            int kindId  = mem.ReadInt32(setupPtr + BS_KindId);
            return (stageId, kindId);
        }
        catch { return null; }
    }

    /// <summary>Wall-clock timing (duration seconds, speed multiplier, ally turns) from the
    /// latest BattleResult. Prefers the poller's cached snapshot (the cache can clear before
    /// file capture runs); falls back to a direct read. Mirrors ReadLatestBattleSetup.</summary>
    private (float duration, float? speed, int? turns)? ReadLatestBattleTiming()
    {
        if (_latestMemTiming is { } t && (DateTime.UtcNow - t.at).TotalSeconds < 15)
            return (t.duration, t.speed, t.turns);
        return ReadLatestBattleTimingDirect();
    }

    private (float duration, float? speed, int? turns)? ReadLatestBattleTimingDirect()
    {
        var mem = _mem; var nav = _nav;
        if (mem is null || nav is null) return null;
        try
        {
            var appModel = nav.ResolveAppModelInstance();
            if (!ProcessMemory.IsValidPointer(appModel)) return null;
            int count = nav.ReadBattleResultCount(appModel);
            if (count <= 0) return null;

            var ptrs = nav.ReadBattleResultPointers(appModel, count - 1);
            if (ptrs.Count == 0) return null;

            var brPtr = ptrs[^1];
            float duration        = mem.ReadFloat(brPtr + BR_DurationSeconds);
            var (speed, hasSpeed) = mem.ReadNullableFloat(brPtr, BR_BattleSpeed);
            var (turns, hasTurns) = mem.ReadNullableInt(brPtr, BR_AllyTurns);
            return (duration, hasSpeed ? speed : (float?)null, hasTurns ? turns : (int?)null);
        }
        catch { return null; }
    }

    /// <summary>
    /// Polls the in-memory results cache (called every 100ms from the file loop).
    /// When a new result appears, snapshots its StageId/KindId before the game can
    /// clear the cache. Resets its high-water mark if the cache is cleared/shrinks.
    /// </summary>
    private void PollMemoryStageId()
    {
        var setup = ReadLatestBattleSetupDirect();
        var mem = _mem; var nav = _nav;
        if (mem is null || nav is null) return;
        try
        {
            var appModel = nav.ResolveAppModelInstance();
            if (!ProcessMemory.IsValidPointer(appModel)) return;
            int count = nav.ReadBattleResultCount(appModel);
            if (count < 0) return;
            if (count > _lastMemBattleCount)
            {
                if (setup is { } s) _latestMemSetup = (s.stageId, s.kindId, DateTime.UtcNow);
                if (ReadLatestBattleTimingDirect() is { } t0)
                    _latestMemTiming = (t0.duration, t0.speed, t0.turns, DateTime.UtcNow);
                _pendingHeroStats = true;       // new battle — start trying to grab stats
                _heroStatsTries = 0;
                // Opt-in per-battle memory diagnostics (RSL_DEBUG_HEROES=1) for future offset work.
                if (_debugHeroes)
                {
                    _debugBattle = true;
                    _finalStateDumpedThisBattle = false;
                    try { File.AppendAllText(HeroDebugPath, $"\n===== NEW BATTLE stageId={setup?.stageId.ToString() ?? "?"} kindId={setup?.kindId.ToString() ?? "?"} count={count} @{DateTime.Now:HH:mm:ss.fff} =====\n"); } catch { }
                }
            }
            // Per-hero statistics populate lazily (a beat after the result is cached),
            // so keep retrying each tick while the result is present until the dict
            // fills — instead of reading once at the empty moment.
            if (_pendingHeroStats && count > 0)
            {
                // Survival from FinalState → ally BattleTeam (the working source) — snapshot as
                // soon as it reads, before the result cache is cleared.
                var surv = ReadAllySurvivalDirect();
                if (surv.Count > 0) _latestSurvival = (surv, DateTime.UtcNow);

                // Duration can finalize a beat after the result is cached — keep refreshing
                // until a non-zero duration is seen (mirrors the lazy hero-stats read).
                if ((_latestMemTiming?.duration ?? 0f) <= 0f
                    && ReadLatestBattleTimingDirect() is { duration: > 0f } t1)
                    _latestMemTiming = (t1.duration, t1.speed, t1.turns, DateTime.UtcNow);

                if (_debugBattle && !_finalStateDumpedThisBattle) _finalStateDumpedThisBattle = DumpFinalState();
                var hs = ReadLatestHeroStatsDirect(_debugBattle);
                _heroStatsTries++;
                if (hs.Count > 0) { _latestMemHeroStats = (hs, DateTime.UtcNow); _pendingHeroStats = false; _debugBattle = false; }
                else if (_heroStatsTries > 20) { _pendingHeroStats = false; _debugBattle = false; }
            }
            if (count == 0) _pendingHeroStats = false;  // result gone from cache
            _lastMemBattleCount = count;   // also moves down on cache clear/reset
        }
        catch { }
    }

    private static readonly string HeroDebugPath =
        Path.Combine(AppContext.BaseDirectory, "hero-debug.txt");

    private bool _debugBattle;                 // dump survival diagnostics for the current battle
    private bool _finalStateDumpedThisBattle;  // FinalState probe succeeded for the current battle
    private readonly bool _debugHeroes = Environment.GetEnvironmentVariable("RSL_DEBUG_HEROES") == "1";

    /// <summary>
    /// One-shot probe of BattleResult.FinalState (0x28) — the end-of-battle state,
    /// which (unlike the empty StatisticsByHero) should hold per-hero alive/dead.
    /// Dumps the object layout + candidate hero collections so the format can be mapped.
    /// </summary>
    private bool DumpFinalState()
    {
        var mem = _mem; var nav = _nav;
        if (mem is null || nav is null) return false;
        void Dbg(string m) { try { File.AppendAllText(HeroDebugPath, $"{DateTime.Now:HH:mm:ss.fff} {m}\n"); } catch { } }
        try
        {
            var appModel = nav.ResolveAppModelInstance();
            if (!ProcessMemory.IsValidPointer(appModel)) return false;
            int count = nav.ReadBattleResultCount(appModel);
            if (count <= 0) return false;
            var ptrs = nav.ReadBattleResultPointers(appModel, count - 1);
            if (ptrs.Count == 0) return false;
            var br = ptrs[^1];

            var fs = mem.ReadPointer(br + BR_FinalState);
            Dbg($"=== FinalState probe: br=0x{br:X} FinalState=0x{fs:X} valid={ProcessMemory.IsValidPointer(fs)} ===");
            if (!ProcessMemory.IsValidPointer(fs)) return false;

            // FinalState object slots — find collection pointers.
            for (int o = 0x10; o <= 0x80; o += 8)
            {
                long q = mem.ReadInt64(fs + o);
                bool ptr = ProcessMemory.IsValidPointer((nint)q);
                int dcnt = ptr ? mem.ReadInt32((nint)q + Dict_Count) : 0;   // dict count @0x20
                int lsz  = ptr ? mem.ReadInt32((nint)q + List_Size) : 0;    // list size @0x18
                Dbg($"  +0x{o:X2}: 0x{q:X16}{(ptr ? $" <ptr> dictCnt@20={dcnt} listSz@18={lsz}" : "")}");
            }

            // Probe each pointer field as a List<obj> and as a Dict<int,obj>, dumping
            // entries' int32s across 0x10-0x50 to spot heroIds (1/3/8/12/30) + a dead flag.
            for (int field = 0x10; field <= 0x80; field += 8)
            {
                var coll = mem.ReadPointer(fs + field);
                if (!ProcessMemory.IsValidPointer(coll)) continue;
                int lsz = mem.ReadInt32(coll + List_Size);
                if (lsz is > 0 and <= 30)
                {
                    var arr = mem.ReadPointer(coll + List_BackingArray);
                    if (ProcessMemory.IsValidPointer(arr))
                    {
                        Dbg($"  -- field +0x{field:X2} as List (size={lsz}) --");
                        for (int e = 0; e < Math.Min(lsz, 12); e++)
                        {
                            var ep = mem.ReadPointer(arr + Array_DataOffset + e * 8);
                            if (!ProcessMemory.IsValidPointer(ep)) continue;
                            // int32s (ids/typeId/flags) then int64s (HP is a Fixed long, /1000)
                            var sb = new System.Text.StringBuilder($"    [{e}] @0x{ep:X} i32:");
                            for (int fo = 0x10; fo <= 0x70; fo += 4)
                                sb.Append($" +{fo:X2}={mem.ReadInt32(ep + fo)}");
                            Dbg(sb.ToString());
                            var sb2 = new System.Text.StringBuilder($"        i64:");
                            for (int fo = 0x10; fo <= 0x70; fo += 8)
                                sb2.Append($" +{fo:X2}={mem.ReadInt64(ep + fo)}");
                            Dbg(sb2.ToString());
                        }
                    }
                }
            }
            return true;
        }
        catch (Exception ex) { Dbg("FinalState EX " + ex.Message); return false; }
    }

    /// <summary>heroId → per-hero stats for the latest BattleResult (allies + enemies).</summary>
    private Dictionary<int, HeroStatSnapshot> ReadLatestHeroStatsDirect(bool debug = false)
    {
        var result = new Dictionary<int, HeroStatSnapshot>();
        var mem = _mem; var nav = _nav;
        if (mem is null || nav is null) return result;
        void Dbg(string m) { if (debug) try { File.AppendAllText(HeroDebugPath, $"{DateTime.Now:HH:mm:ss.fff} {m}\n"); } catch { } }
        try
        {
            var appModel = nav.ResolveAppModelInstance();
            if (!ProcessMemory.IsValidPointer(appModel)) { Dbg("appModel invalid"); return result; }
            int count = nav.ReadBattleResultCount(appModel);
            if (count <= 0) { Dbg($"count={count}"); return result; }

            var ptrs = nav.ReadBattleResultPointers(appModel, count - 1);
            if (ptrs.Count == 0) { Dbg("no result ptrs"); return result; }
            var br = ptrs[^1];

            var statsPtr = mem.ReadPointer(br + BR_Statistics);
            Dbg($"count={count} br=0x{br:X} statsPtr=0x{statsPtr:X} valid={ProcessMemory.IsValidPointer(statsPtr)}");
            if (!ProcessMemory.IsValidPointer(statsPtr)) return result;

            var heroDictPtr = mem.ReadPointer(statsPtr + BStats_StatisticsByHero);
            int dictCount = ProcessMemory.IsValidPointer(heroDictPtr) ? mem.ReadInt32(heroDictPtr + Dict_Count) : -1;
            Dbg($"heroDictPtr=0x{heroDictPtr:X} valid={ProcessMemory.IsValidPointer(heroDictPtr)} dictCount={dictCount}");

            if (debug)
            {
                // Dump BattleStatistics object slots to find the real per-hero collection.
                Dbg("  -- BattleStatistics slots --");
                for (int o = 0x10; o <= 0x70; o += 8)
                {
                    long q = mem.ReadInt64(statsPtr + o);
                    bool ptr = ProcessMemory.IsValidPointer((nint)q);
                    int cnt = ptr ? mem.ReadInt32((nint)q + Dict_Count) : 0;
                    Dbg($"    +0x{o:X2}: 0x{q:X16} {(ptr ? $"<ptr> [+0x20]={cnt}" : "")}");
                }
                // Probe each candidate collection field as a Dictionary<int,obj> and
                // dump entries' value int32s at the HeroStatistics field offsets
                // (Id 0x18, InvHeroId 0x1C, TypeId 0x24, IsDead 0x40) to spot heroes.
                foreach (int field in new[] { 0x10, 0x18, 0x20, 0x30, 0x40, 0x60, 0x70 })
                {
                    var coll = mem.ReadPointer(statsPtr + field);
                    if (!ProcessMemory.IsValidPointer(coll)) continue;
                    int cnt = mem.ReadInt32(coll + Dict_Count);
                    if (cnt <= 0 || cnt > 30) continue;
                    Dbg($"  -- probe field +0x{field:X2} as dict (count={cnt}) --");
                    int shown = 0;
                    foreach (var (key, vp) in nav.IterateDictIntObj(coll))
                    {
                        if (shown++ >= 8) break;
                        if (!ProcessMemory.IsValidPointer(vp)) { Dbg($"    key={key} val=invalid"); continue; }
                        Dbg($"    key={key} val: id={mem.ReadInt32(vp + 0x18)} inv={mem.ReadInt32(vp + 0x1C)} typeId={mem.ReadInt32(vp + 0x24)} grade={mem.ReadInt32(vp + 0x28)} lvl={mem.ReadInt32(vp + 0x2C)} dead@40={mem.ReadBool(vp + 0x40)}");
                    }
                }
            }

            int n = 0;
            foreach (var (key, heroPtr) in nav.IterateDictIntObj(heroDictPtr))
            {
                var h = ReadHeroStat(mem, nav, heroPtr);
                if (h is not null)
                {
                    result[h.InventoryHeroId] = h;
                    if (n < 6) Dbg($"  entry key={key} ptr=0x{heroPtr:X} invHeroId={h.InventoryHeroId} typeId={h.TypeId} isDead={h.IsDead} kills={h.KilledEnemiesCount}");
                }
                n++;
            }
            Dbg($"iterated {n} entries, kept {result.Count}");
        }
        catch (Exception ex) { Dbg("EX " + ex.Message); }
        return result;
    }

    private Dictionary<int, HeroStatSnapshot> ReadLatestHeroStats()
    {
        if (_latestMemHeroStats is { } mh && (DateTime.UtcNow - mh.at).TotalSeconds < 15)
            return mh.stats;
        return ReadLatestHeroStatsDirect();
    }

    /// <summary>
    /// Per-hero survival for the latest battle, keyed by team slot: BattleResult.FinalState →
    /// ally BattleTeam → List&lt;BattleHero&gt;, survived = current HP (Fixed @0x58) is nonzero.
    /// The combat-side survival source (StatisticsByHero is empty post-battle).
    /// </summary>
    private Dictionary<int, (int typeId, bool survived)> ReadAllySurvivalDirect()
    {
        var result = new Dictionary<int, (int, bool)>();
        var mem = _mem; var nav = _nav;
        if (mem is null || nav is null) return result;
        try
        {
            var appModel = nav.ResolveAppModelInstance();
            if (!ProcessMemory.IsValidPointer(appModel)) return result;
            int count = nav.ReadBattleResultCount(appModel);
            if (count <= 0) return result;
            var ptrs = nav.ReadBattleResultPointers(appModel, count - 1);
            if (ptrs.Count == 0) return result;

            var fs = mem.ReadPointer(ptrs[^1] + BR_FinalState);
            if (!ProcessMemory.IsValidPointer(fs)) return result;
            var team = mem.ReadPointer(fs + BState_AllyTeam);
            if (!ProcessMemory.IsValidPointer(team)) return result;
            var list = mem.ReadPointer(team + BTeam_Heroes);
            if (!ProcessMemory.IsValidPointer(list)) return result;
            var arr = mem.ReadPointer(list + List_BackingArray);
            int size = mem.ReadInt32(list + List_Size);
            if (!ProcessMemory.IsValidPointer(arr) || size is <= 0 or > 10) return result;

            for (int i = 0; i < size; i++)
            {
                var hero = mem.ReadPointer(arr + Array_DataOffset + i * Array_ElementSize);
                if (!ProcessMemory.IsValidPointer(hero)) continue;
                int typeId = mem.ReadInt32(hero + BHero_TypeId);
                int slot   = mem.ReadInt32(hero + BHero_Slot);
                long hp    = mem.ReadInt64(hero + BHero_CurrentHp);
                result[slot] = (typeId, hp != 0);
            }
        }
        catch { }
        return result;
    }

    private Dictionary<int, (int typeId, bool survived)> ReadLatestSurvival()
    {
        if (_latestSurvival is { } s && (DateTime.UtcNow - s.at).TotalSeconds < 15)
            return s.map;
        return ReadAllySurvivalDirect();
    }

    // Dungeons whose result screen exposes per-hero damage via BattleFinishDungeonDialogContext
    // (same HeroBattleStatsContext structure as Clan Boss; solved 2026-07-15, verified on IG-10 loss).
    private static readonly HashSet<string> DamageDungeons = new()
        { "Ice Golem's Peak", "Fire Knight's Castle", "Spider's Den", "Dragon's Lair" };

    /// <summary>
    /// Reads total + per-hero damage from the live result dialog's view-model and stamps the
    /// snapshot. Clan Boss uses the AllianceBoss dialog; the four dungeons use the Dungeon dialog
    /// (same hero-stats structure). The file/combat StatisticsByHero carry no damage. The dialog can
    /// appear a beat after the file write, so it retries briefly. No-op for other content.
    /// </summary>
    private void TryAttachBattleDamage(BattleResultSnapshot snapshot)
    {
        bool isCb = snapshot.Dungeon == "Clan Boss";
        bool isDungeon = DamageDungeons.Contains(snapshot.Dungeon ?? "");
        if (!isCb && !isDungeon) return;
        var mem = _mem;
        if (mem is null) return;
        string tag = isCb ? "cbdamage" : "dungeondamage";

        // Retry, keeping the result with the MOST heroes — the dialog can appear a beat after the
        // file write and the per-hero stat contexts can populate progressively.
        CbDamageReader.CbResult? res = null;
        for (int attempt = 0; attempt < 5; attempt++)
        {
            var r = isCb ? CbDamageReader.Capture(mem) : CbDamageReader.CaptureDungeon(mem);
            if (r is not null && (res is null || r.Heroes.Count > res.Heroes.Count)) res = r;
            if (res is not null && res.Heroes.Count >= 5) break;   // full team — done
            Thread.Sleep(200);
        }
        if (res is null) { Console.WriteLine($"[{tag}] {snapshot.Dungeon} battle but result dialog not readable"); return; }

        snapshot.TotalDamageDealt = res.TotalDamage;

        // Join per-hero damage by slot — both the file heroes and the dialog hero list are
        // in screen left-to-right order.
        if (snapshot.Heroes.Count > 0)
        {
            // Carry the WHOLE HeroDamage record, not just Damage: CbDamageReader already reads the
            // dialog's other two per-hero bars (Defense +0x098, Healing +0x0A0) and this join used to
            // drop them one line after they were read. Healing in particular is what makes a support
            // measurable — a healer's damage bar understates them by design (CLAUDE.md §4).
            var bySlot = res.Heroes.ToDictionary(h => h.Slot);
            snapshot.Heroes = snapshot.Heroes
                .Select(h => bySlot.TryGetValue(h.Slot, out var s)
                    ? h with { Damage = s.Damage, Defense = s.Defense, Healing = s.Healing }
                    : h)
                .ToList();
            // CaptureDungeon matches EVERY HeroBattleStatsContext by class — in a dungeon boss room that
            // also includes the BOSS (FK = 5 allies + Fyro = 6 contexts), whose "damage" is damage IT dealt
            // to you, not team output. The boss context is the one NOT joined to a roster hero, so the TEAM
            // total is the sum of the joined per-hero damages — NOT res.TotalDamage (which folds in the boss).
            long teamTotal = snapshot.Heroes.Sum(h => h.Damage ?? 0);
            if (teamTotal > 0) snapshot.TotalDamageDealt = teamTotal;
        }
        Console.WriteLine($"[{tag}] team damage = {snapshot.TotalDamageDealt} (raw {res.TotalDamage} over {res.Heroes.Count} context(s))");
    }

    // ── BattleResult reader ───────────────────────────────────────────────────

    private static BattleResultSnapshot? ReadBattleResult(
        ProcessMemory mem, Il2CppNavigator nav, nint ptr)
    {
        if (!ProcessMemory.IsValidPointer(ptr)) return null;

        var resultType   = (BattleResultType) mem.ReadInt32(ptr + BR_ResultType);
        var finishCause  = (BattleFinishCause)mem.ReadInt32(ptr + BR_FinishCause);
        float duration   = mem.ReadFloat(ptr + BR_DurationSeconds);
        bool manual      = mem.ReadBool(ptr  + BR_ManualSkillUsed);

        var (allyTurns, hasAllyTurns)     = mem.ReadNullableInt(ptr, BR_AllyTurns);
        var (battleSpeed, hasBattleSpeed) = mem.ReadNullableFloat(ptr, BR_BattleSpeed);

        // BattleSetup
        var setupPtr = mem.ReadPointer(ptr + BR_Setup);
        BattleSetupSnapshot? setup = null;
        if (ProcessMemory.IsValidPointer(setupPtr))
        {
            var guid    = mem.ReadGuid(setupPtr + BS_Id);
            int kindId  = mem.ReadInt32(setupPtr + BS_KindId);
            int stageId = mem.ReadInt32(setupPtr + BS_StageId);
            setup = new() { Id = guid.ToString(), KindId = kindId, StageId = stageId };
        }

        // BattleStatistics → hero stats
        var heroStats = new List<HeroStatSnapshot>();
        var statsPtr  = mem.ReadPointer(ptr + BR_Statistics);
        if (ProcessMemory.IsValidPointer(statsPtr))
        {
            var heroDictPtr = mem.ReadPointer(statsPtr + BStats_StatisticsByHero);
            foreach (var (_, heroPtr) in nav.IterateDictIntObj(heroDictPtr))
            {
                var h = ReadHeroStat(mem, nav, heroPtr);
                if (h is not null) heroStats.Add(h);
            }
        }

        return new BattleResultSnapshot
        {
            CapturedAt     = DateTime.UtcNow.ToString("o"),
            ResultType     = resultType,
            FinishCause    = finishCause,
            DurationSeconds = duration,
            AllyTurns      = hasAllyTurns ? allyTurns : null,
            BattleSpeed    = hasBattleSpeed ? battleSpeed : null,
            ManualSkillUsed = manual,
            Setup          = setup,
            HeroStats      = heroStats,
        };
    }

    private static HeroStatSnapshot? ReadHeroStat(
        ProcessMemory mem, Il2CppNavigator nav, nint ptr)
    {
        if (!ProcessMemory.IsValidPointer(ptr)) return null;

        int inventoryId = mem.ReadInt32(ptr + HS_InventoryHeroId);
        int battleId    = mem.ReadInt32(ptr + HS_Id);
        int typeId      = mem.ReadInt32(ptr + HS_TypeId);
        int grade       = mem.ReadInt32(ptr + HS_Grade);
        int level       = mem.ReadInt32(ptr + HS_Level);
        int slot        = mem.ReadInt32(ptr + HS_Slot);
        bool isDead     = mem.ReadBool(ptr  + HS_IsDead);

        int killedEnemies = 0, killedAllies = 0, turns = 0;
        long hpOnStart = 0, hpOnFinish = 0;
        bool gotFirstRound = false, gotLastRound = false;
        int  lastRoundKey = -1;

        var roundsDict = mem.ReadPointer(ptr + HS_StatsPerRound);
        var rounds     = nav.IterateDictIntObj(roundsDict).ToList();

        foreach (var (rk, _) in rounds)
            if (rk > lastRoundKey) lastRoundKey = rk;

        foreach (var (roundKey, roundPtr) in rounds)
        {
            if (!ProcessMemory.IsValidPointer(roundPtr)) continue;
            killedEnemies += mem.ReadInt32(roundPtr + HBS_KilledEnemiesCount);
            killedAllies  += mem.ReadInt32(roundPtr + HBS_KilledAlliesCount);
            turns         += mem.ReadInt32(roundPtr + HBS_TurnsCount);

            if (!gotFirstRound)
            {
                hpOnStart    = mem.ReadInt64(roundPtr + HBS_HpOnStart);
                gotFirstRound = true;
            }
            if (roundKey == lastRoundKey)
            {
                hpOnFinish  = mem.ReadInt64(roundPtr + HBS_HpOnFinish);
                gotLastRound = true;
            }
        }

        return new HeroStatSnapshot
        {
            InventoryHeroId   = inventoryId,
            BattleHeroId      = battleId,
            TypeId            = typeId,
            Grade             = grade,
            Level             = level,
            Slot              = slot,
            IsDead            = isDead,
            KilledEnemiesCount = killedEnemies,
            KilledAlliesCount  = killedAllies,
            TurnsCount         = turns,
            HpOnStart          = gotFirstRound ? hpOnStart  / 1000f : 0f,
            HpOnFinish         = gotLastRound  ? hpOnFinish / 1000f : 0f,
        };
    }

    // ── Fast file poller ─────────────────────────────────────────────────────

    private async Task FastFilePollerAsync(CancellationToken ct)
    {
        const int EmptySize = 11;
        // Skip the battle already sitting in the file at startup — it's already in the
        // loaded log; we only want NEW battles from here on.
        if (File.Exists(BattleResultsFile))
            try { _lastWriteTicks = File.GetLastWriteTimeUtc(BattleResultsFile).Ticks; } catch { }

        while (!ct.IsCancellationRequested)
        {
            try
            {
                // Catch the transient in-memory StageId as soon as the battle appears.
                PollMemoryStageId();

                if (File.Exists(BattleResultsFile))
                {
                    // Only touch the file when its CONTENT changed. The game rewrites this
                    // single-slot file once per battle, so last-write-time is a reliable
                    // change signal. Without this the poller re-read + re-parsed the SAME
                    // result every 100ms whenever the game left the file un-cleared —
                    // spinning forever (the [FAST] flood that dropped a whole Spider run
                    // 2026-07-12) and burning CPU. Now we process each write exactly once.
                    long ticks;
                    try { ticks = File.GetLastWriteTimeUtc(BattleResultsFile).Ticks; }
                    catch { ticks = _lastWriteTicks; }

                    if (ticks != _lastWriteTicks)
                    {
                        _lastWriteTicks = ticks;
                        // Read bytes immediately while file is open — game clears it within ~200ms
                        using var fs = new FileStream(BattleResultsFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                        if (fs.Length > EmptySize)
                        {
                            var bytes = new byte[fs.Length];
                            fs.ReadExactly(bytes);
                            var ts = DateTime.Now.ToString("HH:mm:ss.fff");
                            Console.WriteLine($"[FAST] new result: {bytes.Length} bytes at {ts}");
                            TryCaptureFromFile(bytes);
                        }
                    }
                }
            }
            catch { /* ignore transient errors */ }
            await Task.Delay(100, ct);
        }
    }

    private void TryCaptureFromFile(byte[] bytes)
    {
        lock (_captureLock)
        {
            try
            {
                var snapshots = BattleFileParser.ParseAll(bytes);
                if (snapshots.Count == 0) return;

                // Resolve which account these battles belong to (per capture, so
                // switching accounts in Gestal is reflected immediately).
                var account = AccountResolver.Resolve();
                var roster  = RosterLookup.ForAccount(account.AccountId);

                // Authoritative stage id from the live game's BattleSetup (the file
                // has no stage number for shared-id dungeons). Read once per capture.
                var memSetup = ReadLatestBattleSetup();
                // Wall-clock timing from the live BattleResult (the file carries none). TIME is
                // the audience's real success metric, so this is stamped onto every entry.
                var memTiming = ReadLatestBattleTiming();

                bool any = false;
                foreach (var snapshot in snapshots)
                {
                    snapshot.AccountId    = account.AccountId;
                    snapshot.DisplayName  = account.DisplayName;
                    snapshot.StageId      = memSetup?.stageId;
                    snapshot.BattleKindId = memSetup?.kindId;
                    if (memTiming is { } tm)
                    {
                        snapshot.DurationSeconds = tm.duration;
                        snapshot.BattleSpeed     = tm.speed;
                    }

                    // Authoritative stage number from the in-memory StageId: the last
                    // 3 digits are the stage (verified Ice Golem 8/9/10 = 2079008/009/
                    // 010). Overrides the fingerprint, and resolves the stage for
                    // shared-id dungeons the fingerprint can't split. Falls back to the
                    // fingerprint value when StageId is unavailable.
                    if (snapshot.StageId is int sid && sid > 1000)
                    {
                        int sn = sid % 1000;
                        snapshot.StageNumber = sn;
                        // StageId prefix → dungeon is authoritative and more complete than
                        // the per-stage encounter-id map, so prefer it; fall back to the
                        // encounter-id/fingerprint dungeon when the prefix is unmapped.
                        var dg = DungeonId.DungeonFromStageId(sid) ?? snapshot.Dungeon;
                        if (dg is not null)
                        {
                            snapshot.Dungeon = dg;
                            snapshot.StageLabel = $"{dg} Stage {sn}";
                        }
                    }

                    // Keep only the player's champions: a candidate is an ally iff its
                    // heroId maps to a roster champion whose typeId agrees. Match on the
                    // LOW BYTE only, not the full u16: in Clan Boss captures the hero
                    // record can land in the file's columnar/stats region where the two
                    // bytes before the "h" key put the correct typeId low byte but a
                    // GARBAGE high byte (e.g. Pelops 0x41B0 vs the real 0x28B0), which the
                    // full-u16 match dropped. heroId (unique per account) + low byte is
                    // enough to separate allies from enemies (validated on the Brutal
                    // dumps: recovers Pelops, still rejects Seeker/Valerie). Re-slot
                    // 0..n in file order and attach the canonical name + full typeId.
                    // Ascension-tolerant identity: typeId = baseTypeId + ascension (0..6). A champion
                    // the player ascends between Gestal syncs shifts its typeId by up to 6, so an exact
                    // low-byte match drops it (observed: Klodd, ascended +2 after the snapshot, vanished
                    // from a 5-champ capture). heroId is the primary key at every call site here, so a
                    // ±6 low-byte window (wrap-safe) only needs to reject enemy/coincidental collisions.
                    static bool SameChamp(int a, int b) { int d = ((a & 0xFF) - (b & 0xFF) + 256) % 256; return d <= 6 || d >= 250; }

                    int slot = 0;
                    var preFilter = snapshot.Heroes;   // keep the raw file list for recovery + debug
                    snapshot.Heroes = preFilter
                        .Where(h => roster.TryGetValue(h.HeroId, out var c) && SameChamp(c.TypeId, h.TypeId))
                        .Select(h => h with
                        {
                            Slot   = slot++,
                            TypeId = roster[h.HeroId].TypeId,
                            Name   = roster[h.HeroId].Name,
                        })
                        .ToList();
                    if (_debugHeroes)
                        try { File.AppendAllText(HeroDebugPath, $"[filter] file={preFilter.Count} kept={snapshot.Heroes.Count} dropped=[{string.Join(", ", preFilter.Where(h => !(roster.TryGetValue(h.HeroId, out var c) && SameChamp(c.TypeId, h.TypeId))).Select(h => $"hid={h.HeroId} fileTid=0x{h.TypeId:X} inRoster={roster.ContainsKey(h.HeroId)}"))}]\n"); } catch { }

                    // Leader (aura source) = slot 0 = first hero in file order =
                    // left-most on the battle-result screen. Confirmed on labeled
                    // battles (Pelops/AK10, Staltus/Ice Golem) and corroborated by the
                    // explicit leader-ref record (a1 74 <typeId> a1 75 <heroId>) which
                    // points to the same slot-0 champion.
                    if (snapshot.Heroes.Count > 0)
                        snapshot.Heroes[0] = snapshot.Heroes[0] with { IsLeader = true };

                    // Enrich with kills from the in-memory hero statistics (joined by heroId).
                    // Leaves them null when the stats weren't read.
                    var memHeroStats = ReadLatestHeroStats();
                    if (memHeroStats.Count > 0)
                        snapshot.Heroes = snapshot.Heroes
                            .Select(h => memHeroStats.TryGetValue(h.HeroId, out var st)
                                ? h with { Survived = !st.IsDead, Kills = st.KilledEnemiesCount }
                                : h)
                            .ToList();

                    // Survival from FinalState → ally BattleTeam (current HP 0 = dead), joined by
                    // team slot with a typeId low-byte identity check (ascension-tolerant). This is
                    // the working survival source — StatisticsByHero above is empty post-battle.
                    var survival = ReadLatestSurvival();

                    // RECOVER any fielded champ the file filter dropped (the same failure its own comment
                    // flags — "rejects Seeker/Valerie" — when the file's typeId low-byte is garbage). A
                    // dropped file hero whose heroId IS in the roster is a valid champ: trust the heroId
                    // (roster gives the correct name + typeId) and confirm it is a REAL ally by matching its
                    // typeId low-byte to the combat-memory ally team (survival). Additive; identity only —
                    // true slot + survival are assigned in the pass below.
                    if (survival.Count > snapshot.Heroes.Count)
                    {
                        var have = snapshot.Heroes.Select(h => h.TypeId & 0xFF).ToHashSet();
                        foreach (var h in preFilter)
                        {
                            if (!roster.TryGetValue(h.HeroId, out var c)) continue;
                            int lb = c.TypeId & 0xFF;
                            if (have.Contains(lb) || !survival.Values.Any(sv => SameChamp(sv.typeId, c.TypeId))) continue;
                            snapshot.Heroes.Add(new BattleHero { HeroId = h.HeroId, TypeId = c.TypeId, Name = c.Name });
                            have.Add(lb);
                            if (_debugHeroes) try { File.AppendAllText(HeroDebugPath, $"[recover] +{c.Name} tid=0x{c.TypeId:X}\n"); } catch { }
                        }
                    }

                    // Assign TRUE team slots + survival from the combat-memory ally team, CONSUMING each
                    // slot once. The file's re-index (0..n) shifts every hero after a dropped one, which
                    // corrupts the screen-order damage join AND the survival lookup; true slots fix both
                    // and prevent a recovered hero from colliding with a re-indexed one.
                    if (survival.Count > 0)
                    {
                        var avail = survival.OrderBy(kv => kv.Key).ToList();
                        var used = new HashSet<int>();
                        snapshot.Heroes = snapshot.Heroes.Select(h =>
                        {
                            int i = avail.FindIndex(kv => !used.Contains(kv.Key) && SameChamp(kv.Value.typeId, h.TypeId));
                            if (i < 0) return h;
                            used.Add(avail[i].Key);
                            return h with { Slot = avail[i].Key, Survived = avail[i].Value.survived };
                        }).OrderBy(h => h.Slot).ToList();
                    }

                    // Clan Boss total damage — read from the result dialog's view-model in
                    // memory (the file/StatisticsByHero carry no damage). Gated to CB; feeds
                    // the chest-tier pipeline.
                    TryAttachBattleDamage(snapshot);

                    var entry = BattleLogEntry.From(snapshot);

                    // Deduplicate: skip if identical result already logged within 5 seconds
                    if (_log.Count > 0)
                    {
                        var last = _log[^1];
                        if (last.Result == entry.Result &&
                            last.Stage == entry.Stage &&
                            last.Turns == entry.Turns &&
                            last.AccountId == entry.AccountId &&
                            DateTime.TryParse(last.CapturedAt, out var lastTime) &&
                            (DateTime.UtcNow - lastTime).TotalSeconds < 5)
                            continue;
                    }

                    _log.Add(entry);
                    var who = account.DisplayName ?? account.AccountId ?? "unknown account";
                    Console.WriteLine($"[captured] {who} — {entry.Result} — {entry.Stage ?? "unknown stage"} " +
                                      $"turns={entry.Turns?.ToString() ?? "?"} " +
                                      $"stageId={entry.StageId?.ToString() ?? "?"} kindId={entry.BattleKindId?.ToString() ?? "?"}");
                    any = true;
                }
                if (any) Flush();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[parse] error: {ex.Message}");
            }
        }
    }

    // ── File parsing ─────────────────────────────────────────────────────────


    // ── Output ────────────────────────────────────────────────────────────────

    private void Flush()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
        File.WriteAllText(outputPath, JsonSerializer.Serialize(_log, JsonOpts));
        Console.WriteLine($"[flush] {_log.Count} result(s) → {outputPath}");
    }

    // Load any existing battle-log.json so history persists across reader restarts
    // (the in-memory list used to start empty, wiping the file on the next flush).
    private void LoadExistingLog()
    {
        try
        {
            if (!File.Exists(outputPath)) return;
            var existing = JsonSerializer.Deserialize<List<BattleLogEntry>>(
                File.ReadAllText(outputPath), JsonOpts);
            if (existing is { Count: > 0 })
            {
                _log.AddRange(existing);
                Console.WriteLine($"[load] {existing.Count} existing battle(s) from {outputPath}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[load] could not read existing log ({ex.Message}) — starting fresh");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Process? FindRaidProcess()
    {
        foreach (var name in ProcessNames)
        {
            var procs = Process.GetProcessesByName(name);
            if (procs.Length > 0) return procs[0];
        }
        return null;
    }
}
