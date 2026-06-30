using RslBattleReader.Memory;
using static RslBattleReader.Il2Cpp.Il2CppOffsets;

namespace RslBattleReader.Il2Cpp;

/// <summary>
/// Navigates the IL2CPP object graph in memory to resolve the AppModel singleton
/// and the BattleResult list inside it.
/// </summary>
internal sealed class Il2CppNavigator(ProcessMemory mem, nint gameAssemblyBase)
{
    // ── AppModel singleton ────────────────────────────────────────────────────

    /// <summary>
    /// Resolves the AppModel instance pointer by following the Il2CppClass parent chain
    /// to reach SingleInstance&lt;AppModel&gt;'s static fields.
    ///
    /// Chain:
    ///   GameAssembly + AppModel_TypeInfo_RVA → AppModel_c*
    ///   AppModel_c*  + 0x58 (parent)         → SingleInstance_AppModel_c*
    ///   SI_c*        + 0xB8 (static_fields)  → SI_StaticFields*
    ///   SI_fields*   + 0x08 (_instance)      → AppModel object*
    /// </summary>
    public nint ResolveAppModelInstance()
    {
        var appModelTypeInfoAddr = gameAssemblyBase + (nint)AppModel_TypeInfo_RVA;
        var appModelClass        = mem.ReadPointer(appModelTypeInfoAddr);
        if (!ProcessMemory.IsValidPointer(appModelClass)) return nint.Zero;

        var singleInstanceClass  = mem.ReadPointer(appModelClass + ILClass_Parent);
        if (!ProcessMemory.IsValidPointer(singleInstanceClass)) return nint.Zero;

        var staticFields         = mem.ReadPointer(singleInstanceClass + ILClass_StaticFields);
        if (!ProcessMemory.IsValidPointer(staticFields)) return nint.Zero;

        var instance             = mem.ReadPointer(staticFields + SI_AppModel_Instance);
        return ProcessMemory.IsValidPointer(instance) ? instance : nint.Zero;
    }

    // ── BattleResult list ─────────────────────────────────────────────────────

    /// <summary>
    /// Reads the current count from MessagePackBattleResultsCache._cachedResults.
    /// Returns -1 on failure.
    /// </summary>
    public int ReadBattleResultCount(nint appModelInstance, bool verbose = false)
    {
        var cacheObj = mem.ReadPointer(appModelInstance + AppModel_BattleResultsCache);
        if (verbose) Console.WriteLine($"  [dbg] AppModel=0x{appModelInstance:X} cacheObj=0x{cacheObj:X}");
        if (!ProcessMemory.IsValidPointer(cacheObj)) return -1;

        var listObj = mem.ReadPointer(cacheObj + BattleResultsCache_List);
        if (verbose) Console.WriteLine($"  [dbg] listObj=0x{listObj:X}");
        if (!ProcessMemory.IsValidPointer(listObj)) return -1;

        int size = mem.ReadInt32(listObj + List_Size);
        if (verbose) Console.WriteLine($"  [dbg] List._size={size}");
        return size;
    }

    /// <summary>
    /// Dumps the first N 8-byte slots of cacheObj so we can find which field changes after a battle.
    /// </summary>
    /// <summary>
    /// Dumps int32 pairs from AppModel itself (not the cacheObj) to find live battle counters.
    /// </summary>
    public void DumpAppModelInts(nint appModelInstance, int slots = 40)
    {
        Console.WriteLine($"  [appmodel-dump] AppModel=0x{appModelInstance:X} — printing {slots} slots");
        for (int i = 0; i < slots; i++)
        {
            int byteOffset = i * 8;
            long raw = mem.ReadInt64(appModelInstance + byteOffset);
            int lo = mem.ReadInt32(appModelInstance + byteOffset);
            int hi = mem.ReadInt32(appModelInstance + byteOffset + 4);
            string valid = ProcessMemory.IsValidPointer((nint)raw) ? " <ptr>" : "";
            Console.WriteLine($"    +0x{byteOffset:X3}: int32s=({lo,12}, {hi,6}){valid}");
        }
    }

    public void DumpCacheObj(nint appModelInstance, int slots = 20, string label = "dump")
    {
        var cacheObj = mem.ReadPointer(appModelInstance + AppModel_BattleResultsCache);
        if (!ProcessMemory.IsValidPointer(cacheObj))
        {
            Console.WriteLine($"  [{label}] cacheObj invalid");
            return;
        }
        Console.WriteLine($"  [{label}] cacheObj=0x{cacheObj:X}");
        for (int i = 0; i < slots; i++)
        {
            int byteOffset = i * 8;
            long raw = mem.ReadInt64(cacheObj + byteOffset);
            // also read as int32 pair for fields that are ints
            int lo = mem.ReadInt32(cacheObj + byteOffset);
            int hi = mem.ReadInt32(cacheObj + byteOffset + 4);
            Console.WriteLine($"    +0x{byteOffset:X2}: ptr=0x{raw:X16}  int32s=({lo}, {hi})");
        }
    }

    /// <summary>
    /// Returns pointers to each BattleResult object in the cache.
    /// Reads only the elements from startIndex onward (for incremental polling).
    /// </summary>
    public IReadOnlyList<nint> ReadBattleResultPointers(nint appModelInstance, int startIndex = 0)
    {
        var cacheObj = mem.ReadPointer(appModelInstance + AppModel_BattleResultsCache);
        if (!ProcessMemory.IsValidPointer(cacheObj)) return [];

        var listObj = mem.ReadPointer(cacheObj + BattleResultsCache_List);
        if (!ProcessMemory.IsValidPointer(listObj)) return [];

        int count = mem.ReadInt32(listObj + List_Size);
        if (count <= startIndex) return [];

        var arrayObj = mem.ReadPointer(listObj + List_BackingArray);
        if (!ProcessMemory.IsValidPointer(arrayObj)) return [];

        var results = new List<nint>(count - startIndex);
        for (int i = startIndex; i < count; i++)
        {
            var ptr = mem.ReadPointer(arrayObj + Array_DataOffset + i * Array_ElementSize);
            if (ProcessMemory.IsValidPointer(ptr))
                results.Add(ptr);
        }
        return results;
    }

    // ── Dictionary<int, T> iteration ─────────────────────────────────────────

    /// <summary>
    /// Iterates a Dictionary&lt;int, object&gt; and yields (key, valuePtr) pairs.
    /// Entry layout: hash(4) next(4) key(4) pad(4) value*(8) = 24 bytes.
    /// </summary>
    public IEnumerable<(int key, nint valuePtr)> IterateDictIntObj(nint dictPtr)
    {
        if (!ProcessMemory.IsValidPointer(dictPtr)) yield break;

        int count    = mem.ReadInt32(dictPtr + Dict_Count);
        var entriesArr = mem.ReadPointer(dictPtr + Dict_Entries);
        if (!ProcessMemory.IsValidPointer(entriesArr) || count <= 0) yield break;

        for (int i = 0; i < count; i++)
        {
            var entryBase = entriesArr + Array_DataOffset + i * DictIntObj_EntrySize;
            int hashCode  = mem.ReadInt32(entryBase);
            if (hashCode < 0) continue; // -1 = empty/deleted slot

            int key      = mem.ReadInt32(entryBase + DictIntObj_KeyOffset);
            var valuePtr = mem.ReadPointer(entryBase + DictIntObj_ValOffset);
            yield return (key, valuePtr);
        }
    }
}
