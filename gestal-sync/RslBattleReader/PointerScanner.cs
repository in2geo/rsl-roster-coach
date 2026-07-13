using System.Diagnostics;
using System.Runtime.Versioning;
using RslBattleReader.Il2Cpp;
using RslBattleReader.Memory;

namespace RslBattleReader;

/// <summary>
/// Backward pointer scanner — the second half of the CB total-damage capture work.
///
/// <see cref="MemoryScanner"/> (--scan) locates the per-hero damage cluster, but only at a
/// RUNTIME address that changes every battle. To auto-capture we need a STABLE pointer chain
/// from a fixed root down to that cluster. This tool finds one:
///
///   1. Level 1: scan every readable region for an 8-byte value that points at (or just below,
///      within maxOffset of) the target cluster. Each such location is a pointer FIELD holding
///      the cluster's object.
///   2. Level k: repeat, now hunting pointers to the level-(k-1) field locations — i.e. walk
///      UP the object graph one hop per level.
///   3. A location that lands inside a loaded module image (a static global) or inside the
///      AppModel object is a STABLE ROOT. Every root yields a candidate chain
///      "GameAssembly.dll+0xRVA → [o1,o2,…] (+finalOff) ⇒ target", which we then VERIFY by
///      dereferencing it live and confirming it lands back on the cluster.
///
/// The winning chain's offsets go into Il2CppOffsets.cs; ReadBattleResult reads the array.
/// Static-global RVAs are re-verified per patch exactly like the existing TypeInfo RVAs.
///
/// Usage:  RslBattleReader.exe --ptrscan &lt;targetHexFromScan&gt; [maxDepth=6] [maxOffsetHex=800]
/// PASSIVE READ ONLY — no injection (CLAUDE.md boundary).
/// </summary>
[SupportedOSPlatform("windows")]
internal static class PointerScanner
{
    private sealed class Node
    {
        public long   Loc;       // address of the pointer field (*Loc == ObjBase)
        public long   ObjBase;   // value stored at Loc
        public int    Off;       // childAddr - ObjBase (offset within the object to the child)
        public int    Level;     // 1-based; level-1 nodes have child == target
        public int    ChildIdx;  // index into the level-(Level-1) node list, or -1 if child is target
        public string? Root;     // non-null when Loc is a stable anchor (module+RVA or AppModel+off)
    }

    public static void Run(long target, int maxDepth, int maxOffset)
    {
        var proc = FindRaid();
        if (proc is null) { Console.WriteLine("[ptrscan] Raid not running."); return; }
        using var mem = ProcessMemory.OpenById(proc.Id);
        if (mem is null) { Console.WriteLine("[ptrscan] could not open process (run as admin)."); return; }

        var gameAsm = mem.FindModuleBase("GameAssembly.dll");
        var modules = mem.EnumerateModules().ToList();
        Console.WriteLine($"[ptrscan] target=0x{target:X}  maxDepth={maxDepth}  maxOffset=0x{maxOffset:X}");
        Console.WriteLine($"[ptrscan] {modules.Count} modules loaded; GameAssembly.dll base=0x{(long)gameAsm:X}");

        // AppModel is a heap object we can already resolve stably — treat its object window
        // as a root anchor too (a chain rooted there is as stable as the static-global ones).
        long appModel = 0;
        if (gameAsm != nint.Zero)
            appModel = (long)new Il2CppNavigator(mem, gameAsm).ResolveAppModelInstance();
        Console.WriteLine($"[ptrscan] AppModel=0x{appModel:X}");
        const int AppModelWindow = 0x1000;

        var regions = mem.EnumerateAllReadableRegions().ToList();
        long minAddr = long.MaxValue, maxAddr = 0;
        foreach (var (b, s) in regions) { minAddr = Math.Min(minAddr, (long)b); maxAddr = Math.Max(maxAddr, (long)b + s); }
        Console.WriteLine($"[ptrscan] {regions.Count} readable regions, addr span 0x{minAddr:X}–0x{maxAddr:X}");

        string? RootOf(long loc)
        {
            if (appModel > 0 && loc >= appModel && loc < appModel + AppModelWindow)
                return $"AppModel+0x{loc - appModel:X}";
            foreach (var (name, mbase, msize) in modules)
                if (loc >= (long)mbase && loc < (long)mbase + msize)
                    return $"{name}+0x{loc - (long)mbase:X}";
            return null;
        }

        var levels = new List<List<Node>>();
        var seenLoc = new HashSet<long>();
        var roots = new List<Node>();

        long[] wanted = { target };
        var wantedIdx = new Dictionary<long, int> { [target] = -1 };
        var buf = new byte[8 * 1024 * 1024];
        const int LevelCap = 60000;

        for (int level = 1; level <= maxDepth; level++)
        {
            Array.Sort(wanted);
            long wLow = wanted[0] - maxOffset, wHigh = wanted[^1];
            var nodes = new List<Node>();

            foreach (var (baseAddr, size) in regions)
            {
                for (long off = 0; off < size; off += buf.Length)
                {
                    int chunk = (int)Math.Min(buf.Length, size - off);
                    var view = chunk == buf.Length ? buf : new byte[chunk];
                    if (!mem.TryReadBytes((nint)((long)baseAddr + off), view)) continue;
                    for (int i = 0; i + 8 <= chunk; i += 8)   // 8-byte aligned pointer fields
                    {
                        long p = BitConverter.ToInt64(view, i);
                        if (p < wLow || p > wHigh) continue;      // cheap reject
                        if (p < minAddr || p >= maxAddr) continue; // must look like a heap pointer
                        int lo = LowerBound(wanted, p);
                        for (int k = lo; k < wanted.Length && wanted[k] <= p + maxOffset; k++)
                        {
                            long w = wanted[k];
                            long loc = (long)baseAddr + off + i;
                            if (!seenLoc.Add(loc)) continue;      // avoid cycles / reuse across levels
                            var node = new Node
                            {
                                Loc = loc, ObjBase = p, Off = (int)(w - p),
                                Level = level, ChildIdx = wantedIdx[w], Root = RootOf(loc),
                            };
                            nodes.Add(node);
                            if (node.Root != null) roots.Add(node);
                            break;   // one (closest) wanted per pointer is enough
                        }
                    }
                }
            }

            Console.WriteLine($"[ptrscan] level {level}: {nodes.Count} pointer(s); roots so far {roots.Count}");
            levels.Add(nodes);
            if (nodes.Count == 0) break;

            if (nodes.Count > LevelCap)   // keep the smallest offsets — most likely real struct fields
            {
                nodes.Sort((a, b) => a.Off.CompareTo(b.Off));
                nodes.RemoveRange(LevelCap, nodes.Count - LevelCap);
            }

            wanted = new long[nodes.Count];
            wantedIdx = new Dictionary<long, int>(nodes.Count);
            for (int n = 0; n < nodes.Count; n++) { wanted[n] = nodes[n].Loc; wantedIdx[nodes[n].Loc] = n; }
        }

        ReportChains(mem, levels, roots, target);
        proc.Dispose();
    }

    private static void ReportChains(ProcessMemory mem, List<List<Node>> levels, List<Node> roots, long target)
    {
        if (roots.Count == 0)
        {
            Console.WriteLine("\n[ptrscan] no stable-root chains found. Try a larger --maxOffset or more depth, " +
                              "and confirm the result screen is still open (the target address must be live).");
            return;
        }

        // Keep only plausible IL2CPP chains: rooted in GameAssembly.dll or AppModel (foreign
        // DLL .data holding a pointer-shaped value is coincidental), with every hop 8-byte
        // aligned (real reference fields are pointer-aligned; 0x501/0x49C etc. are noise).
        var clean = roots
            .Select(r => (r, offs: Reconstruct(levels, r)))
            .Where(t => (t.r.Root!.StartsWith("GameAssembly.dll") || t.r.Root!.StartsWith("AppModel"))
                        && t.offs.All(o => (o & 7) == 0))
            .OrderBy(t => t.r.Level)
            .ThenBy(t => t.offs.Sum(o => (long)o))
            .ToList();

        Console.WriteLine($"\n[ptrscan] {roots.Count} raw root(s); {clean.Count} aligned GameAssembly/AppModel chain(s). " +
                          "Showing up to 25 with per-hop class names:\n");
        int shown = 0;
        var seenChains = new HashSet<string>();
        foreach (var (r, offs) in clean)
        {
            var key = r.Root + ":" + string.Join(",", offs);
            if (!seenChains.Add(key)) continue;

            var bases = new List<long>();
            long resolved = Resolve(mem, r.Loc, offs, bases);
            bool ok = resolved == target;

            var parts = new List<string> { r.Root! };
            for (int i = 0; i < offs.Count; i++)
            {
                // bases[i] is the object we're about to index at offs[i]; annotate its class.
                string cls = i < bases.Count ? (ObjectInspector.ClassNameOf(mem, (nint)bases[i]) ?? "") : "";
                string tag = cls.Length > 0 ? $"{{{cls}}}" : "";
                parts.Add(i == offs.Count - 1 ? $"{tag}(+0x{offs[i]:X})" : $"{tag}→0x{offs[i]:X}");
            }
            Console.WriteLine($"  [{(ok ? "VERIFIED" : "  fail  ")}] {string.Join(" ", parts)}  ⇒ 0x{resolved:X}" +
                              (ok ? $"  = {mem.ReadInt64((nint)resolved)}" : ""));
            if (++shown >= 25) break;
        }
        Console.WriteLine("\n[ptrscan] Prefer a chain whose intermediate {classes} are named, stable game types " +
                          "(a result VM / List), not compiler closures. Re-run across 2+ battles AND a restart; " +
                          "keep the one whose root RVA + offsets stay identical, then bake it into Il2CppOffsets.cs.");
    }

    /// <summary>Walks a root node down its child links to the target, returning the offset list
    /// in deref order (root side first, final element added not dereferenced).</summary>
    private static List<int> Reconstruct(List<List<Node>> levels, Node root)
    {
        var offs = new List<int>();
        var n = root;
        while (true)
        {
            offs.Add(n.Off);
            if (n.ChildIdx < 0) break;              // child is the target; n is a level-1 node
            n = levels[n.Level - 2][n.ChildIdx];    // level (n.Level-1) list
        }
        return offs;
    }

    /// <summary>base = *loc; for each offset except the last, base = *(base+off); return base+lastOff.
    /// When <paramref name="bases"/> is supplied, records each object indexed (bases[i] is the
    /// object indexed at offs[i]) for per-hop class annotation.</summary>
    private static long Resolve(ProcessMemory mem, long loc, List<int> offs, List<long>? bases = null)
    {
        long p = (long)mem.ReadPointer((nint)loc);
        bases?.Add(p);
        for (int i = 0; i < offs.Count - 1; i++)
        {
            if (!ProcessMemory.IsValidPointer((nint)p)) return 0;
            p = (long)mem.ReadPointer((nint)(p + offs[i]));
            bases?.Add(p);
        }
        return p + offs[^1];
    }

    private static int LowerBound(long[] arr, long value)
    {
        int lo = 0, hi = arr.Length;
        while (lo < hi)
        {
            int mid = (lo + hi) >> 1;
            if (arr[mid] < value) lo = mid + 1; else hi = mid;
        }
        return lo;
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
