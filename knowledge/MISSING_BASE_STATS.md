# Base stats needed — hand-entry worklist

Generated 2026-07-17 from a live DB query, after seed 149.

> ⚠ **READ THIS FIRST — the raw "missing base stats" count is 135, but ~56 of those are
> PHANTOM DUPLICATE ROWS, not real gaps.** The `champions` table contains short-name stub
> rows alongside the real full-name rows — e.g. `Othorion` beside `Wallmaster Othorion`,
> `Colwyn` beside `Tribuck Colwyn`. The stubs have a name, faction, rarity and affinity and
> **nothing else**: no stats, no skills, no tags, no aura. 55 of 56 carry zero payload.
> They are NOT in `champion_aliases` — they are duplicate champion rows.
> **Do not source them. Filling them would create real duplicate champions.**
>
> Only **Group B (59)** is confirmed worth your time.

## What to capture (Group B only)

All 8 values from the champion screen at **6★ Level 60**:
`HP` · `ATK` · `DEF` · `SPD` · `C.RATE` · `C.DMG` · `RES` · `ACC`

A screenshot per champion is enough — I'll read it and seed it.

- **6★ L60 is the reference.** Base stats scale with level/stars.
- **HP is always a multiple of 15.** Verified 3/3 against the game client (2026-07-17).
- **Crit is stored as PERCENT** (15 / 50), not fractions. Card shows `15%` → we store `15`.
- In-game Index is Tier-1. RSL-X / community sheets are Tier-2 (both sheets had typos).

---

# ▶ GROUP B — CONFIRMED REAL GAPS (59) — source these

No duplicate twin, and each carries real payload (skills / tags / aura), so the row is a
genuine champion that is simply missing stats.

### Argonites — 15

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Glorious Pallas | Legendary | Magic |
| ☐ | Kassandra | Legendary | Magic |
| ☐ | Keberon | Legendary | Force |
| ☐ | Knosson | Legendary | Force |
| ☐ | Pelagus | Legendary | Spirit |
| ☐ | Phemo | Legendary | Magic |
| ☐ | Storm Herald Hekaton | Legendary | Void |
| ☐ | Tekteon | Legendary | Void |
| ☐ | Deephook Nagis | Epic | Void |
| ☐ | Lionsguard Galatea | Epic | Spirit |
| ☐ | Stonebound Thisbe | Epic | Magic |
| ☐ | Tidemaster Dexikos | Epic | Magic |
| ☐ | Acolyte of the Slither | Rare | Spirit |
| ☐ | Bladerider | Rare | Magic |
| ☐ | Crimson Pegason | Rare | Force |

### Dark Elves — 5

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Arachoa | Mythical | Force |
| ☐ | Mavara the Web Diviner | Legendary | Magic |
| ☐ | Noldua | Legendary | Force |
| ☐ | Sydax | Legendary | Spirit |
| ☐ | Varkos | Legendary | Force |

### Dwarves — 5

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Cinda | Mythical | Force |
| ☐ | Granyt | Legendary | Spirit |
| ☐ | Hilvi | Legendary | Force |
| ☐ | Hilda | Epic | Force |
| ☐ | Maddak | Epic | Magic |

### Lizardmen — 5

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Anaxia | Mythical | Spirit |
| ☐ | Kosk | Legendary | Force |
| ☐ | Predator | Legendary | Force |
| ☐ | Xiloco | Legendary | Magic |
| ☐ | Galapo | Epic | Magic |

### Sylvan Watchers — 5

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Baerd | Legendary | Magic |
| ☐ | Rhaia | Legendary | Void |
| ☐ | Vestele | Legendary | Magic |
| ☐ | Thorn | Epic | Void |
| ☐ | Gladewulf | Rare | Void |

### Banner Lords — 4

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Joan | Mythical | Magic |
| ☐ | Cecilia | Legendary | Void |
| ☐ | Edward | Legendary | Force |
| ☐ | Silvain | Rare | Void |

### Shadowkin — 4

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Ishiyama | Legendary | Spirit |
| ☐ | Leonardo | Legendary | Void |
| ☐ | Masahiro | Legendary | Force |
| ☐ | Yukimasa | Legendary | Force |

### Undead Hordes — 4

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Blood Marchioness Mina | Mythical | Magic |
| ☐ | Gaspard | Legendary | Void |
| ☐ | Sanguine Maria | Legendary | Force |
| ☐ | Vallaryn the Equalizer | Legendary | Magic |

### Ogryn Tribes — 3

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Grugtha | Legendary | Magic |
| ☐ | Klaazag | Legendary | Void |
| ☐ | Kroz | Legendary | Spirit |

### Barbarians — 2

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Arne | Mythical | Magic |
| ☐ | Bayek | Legendary | Void |

### High Elves — 2

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Solanar | Legendary | Void |
| ☐ | Talenna | Legendary | Spirit |

### Knights Revenant — 2

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Pontiff Augustin | Legendary | Void |
| ☐ | Venalicia | Legendary | Force |

### Demonspawn — 1

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Gracchos Turn Drake | Legendary | Spirit |

### Orcs — 1

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Gaellut | Legendary | Void |

### Sacred Order — 1

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Basim | Legendary | Force |

---

# ⛔ GROUP A — SUSPECTED PHANTOM DUPLICATES (56) — do NOT source

Each has a populated, longer-named row that is almost certainly the same champion. Verify
against the in-game Index, then DELETE the stub rather than fill it.

| Stub row (empty) | Rarity/Affinity | Real row (has stats) | Rarity/Affinity |
|---|---|---|---|
| Adelyn | Legendary/Force | Chronicler Adelyn | Legendary/Force |
| Ankora | Legendary/Magic | Wight Queen Ankora | Legendary/Magic |
| Artor | Legendary/Force | Iudex Artor | Legendary/Spirit |
| Blacktusk | Legendary/Force | Admiral Blacktusk | Legendary/Spirit |
| Boorn | Rare/Force | Hidestitcher Boorn | Rare/Magic |
| Cait | Rare/Magic | Pathfinder Cait | Rare/Magic |
| Caldor | Legendary/Magic | Bladechorister Caldor | Legendary/Spirit |
| Cithrel | Rare/Force | Glensage Cithrel | Rare/Void |
| Colwyn | Rare/Magic | Tribuck Colwyn | Rare/Magic |
| Daithi | Epic/Void | Mistrider Daithi | Epic/Force |
| Eva | Legendary/Magic | Queen Eva | Legendary/Spirit |
| Fabian | Legendary/Force | Lord Entertainer Fabian | Legendary/Spirit |
| Fearmonger | Epic/Void | Masked Fearmonger | Epic/Spirit |
| Flannan | Rare/Spirit | Boughsmith Flannan | Rare/Force |
| Galathir | Mythical/Magic | Starsage Galathir | Mythical/Force |
| Ghrukkus | Epic/Force | Old Ghrukkus | Epic/Force |
| Goon | Rare/Spirit | Fortress Goon | Rare/Magic |
| Greggor | Legendary/Force | Dune Lord Greggor | Legendary/Force |
| Hatter | Legendary/Spirit | Mad Hatter | Legendary/Force |
| Herakletes | Legendary/Force | Tribune Herakletes | Legendary/Spirit |
| Ieyasu | Legendary/Spirit | Onryo Ieyasu | Legendary/Void |
| Isbeil | Epic/Force | Fyr-Gun Isbeil | Epic/Force |
| Islin | Legendary/Void | Strategos Islin | Legendary/Magic |
| Jailer | Rare/Magic | Ogryn Jailer | Rare/Force |
| Jeroboam | Legendary/Force | Brewguard Jeroboam | Legendary/Force |
| Jorrg | Epic/Magic | Old Hermit Jorrg | Epic/Magic |
| Knott | Rare/Spirit | Treeshield Knott | Rare/Void |
| Krixia | Mythical/Spirit | Night Queen Krixia | Mythical/Spirit |
| Lamasu | Legendary/Magic | Authoratrix Lamasu | Legendary/Void |
| Lasair | Rare/Force | Branch-Arm Lasair | Rare/Void |
| Lazarius | Mythical/Magic | Hierophant Lazarius | Mythical/Magic |
| Loriaca | Legendary/Magic | Greathoof Loriaca | Legendary/Spirit |
| Maud | Legendary/Spirit | Highmother Maud | Legendary/Force |
| Narses | Legendary/Magic | Wight King Narses | Legendary/Void |
| Nia | Epic/Magic | White Dryad Nia | Epic/Void |
| Noelle | Legendary/Spirit | Lady Noelle | Legendary/Void |
| Othorion | Legendary/Force | Wallmaster Othorion | Legendary/Magic |
| Padraig | Legendary/Magic | Grand Oak Padraig | Legendary/Spirit |
| Prysma | Legendary/Magic | High Keeper Prysma | Legendary/Spirit |
| Riab | Rare/Spirit | Loneblade Riab | Rare/Force |
| Roanas | Legendary/Magic | Basileus Roanas | Legendary/Force |
| Ruarc | Legendary/Force | Greenwarden Ruarc | Legendary/Force |
| Sabitha | Epic/Magic | Dawncaller Sabitha | Epic/Void |
| Siendra | Epic/Magic | Lightward Siendra | Epic/Void |
| Survivor | Epic/Force | Sandlashed Survivor | Epic/Spirit |
| Taneko | Rare/Magic | Redcloak Taneko | Rare/Magic |
| Teox | Legendary/Force | Legate Teox | Legendary/Spirit |
| Tirlac | Rare/Force | Shadowbow Tirlac | Rare/Spirit |
| Tolog | Rare/Force | Meatcarver Tolog | Rare/Force |
| Tuskkor | Legendary/Force | First Ax Tuskkor | Legendary/Force |
| Ukko | Legendary/Spirit | Mighty Ukko | Legendary/Force |
| Var-Gall | Legendary/Void | Skull Lord Var-Gall | Legendary/Force |
| Wixwell | Legendary/Magic | Vault Keeper Wixwell | Legendary/Force |
| Zaharis | Legendary/Spirit | Dune Herald Zaharis | Legendary/Force |
| Zarguna | Legendary/Magic | Matriarch Zarguna | Legendary/Force |
| Zyclic | Legendary/Force | Swarmspeaker Zyclic | Legendary/Force |

**Note the affinity mismatches.** In many pairs the stub's affinity disagrees with the real
row's (e.g. `Othorion` Force vs `Wallmaster Othorion` Magic). Both cannot be right for one
champion — more evidence the stub rows hold junk. Which side is wrong needs the in-game Index.

**One exception:** `Adelyn` is the only Group A stub carrying any payload (tags, no skills).
Check that its tags aren't the only copy before deleting.

---

# ❓ GROUP C — UNCLEAR (20) — needs your eyes

Empty rows (no stats, no skills, no tags, no aura) with no *populated* twin. Two different
things are mixed in here and I can't separate them from the DB alone:

1. **Short-name twins of another MISSING champion** — e.g. `Hekaton` / `Storm Herald Hekaton`,
   `Mina` / `Blood Marchioness Mina`. Both are empty, so neither looked "populated". If the
   pair is one champion, the stub is a phantom like Group A.
   **But** the Argonites faction genuinely does ship base + evolved forms as separate
   champions, so some of these pairs may be real. I don't know which — you can see the Index.
2. **Genuinely real champions we hold no data on at all** — e.g. `Ash'nar`, `Jorad Wolfhart`,
   `K'Leth`. These need stats AND skills AND tags, i.e. a bigger job than a stat capture.

| ☐ | Champion | Rarity | Affinity | Faction | Possible twin (also missing) |
|---|---|---|---|---|---|
| ☐ | Hekaton | Legendary | Force | Argonites | Storm Herald Hekaton |
| ☐ | Dexikos | Epic | Spirit | Argonites | Tidemaster Dexikos |
| ☐ | Galatea | Epic | Magic | Argonites | Lionsguard Galatea |
| ☐ | Nagis | Epic | Force | Argonites | Deephook Nagis |
| ☐ | Thisbe | Epic | Spirit | Argonites | Stonebound Thisbe |
| ☐ | Pegason | Rare | Spirit | Argonites | Crimson Pegason |
| ☐ | Slither | Rare | Magic | Argonites | Acolyte of the Slither |
| ☐ | Gracchos Turn-drake | Legendary | Force | Demonspawn | — *(no twin — likely a real champion with no data)* |
| ☐ | Augustin | Legendary | Force | Knights Revenant | Pontiff Augustin |
| ☐ | K'Leth | Legendary | Void | Knights Revenant | — *(no twin — likely a real champion with no data)* |
| ☐ | Krok'mar | Legendary | Force | Lizardmen | — *(no twin — likely a real champion with no data)* |
| ☐ | Ash'nar | Mythical | Force | Orcs | — *(no twin — likely a real champion with no data)* |
| ☐ | Kro'khad | Legendary | Void | Orcs | — *(no twin — likely a real champion with no data)* |
| ☐ | Shy'ek | Legendary | Magic | Orcs | — *(no twin — likely a real champion with no data)* |
| ☐ | Nson | Epic | Magic | Orcs | — *(no twin — likely a real champion with no data)* |
| ☐ | Fimo | Epic | Force | Skinwalkers | — *(no twin — likely a real champion with no data)* |
| ☐ | Fren'zi | Epic | Magic | Skinwalkers | — *(no twin — likely a real champion with no data)* |
| ☐ | Jorad Wolfhart | Mythical | Void | Sylvan Watchers | — *(no twin — likely a real champion with no data)* |
| ☐ | Mina | Mythical | Magic | Undead Hordes | Blood Marchioness Mina |
| ☐ | Maria | Legendary | Spirit | Undead Hordes | Sanguine Maria |

---

## Summary

| Group | Count | Action |
|---|---|---|
| **B — confirmed real gaps** | **59** | **Source from the game** |
| A — suspected phantom duplicates | 56 | Verify, then DELETE the stub |
| C — unclear | 20 | Adjudicate against the in-game Index |
| **Raw "missing base stats"** | **135** | |

The 6 Common/Uncommon rows are excluded throughout (Rare+ only).
