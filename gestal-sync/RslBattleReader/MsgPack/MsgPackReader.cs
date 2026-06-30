namespace RslBattleReader.MsgPack;

/// <summary>
/// Minimal MessagePack reader that walks binary data and returns a typed object graph.
/// No NuGet dependency — implements only what's needed for the battleResults file.
/// </summary>
internal static class MsgPackReader
{
    public static object? Read(byte[] data)
    {
        int pos = 0;
        return Read(data, ref pos);
    }

    public static object? Read(byte[] data, ref int pos)
    {
        if (pos >= data.Length) return null;
        byte b = data[pos++];

        // positive fixint
        if (b <= 0x7F) return (long)b;
        // negative fixint
        if (b >= 0xE0) return (long)(sbyte)b;

        switch (b)
        {
            case 0xC0: return null;
            case 0xC2: return false;
            case 0xC3: return true;

            // ints
            case 0xCC: return (long)data[pos++];
            case 0xCD: return (long)ReadU16(data, ref pos);
            case 0xCE: return (long)ReadU32(data, ref pos);
            case 0xCF: return (long)ReadU64(data, ref pos);
            case 0xD0: return (long)(sbyte)data[pos++];
            case 0xD1: return (long)(short)ReadU16(data, ref pos);
            case 0xD2: return (long)(int)ReadU32(data, ref pos);
            case 0xD3: return (long)(long)ReadU64(data, ref pos);

            // floats
            case 0xCA: { var f = BitConverter.ToSingle(data, pos); pos += 4; return (double)f; }
            case 0xCB: { var f = BitConverter.ToDouble(data, pos); pos += 8; return f; }

            // fixstr
            case >= 0xA0 and <= 0xBF:
            {
                int len = b & 0x1F;
                var s = System.Text.Encoding.UTF8.GetString(data, pos, len);
                pos += len; return s;
            }
            // str8/16/32
            case 0xD9: { int len = data[pos++]; var s = System.Text.Encoding.UTF8.GetString(data, pos, len); pos += len; return s; }
            case 0xDA: { int len = ReadU16(data, ref pos); var s = System.Text.Encoding.UTF8.GetString(data, pos, len); pos += len; return s; }
            case 0xDB: { int len = (int)ReadU32(data, ref pos); var s = System.Text.Encoding.UTF8.GetString(data, pos, len); pos += len; return s; }

            // bin8/16/32
            case 0xC4: { int len = data[pos++]; var arr = data[pos..(pos+len)]; pos += len; return arr; }
            case 0xC5: { int len = ReadU16(data, ref pos); var arr = data[pos..(pos+len)]; pos += len; return arr; }
            case 0xC6: { int len = (int)ReadU32(data, ref pos); var arr = data[pos..(pos+len)]; pos += len; return arr; }

            // fixarray
            case >= 0x90 and <= 0x9F: return ReadArray(data, ref pos, b & 0x0F);
            // array16/32
            case 0xDC: return ReadArray(data, ref pos, ReadU16(data, ref pos));
            case 0xDD: return ReadArray(data, ref pos, (int)ReadU32(data, ref pos));

            // fixmap
            case >= 0x80 and <= 0x8F: return (object?)ReadMap(data, ref pos, b & 0x0F);
            // map16/32
            case 0xDE: return (object?)ReadMap(data, ref pos, ReadU16(data, ref pos));
            case 0xDF: return (object?)ReadMap(data, ref pos, (int)ReadU32(data, ref pos));

            // ext types (skip)
            case 0xD4: { pos += 1 + 1; return $"<ext1>"; }
            case 0xD5: { pos += 1 + 2; return $"<ext2>"; }
            case 0xD6: { pos += 1 + 4; return $"<ext4>"; }
            case 0xD7: { pos += 1 + 8; return $"<ext8>"; }
            case 0xD8: { pos += 1 + 16; return $"<ext16>"; }
            case 0xC7: { int len = data[pos++]; pos += 1 + len; return $"<ext{len}>"; }
            case 0xC8: { int len = ReadU16(data, ref pos); pos += 1 + len; return $"<ext{len}>"; }
            case 0xC9: { int len = (int)ReadU32(data, ref pos); pos += 1 + len; return $"<ext{len}>"; }

            default: return $"<unknown 0x{b:X2}>";
        }
    }

    private static List<object?> ReadArray(byte[] data, ref int pos, int count)
    {
        var list = new List<object?>(count);
        for (int i = 0; i < count; i++) list.Add(Read(data, ref pos));
        return list;
    }

    private static List<(object? key, object? val)> ReadMap(byte[] data, ref int pos, int count)
    {
        var pairs = new List<(object?, object?)>(count);
        for (int i = 0; i < count; i++)
        {
            var key = Read(data, ref pos);
            var val = Read(data, ref pos);
            pairs.Add((key, val));
        }
        return pairs;
    }

    private static int ReadU16(byte[] d, ref int pos) { int v = (d[pos] << 8) | d[pos+1]; pos += 2; return v; }
    private static uint ReadU32(byte[] d, ref int pos) { uint v = ((uint)d[pos]<<24)|((uint)d[pos+1]<<16)|((uint)d[pos+2]<<8)|d[pos+3]; pos += 4; return v; }
    private static ulong ReadU64(byte[] d, ref int pos)
    {
        ulong v = 0;
        for (int i = 0; i < 8; i++) v = (v << 8) | d[pos++];
        return v;
    }

    /// <summary>Reads all top-level MessagePack values from a byte buffer.</summary>
    public static List<object?> ReadAll(byte[] data, int startOffset = 0)
    {
        var results = new List<object?>();
        int pos = startOffset;
        while (pos < data.Length)
        {
            try { results.Add(Read(data, ref pos)); }
            catch { break; }
        }
        return results;
    }

    /// <summary>Prints the object graph as indented text for diagnostics.</summary>
    public static void Print(object? obj, int indent = 0)
    {
        var pad = new string(' ', indent * 2);
        switch (obj)
        {
            case null: Console.WriteLine($"{pad}null"); break;
            case bool b: Console.WriteLine($"{pad}{b}"); break;
            case long l: Console.WriteLine($"{pad}{l}"); break;
            case double d: Console.WriteLine($"{pad}{d:F4}"); break;
            case string s: Console.WriteLine($"{pad}\"{s}\""); break;
            case byte[] bytes:
                Console.WriteLine($"{pad}<bytes[{bytes.Length}]: {BitConverter.ToString(bytes[..Math.Min(32, bytes.Length)])}>");
                break;
            case List<object?> arr:
                Console.WriteLine($"{pad}[{arr.Count}]");
                for (int i = 0; i < Math.Min(arr.Count, 50); i++)
                {
                    Console.WriteLine($"{pad}  [{i}]:");
                    Print(arr[i], indent + 2);
                }
                if (arr.Count > 50) Console.WriteLine($"{pad}  ... ({arr.Count - 50} more)");
                break;
            case List<(object? key, object? val)> map:
                Console.WriteLine($"{pad}{{{map.Count} keys}}");
                foreach (var (k, v) in map)
                {
                    Console.Write($"{pad}  {k}: ");
                    Print(v, indent + 2);
                }
                break;
            default: Console.WriteLine($"{pad}{obj}"); break;
        }
    }
}
