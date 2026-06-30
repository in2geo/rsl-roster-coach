# battleResults file format — reverse-engineering notes

## Location
`%LocalAppData%Low\Plarium\Raid_ Shadow Legends\battle-results\battleResults`

Written by the game ~200ms after each battle, then cleared to 11 bytes
(`[16, []]`). Our 100ms fast poller reads it inside that window and dumps
each inner blob to the scratchpad (`BattleFileParser.DumpRawForAnalysis`).

## Outer structure (standard MessagePack — parses cleanly)
```
[ ext(N), bin(blob1), bin(blob2), bin(blob3), bin(blob4)? ]
```
- `outer[0]` = an ext type (ext9 / ext12 — varies)
- `outer[1..]` = binary blobs (`bin8`/`bin16`), counts vary per battle
  (4 blobs for a 1-result file, 5 for a 2-result file, etc.)

## Inner blobs — CUSTOM format (NOT standard MessagePack)
The blobs reuse MessagePack type bytes but with non-standard framing.
A standard reader desyncs after the first few fields.

Observed in the Spirit Keep multi-result dump (stamp 214632):
- blob1 (1255b): battle setup + party/roster. Clean MsgPack header
  (`-14, 82, [ map(18){ i:1, c:0, p:{party map(39)} ... } ]`) but the
  per-hero entries and tail switch to the custom encoding.
- blob2 (4982b): rich BattleResult/Statistics. Many clean string keys
  (de, di, b, ps, as, ms, bs, pc, sss, rss, up, nd, un, tt, et, sa, ea,
  ws, ki, w …) interspersed with custom-encoded value regions.
- blob3 (650b) / blob4 (1006b): per-hero round statistics. Fixed-point
  int64 values (HP/ATK/DEF/SPD — recognizable by repeating 0x6666 / 0x9999
  / 0xCCCC fraction bytes).

### Custom encoding traits (decode obstacles)
- `D3` (normally int64) is a **marker whose payload length varies** — it
  does NOT reliably consume 8 bytes. In blob4 it preceded clean 8-byte
  fixed-point values; in blob3 the same byte preceded a 4-byte-ish field
  then a new key.
- `0B 00` appears as a **separator/framing token** between fields
  (columnar-ish: keys declared, values follow).
- Field keys appear as `<value-type-tag><char>`, e.g. `16 74`="t",
  `15 69`="i", `A1 72`="r". The leading tag (0x16, 0x15, 0xA1…) describes
  the value type.
- Custom value opcodes seen: `0F`, `1F`, `E4`, `BA`, `BB`, `10`, `19 04`.
  These are delta/columnar encodings, not MessagePack.
- Clean-MsgPack islands DO exist. Example (blob3 @160):
  `v:nil, t:25200, u:0, g:3, l:40, da:nil, hb:false, mb:false, en:false,
   e:0, q:0, f:0, d:3, dp:0` — a hero entry that reads perfectly.

## Confirmed short-key meanings (from the earlier clean single-result file)
- `t` → ResultType (1=Victory, 2=Defeat, 3=Draw)
- `u` → FinishCause
- `l` → AllyTurns
- `m` → ManualSkillUsed (bool)
- `s` → Setup: `[ {i:setupId, l:kindId}, stageId ]`
- Internal stageId 9 = "Godfrey's Crossing Stage 5 Hard"
- NOTE: `t`, `l`, `m`, etc. ALSO appear as per-hero field names, so a naive
  byte scan for `A1 74` (="t") matches many false positives. The result-level
  `t` must be disambiguated by surrounding structure.

## CONFIRMED via labeled-sample diffing (Ice Golem 9: 2 Victory + 1 Defeat)
blob1 (setup blob) begins with clean MessagePack:
```
F2 52            -14, 82            (custom header pair)
91               arr(1)
DE 00 12         map(18)
A1 69 <R>        "i" : ResultType   <-- byte offset 8
A1 63 00         "c" : 0
A1 70 DE 00 27   "p" : map(39)       (party/setup)
A1 7A D9 24 ...  "z" : str36 GUID    (per-battle instance id, offset 19+)
...
```
- **blob1[8] = ResultType**: 0x01=Victory, 0x02=Defeat (matched 3/3 samples).
  Confirmed by holding stage constant and flipping win/loss.
- blob1[19+] = battle-instance GUID (varies every battle — ignore).
- **blob1[11] = "c" flag (A1 63 <c>)**: c=1 ONLY on a manual retreat/cancel;
  c=0 on victories AND fought-to-the-end (wipe) defeats. Mapped to
  FinishCause=Retreat when c=1. Confirmed across 14 dumps (13× c=0, 1× retreat
  c=1). Single retreat sample so far — re-confirm with more retreats.
- A Defeat produces a much smaller file (~3.5KB vs ~7.8KB) — blob2 (full
  battle statistics) is largely omitted on defeat.
- blob2[0:1771] was identical between the two VICTORIES but that's just
  shared full-stat structure for the same stage+result; blob2 differs
  entirely on defeat, so it is NOT a reliable stage anchor. Use blob1.

### AllyTurns — DECODED
Stored as a "t":<turns> field, disambiguated from the ~17 other "t" keys by the
constant fields that FOLLOW it: "b":true "g":false =
`A1 74 <turns> A1 62 C3 A1 67 C2`. The turns value is between the "t" key and that
anchor (fixint for <128; CC=uint8 / CD=uint16 for larger, e.g. Clan Boss).
Verified 11/11 against screenshot turn counts. Absent on a manual retreat (game
records no turn count → null). Parser: ExtractAllyTurns().

### DungeonId — ENCOUNTER id, DECODED (DungeonId.cs)
The file carries an EXPLICIT encounter id, encoded as a MessagePack map
`82 A1 69 <id>` ("i":id) in the 200000–260000 band. It is a per-ENCOUNTER id, NOT
a clean per-dungeon id: it maps MANY-TO-ONE onto a dungeon but is not constant
across a dungeon's stages — Arcane Keep st6=219929 vs st10=219911 (distinct).
Some dungeons reuse one id across stages (Ice Golem 7/8/9=221001, Spider 1/3=221801,
Spirit 6/8=220501), others change it per stage (Arcane). Map (id→dungeon[,stage]):
221001 Ice Golem's Peak, 221801 Spider's Den, 220501 Spirit Keep, 219929 Arcane
Keep st6, 219911 Arcane Keep st10, 221401 Fire Knight's Castle, 220301 Void Keep,
220201 Force Keep, 220401 Magic Keep, 220601 Dragon's Lair. Parser uses the id for
the Dungeon name (and the stage number where the id is confirmed stage-specific);
the fingerprint supplies stage# + difficulty otherwise. Robust (exact integer) and
team-independent, but — like fingerprinting — an unsampled stage may carry a NEW id
that must be observed and mapped. A manual retreat can truncate the setup and drop
the id (fingerprint backstops). The player "s" setup ids (104101=Pelops typeId
10410, 44601=Staltus typeId 4460) are leader-keyed TEAM configs, below the band.

### Heroes (identity) — DECODED (HeroIdentity.cs)
Each hero record encodes identity as `<typeId:u16-BE> A1 68 <heroId>`: the two bytes
before the "h" key are the champion typeId (low 16 bits), the "h" value is the
inventory heroId. Encoding-agnostic (works under both msgpack and custom framing).
Matches allies AND enemies; the watcher keeps only the player's champions by
validating heroId→typeId against the Gestal roster (RosterLookup). Slot = file-offset
order = on-screen order. battle-log.json `heroes[]` = [{slot,heroId,typeId,name}].
Per-hero survival / kills / skills-used are still TODO (stats blob + heroRounds blob).

### Still to locate
- StageNumber: no explicit id — handled via fingerprinting (StageFingerprint).
  Only the DUNGEON is explicit (DungeonId, above).
- Per-hero survival (dead/alive), kills, and skills-used — in the custom-encoded
  stats blob (blob2) and heroRounds blob (blob3).
- Draw (ResultType=3) byte value: assume 0x03, confirm if a draw ever occurs.

## Status / open decision
Full robust parsing requires reverse-engineering the custom opcode set
(`0B 00` framing, `D3` markers, `0F/1F/E4/BA/BB/19 04` value ops). That's
a multi-iteration effort and needs several labeled sample files (fight a
known stage, record win/loss + turns, save the dump) to validate.

Raw dumps are saved per battle under the scratchpad `battle-dumps/` dir
(`file_HHMMSS.bin` + `blob_HHMMSS_N.bin`). Collect a handful of labeled
samples across battle types before committing to a parser strategy.
```
```
