using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace RslBattleReader.Memory;

[SupportedOSPlatform("windows")]
internal sealed class ProcessMemory : IDisposable
{
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern nint OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(nint hObject);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(
        nint hProcess, nint lpBaseAddress,
        byte[] lpBuffer, int nSize, out nint lpNumberOfBytesRead);

    [DllImport("psapi.dll", SetLastError = true)]
    private static extern bool EnumProcessModules(
        nint hProcess, nint[] lphModule, uint cb, out uint lpcbNeeded);

    [DllImport("psapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetModuleFileNameEx(
        nint hProcess, nint hModule, System.Text.StringBuilder lpFilename, uint nSize);

    [DllImport("psapi.dll", SetLastError = true)]
    private static extern bool GetModuleInformation(
        nint hProcess, nint hModule, out MODULEINFO lpmodinfo, uint cb);

    [StructLayout(LayoutKind.Sequential)]
    private struct MODULEINFO
    {
        public nint lpBaseOfDll;
        public uint SizeOfImage;
        public nint EntryPoint;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern nint VirtualQueryEx(
        nint hProcess, nint lpAddress, out MEMORY_BASIC_INFORMATION lpBuffer, nint dwLength);

    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORY_BASIC_INFORMATION
    {
        public nint  BaseAddress;
        public nint  AllocationBase;
        public uint  AllocationProtect;
        public uint  __alignment1;
        public nint  RegionSize;
        public uint  State;
        public uint  Protect;
        public uint  Type;
        public uint  __alignment2;
    }

    private const uint MEM_COMMIT  = 0x1000;
    private const uint MEM_PRIVATE = 0x20000;
    private const uint MEM_MAPPED  = 0x40000;
    private const uint MEM_IMAGE   = 0x1000000;
    private const uint PAGE_GUARD    = 0x100;
    private const uint PAGE_NOACCESS = 0x001;

    private const uint PROCESS_VM_READ           = 0x0010;
    private const uint PROCESS_QUERY_INFORMATION = 0x0400;

    private readonly nint _handle;
    private bool _disposed;

    private ProcessMemory(nint handle) => _handle = handle;

    public static ProcessMemory? OpenById(int pid)
    {
        var h = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, false, pid);
        return h == nint.Zero ? null : new ProcessMemory(h);
    }

    // ── Module scanning ───────────────────────────────────────────────────────

    public nint FindModuleBase(string moduleName)
    {
        // Enumerate up to 1024 module handles
        var handles = new nint[1024];
        if (!EnumProcessModules(_handle, handles, (uint)(handles.Length * nint.Size), out var needed))
            return nint.Zero;

        int count = (int)(needed / nint.Size);
        var sb = new System.Text.StringBuilder(260);

        for (int i = 0; i < count; i++)
        {
            sb.Clear();
            GetModuleFileNameEx(_handle, handles[i], sb, (uint)sb.Capacity);
            if (sb.ToString().EndsWith(moduleName, StringComparison.OrdinalIgnoreCase))
                return handles[i];
        }
        return nint.Zero;
    }

    // ── Region enumeration (for memory scanning) ──────────────────────────────

    /// <summary>Yields committed, readable private/mapped regions (where heap/UI data lives).</summary>
    public IEnumerable<(nint baseAddr, long size)> EnumerateReadableRegions()
    {
        nint addr = 0x10000;
        const long max = 0x7FFF_FFFE_0000;
        while ((long)addr < max)
        {
            if (VirtualQueryEx(_handle, addr, out var mbi, Marshal.SizeOf<MEMORY_BASIC_INFORMATION>()) == 0)
                break;
            long size = (long)mbi.RegionSize;
            if (size <= 0) break;

            bool committed = mbi.State == MEM_COMMIT;
            bool readable  = (mbi.Protect & 0xEE) != 0 && (mbi.Protect & PAGE_GUARD) == 0 && (mbi.Protect & PAGE_NOACCESS) == 0;
            bool heapish   = mbi.Type == MEM_PRIVATE || mbi.Type == MEM_MAPPED;
            if (committed && readable && heapish)
                yield return (mbi.BaseAddress, size);

            addr = (nint)((long)mbi.BaseAddress + size);
        }
    }

    /// <summary>Like <see cref="EnumerateReadableRegions"/> but also includes MEM_IMAGE
    /// regions (loaded module sections). The pointer scanner needs these because a stable
    /// root is typically a static global living in a module's writable .data/.bss.</summary>
    public IEnumerable<(nint baseAddr, long size)> EnumerateAllReadableRegions()
    {
        nint addr = 0x10000;
        const long max = 0x7FFF_FFFE_0000;
        while ((long)addr < max)
        {
            if (VirtualQueryEx(_handle, addr, out var mbi, Marshal.SizeOf<MEMORY_BASIC_INFORMATION>()) == 0)
                break;
            long size = (long)mbi.RegionSize;
            if (size <= 0) break;

            bool committed = mbi.State == MEM_COMMIT;
            bool readable  = (mbi.Protect & 0xEE) != 0 && (mbi.Protect & PAGE_GUARD) == 0 && (mbi.Protect & PAGE_NOACCESS) == 0;
            bool wanted    = mbi.Type == MEM_PRIVATE || mbi.Type == MEM_MAPPED || mbi.Type == MEM_IMAGE;
            if (committed && readable && wanted)
                yield return (mbi.BaseAddress, size);

            addr = (nint)((long)mbi.BaseAddress + size);
        }
    }

    /// <summary>Yields loaded modules as (fileName, base, imageSize) — used to classify a
    /// pointer-field location as a stable static root (module + RVA).</summary>
    public IEnumerable<(string name, nint baseAddr, uint size)> EnumerateModules()
    {
        var handles = new nint[1024];
        if (!EnumProcessModules(_handle, handles, (uint)(handles.Length * nint.Size), out var needed))
            yield break;

        int count = (int)(needed / nint.Size);
        var sb = new System.Text.StringBuilder(260);
        for (int i = 0; i < count; i++)
        {
            if (!GetModuleInformation(_handle, handles[i], out var mi, (uint)Marshal.SizeOf<MODULEINFO>()))
                continue;
            sb.Clear();
            GetModuleFileNameEx(_handle, handles[i], sb, (uint)sb.Capacity);
            var full = sb.ToString();
            var name = full.Length == 0 ? $"module@0x{(long)handles[i]:X}" : Path.GetFileName(full);
            yield return (name, mi.lpBaseOfDll, mi.SizeOfImage);
        }
    }

    // ── Primitive reads ───────────────────────────────────────────────────────

    public bool TryReadBytes(nint address, byte[] buffer)
    {
        if (address == nint.Zero) return false;
        return ReadProcessMemory(_handle, address, buffer, buffer.Length, out _);
    }

    public nint ReadPointer(nint address)
    {
        var buf = new byte[8];
        if (!TryReadBytes(address, buf)) return nint.Zero;
        return (nint)BitConverter.ToInt64(buf, 0);
    }

    public int ReadInt32(nint address)
    {
        var buf = new byte[4];
        TryReadBytes(address, buf);
        return BitConverter.ToInt32(buf, 0);
    }

    public long ReadInt64(nint address)
    {
        var buf = new byte[8];
        TryReadBytes(address, buf);
        return BitConverter.ToInt64(buf, 0);
    }

    public float ReadFloat(nint address)
    {
        var buf = new byte[4];
        TryReadBytes(address, buf);
        return BitConverter.ToSingle(buf, 0);
    }

    public bool ReadBool(nint address)
    {
        var buf = new byte[1];
        TryReadBytes(address, buf);
        return buf[0] != 0;
    }

    public Guid ReadGuid(nint address)
    {
        var buf = new byte[16];
        TryReadBytes(address, buf);
        return new Guid(buf);
    }

    /// <summary>True if <paramref name="size"/> bytes at <paramref name="address"/> are
    /// fully readable — distinguishes a live pointer from an unmapped value (e.g. an
    /// unresolved IL2CPP metadata-usage token that only looks pointer-shaped).</summary>
    public bool IsReadable(nint address, int size = 8)
    {
        if (address == nint.Zero) return false;
        var buf = new byte[size];
        return ReadProcessMemory(_handle, address, buf, size, out var read) && (long)read == size;
    }

    /// <summary>Reads a NUL-terminated ASCII C-string (used for Il2CppClass name /
    /// namespace). Reads in small steps so a string near the end of a mapped page isn't
    /// lost to an all-or-nothing over-read. Returns null if the address isn't readable.</summary>
    public string? ReadCString(nint address, int maxLen = 256)
    {
        if (address == nint.Zero) return null;
        var sb = new System.Text.StringBuilder();
        const int step = 16;
        var buf = new byte[step];
        for (int done = 0; done < maxLen; done += step)
        {
            if (!ReadProcessMemory(_handle, address + done, buf, step, out var read) || (long)read <= 0)
                return sb.Length > 0 ? sb.ToString() : null;
            for (int i = 0; i < (int)read; i++)
            {
                if (buf[i] == 0) return sb.ToString();
                sb.Append((char)buf[i]);
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// Reads a Nullable&lt;T&gt; where T is a 4-byte value type.
    /// hasValue bool is stored immediately after value (at valueOffset+4).
    /// </summary>
    public (int value, bool hasValue) ReadNullableInt(nint objectBase, int fieldOffset)
    {
        int value    = ReadInt32(objectBase + fieldOffset);
        bool hasVal  = ReadBool(objectBase + fieldOffset + 4);
        return (value, hasVal);
    }

    public (float value, bool hasValue) ReadNullableFloat(nint objectBase, int fieldOffset)
    {
        float value  = ReadFloat(objectBase + fieldOffset);
        bool hasVal  = ReadBool(objectBase + fieldOffset + 4);
        return (value, hasVal);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    /// <summary>Quick sanity check: address is non-zero and in a plausible range.</summary>
    public static bool IsValidPointer(nint ptr) =>
        ptr != nint.Zero && (long)ptr is > 0x10000 and < unchecked((long)0x7FFF_FFFF_FFFF);

    public void Dispose()
    {
        if (!_disposed)
        {
            CloseHandle(_handle);
            _disposed = true;
        }
    }
}
