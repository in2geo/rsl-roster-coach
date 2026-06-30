using RslBattleReader.Models;

namespace RslBattleReader;

/// <summary>
/// Extracts the champions that took part in a battle from the battleResults file.
///
/// Each hero record carries its identity as the pattern  &lt;typeId:u16-BE&gt; A1 68
/// &lt;heroId&gt;  — i.e. the two bytes immediately preceding the "h" key (A1 68) are
/// the champion's typeId (low 16 bits), and the "h" value is the inventory heroId.
/// This holds regardless of whether the surrounding bytes use standard MessagePack
/// or the custom value-opcode framing, so it's a robust, encoding-agnostic anchor.
///
/// The pattern matches BOTH the player's champions and the enemy units. Validation
/// against the player's roster (heroId→typeId must agree) separates the allies from
/// enemies / coincidental matches — done in BattleWatcher where the roster is known.
/// This class returns the raw candidates (Name unresolved) in file order.
/// </summary>
internal static class HeroIdentity
{
    public static List<BattleHero> Extract(byte[] d)
    {
        var raw = new List<(int off, int heroId, int typeId)>();
        for (int i = 2; i + 2 < d.Length; i++)
        {
            if (d[i] != 0xA1 || d[i + 1] != 0x68) continue; // "h" key
            byte v = d[i + 2];
            int heroId;
            if (v < 0x80) heroId = v;                       // positive fixint
            else if (v == 0xCC && i + 3 < d.Length) heroId = d[i + 3]; // uint8
            else continue;
            int typeId = (d[i - 2] << 8) | d[i - 1];        // u16-BE before the key
            raw.Add((i, heroId, typeId));
        }

        // Dedup by (heroId, typeId), keep first (lowest-offset) occurrence so slot
        // order follows on-screen left-to-right order.
        var seen = new HashSet<(int, int)>();
        var ordered = new List<BattleHero>();
        int slot = 0;
        foreach (var (_, hid, tid) in raw.OrderBy(x => x.off))
            if (seen.Add((hid, tid)))
                ordered.Add(new BattleHero { Slot = slot++, HeroId = hid, TypeId = tid });
        return ordered;
    }
}
