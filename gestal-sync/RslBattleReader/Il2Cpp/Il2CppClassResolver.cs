using System.Collections.Concurrent;
using RslBattleReader.Memory;

namespace RslBattleReader.Il2Cpp;

/// <summary>
/// Resolves an Il2CppClass* passively, robust to a fresh game session.
///
/// A TypeInfo RVA in GameAssembly.dll points at a *metadata-usage slot*, which IL2CPP
/// fills lazily. Until the referencing code runs, that slot still holds an encoded
/// metadata-usage token (observed 0x6000E2F3), NOT a live Il2CppClass*. The token
/// passes a naive range check but points to unmapped memory, so navigation dies one
/// step later — which looks like an offset shift when it isn't (see KNOWN_GAPS
/// "metadata-usage fragility").
///
/// Fix: read the slot; if it already holds a valid class, use it. Otherwise scan the
/// process for the Il2CppClass by its (name, namespace). The class struct exists for
/// as long as any instance does — the AppModel singleton always exists once the game
/// is running — so this recovers the pointer without waiting for the game to exercise
/// the class. Passive read only; no injection. The resolved pointer is stable for the
/// process lifetime, so it's cached (and re-validated, so a stale entry after a game
/// restart is transparently re-resolved).
/// </summary>
internal static class Il2CppClassResolver
{
    // Il2CppClass_1 field offsets (Unity 2021 layout, confirmed against il2cpp.h;
    // parent@0x58 matches Il2CppOffsets.ILClass_Parent).
    private const int Class_Name          = 0x10; // const char*
    private const int Class_Namespace     = 0x18; // const char*
    private const int Class_ElementClass  = 0x40; // Il2CppClass* — == self for a plain class
    private const int Class_DeclaringType = 0x50; // Il2CppClass* — outer class of a nested type

    // Concurrent: the watcher resolves AppModel from both the 2s poll and the 100ms
    // fast poller (separate threads).
    private static readonly ConcurrentDictionary<string, nint> _cache = new();

    /// <summary>
    /// Resolve the Il2CppClass* for <paramref name="name"/> in <paramref name="ns"/>.
    /// Fast path: the TypeInfo RVA slot. Fallback: a memory name-scan. Returns Zero if
    /// the class isn't present in memory yet (e.g. no instance has ever existed).
    /// </summary>
    public static nint Resolve(ProcessMemory mem, nint moduleBase, long typeInfoRva,
                               string name, string ns, bool verbose = false)
    {
        if (_cache.TryGetValue(name, out var cached) && LooksLikeClass(mem, cached, name, ns))
            return cached;

        var slot = mem.ReadPointer(moduleBase + (nint)typeInfoRva);
        if (LooksLikeClass(mem, slot, name, ns))
            return _cache[name] = slot;

        if (verbose)
            Console.WriteLine($"[il2cpp] {name}: RVA slot = 0x{slot:X} is not a live class " +
                              "(unresolved metadata-usage token) — scanning memory for the class…");

        var found = ScanForClass(mem, name, c => LooksLikeClass(mem, c, name, ns));
        if (found != nint.Zero)
        {
            _cache[name] = found;
            if (verbose) Console.WriteLine($"[il2cpp] {name}: resolved by scan → 0x{found:X}");
        }
        else if (verbose)
            Console.WriteLine($"[il2cpp] {name}: not found in memory — has an instance been created yet?");
        return found;
    }

    /// <summary>
    /// True if <paramref name="cand"/> is a readable Il2CppClass whose name and namespace
    /// match. Used both to accept the RVA slot and to validate name-scan hits. The
    /// element_class == self check is a cheap, strong structural signal that this is a
    /// real Il2CppClass and not coincidental bytes.
    /// </summary>
    private static bool LooksLikeClass(ProcessMemory mem, nint cand, string name, string ns)
    {
        if (!ProcessMemory.IsValidPointer(cand) || !mem.IsReadable(cand)) return false;
        if (mem.ReadPointer(cand + Class_ElementClass) != cand) return false;
        if (mem.ReadCString(mem.ReadPointer(cand + Class_Name)) != name) return false;
        return mem.ReadCString(mem.ReadPointer(cand + Class_Namespace)) == ns;
    }

    /// <summary>
    /// Resolve a NESTED class by inner name + declaring (outer) class name. A nested
    /// class's bare name (e.g. "Params") is ambiguous, so we match on the inner name AND
    /// require its declaringType to carry <paramref name="outerName"/> — namespace-
    /// independent. Fast path = the TypeInfo RVA slot; fallback = name-scan.
    /// </summary>
    public static nint ResolveNested(ProcessMemory mem, nint moduleBase, long typeInfoRva,
                                     string innerName, string outerName, bool verbose = false)
    {
        var slot = mem.ReadPointer(moduleBase + (nint)typeInfoRva);
        if (LooksLikeNested(mem, slot, innerName, outerName)) return slot;
        if (verbose)
            Console.WriteLine($"[il2cpp] {outerName}.{innerName}: RVA slot = 0x{slot:X} not a live class " +
                              "— scanning by inner name + declaring type…");
        var found = ScanForClass(mem, innerName, c => LooksLikeNested(mem, c, innerName, outerName));
        if (verbose)
            Console.WriteLine(found != nint.Zero
                ? $"[il2cpp] {outerName}.{innerName}: resolved by scan → 0x{found:X}"
                : $"[il2cpp] {outerName}.{innerName}: not found (is the relevant screen open?).");
        return found;
    }

    private static bool LooksLikeNested(ProcessMemory mem, nint cand, string innerName, string outerName)
    {
        if (!ProcessMemory.IsValidPointer(cand) || !mem.IsReadable(cand)) return false;
        if (mem.ReadPointer(cand + Class_ElementClass) != cand) return false;
        if (mem.ReadCString(mem.ReadPointer(cand + Class_Name)) != innerName) return false;
        var outer = mem.ReadPointer(cand + Class_DeclaringType);
        if (!ProcessMemory.IsValidPointer(outer) || !mem.IsReadable(outer)) return false;
        return mem.ReadCString(mem.ReadPointer(outer + Class_Name)) == outerName;
    }

    // Locate the name string, then find the Il2CppClass whose name field points at it and
    // that passes <paramref name="validate"/>.
    private static nint ScanForClass(ProcessMemory mem, string name, Func<nint, bool> validate)
    {
        // Pass 1: addresses of the exact null-terminated type name.
        var nameAddrs = new HashSet<long>();
        foreach (var addr in ScanBytes(mem, System.Text.Encoding.ASCII.GetBytes(name + "\0")))
            nameAddrs.Add((long)addr);
        if (nameAddrs.Count == 0) return nint.Zero;

        // Pass 2: an 8-aligned qword equal to a name address, sitting at class + 0x10.
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
                    if (!nameAddrs.Contains(BitConverter.ToInt64(rb, i))) continue;
                    var cand = baseAddr + (nint)(off + i) - Class_Name; // this qword is class + 0x10
                    if (validate(cand)) return cand;
                }
            }
        }
        return nint.Zero;
    }

    // Yields the start address of every occurrence of <paramref name="needle"/> in
    // committed readable regions. Reads a needle-sized overlap past each chunk so a
    // match straddling a chunk boundary isn't missed, and only emits matches that start
    // within the chunk so none is double-counted.
    private static IEnumerable<nint> ScanBytes(ProcessMemory mem, byte[] needle)
    {
        const int chunk = 0x100000;
        int overlap = needle.Length - 1;
        var buf = new byte[chunk + overlap];
        foreach (var (baseAddr, size) in mem.EnumerateReadableRegions())
        {
            for (long off = 0; off < size; off += chunk)
            {
                int toRead = (int)Math.Min(chunk + overlap, size - off);
                var rb = toRead == buf.Length ? buf : new byte[toRead];
                if (!mem.TryReadBytes(baseAddr + (nint)off, rb)) continue;
                int last = toRead - needle.Length;
                for (int i = 0; i <= last; i++)
                {
                    if (i >= chunk) break;              // starts in the next chunk — scanned there
                    if (Matches(rb, i, needle)) yield return baseAddr + (nint)(off + i);
                }
            }
        }
    }

    private static bool Matches(byte[] hay, int at, byte[] needle)
    {
        for (int k = 0; k < needle.Length; k++)
            if (hay[at + k] != needle[k]) return false;
        return true;
    }
}
