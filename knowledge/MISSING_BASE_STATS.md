# Base stats needed — hand-entry worklist

**135 champions in scope** (Rare+). Generated 2026-07-17 from a live DB query, after seed 149.

Grouped by **faction** to match how the in-game Index is organised — work one faction at a time.

## What to capture

All 8 values from the champion screen, at **6★ Level 60**:

`HP` · `ATK` · `DEF` · `SPD` · `C.RATE` · `C.DMG` · `RES` · `ACC`

A screenshot per champion is enough — I'll read it and seed it.

## Notes before you start

- **6★ L60 is the reference.** Base stats scale with level/stars, so a champion shown at any
  other level gives the wrong number. Unowned champions in the in-game Index are displayed at
  max, which is what we want.
- **HP is always a multiple of 15.** Verified 3/3 against the game client (2026-07-17). If a
  captured HP isn't divisible by 15, it's a misread — this catches typos with no second source.
- **Source tier matters.** The in-game Index is Tier-1. RSL-X / community sheets are Tier-2 —
  usable, but both sheets we checked had typos the game client caught.
- **Crit is recorded as PERCENT** (15 / 50), not fractions. The card shows `15%` → we store `15`.

---

### Argonites — 22

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Glorious Pallas | Legendary | Magic |
| ☐ | Hekaton | Legendary | Force |
| ☐ | Kassandra | Legendary | Magic |
| ☐ | Keberon | Legendary | Force |
| ☐ | Knosson | Legendary | Force |
| ☐ | Pelagus | Legendary | Spirit |
| ☐ | Phemo | Legendary | Magic |
| ☐ | Storm Herald Hekaton | Legendary | Void |
| ☐ | Tekteon | Legendary | Void |
| ☐ | Deephook Nagis | Epic | Void |
| ☐ | Dexikos | Epic | Spirit |
| ☐ | Galatea | Epic | Magic |
| ☐ | Lionsguard Galatea | Epic | Spirit |
| ☐ | Nagis | Epic | Force |
| ☐ | Stonebound Thisbe | Epic | Magic |
| ☐ | Thisbe | Epic | Spirit |
| ☐ | Tidemaster Dexikos | Epic | Magic |
| ☐ | Acolyte of the Slither | Rare | Spirit |
| ☐ | Bladerider | Rare | Magic |
| ☐ | Crimson Pegason | Rare | Force |
| ☐ | Pegason | Rare | Spirit |
| ☐ | Slither | Rare | Magic |

### Sylvan Watchers — 19

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Jorad Wolfhart | Mythical | Void |
| ☐ | Baerd | Legendary | Magic |
| ☐ | Caldor | Legendary | Magic |
| ☐ | Padraig | Legendary | Magic |
| ☐ | Rhaia | Legendary | Void |
| ☐ | Ruarc | Legendary | Force |
| ☐ | Vestele | Legendary | Magic |
| ☐ | Daithi | Epic | Void |
| ☐ | Nia | Epic | Magic |
| ☐ | Thorn | Epic | Void |
| ☐ | Cait | Rare | Magic |
| ☐ | Cithrel | Rare | Force |
| ☐ | Colwyn | Rare | Magic |
| ☐ | Flannan | Rare | Spirit |
| ☐ | Gladewulf | Rare | Void |
| ☐ | Knott | Rare | Spirit |
| ☐ | Lasair | Rare | Force |
| ☐ | Riab | Rare | Spirit |
| ☐ | Tirlac | Rare | Force |

### Knights Revenant — 9

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Krixia | Mythical | Spirit |
| ☐ | Ankora | Legendary | Magic |
| ☐ | Augustin | Legendary | Force |
| ☐ | Hatter | Legendary | Spirit |
| ☐ | K'Leth | Legendary | Void |
| ☐ | Narses | Legendary | Magic |
| ☐ | Pontiff Augustin | Legendary | Void |
| ☐ | Venalicia | Legendary | Force |
| ☐ | Sabitha | Epic | Magic |

### Lizardmen — 9

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Anaxia | Mythical | Spirit |
| ☐ | Lazarius | Mythical | Magic |
| ☐ | Kosk | Legendary | Force |
| ☐ | Krok'mar | Legendary | Force |
| ☐ | Predator | Legendary | Force |
| ☐ | Teox | Legendary | Force |
| ☐ | Var-Gall | Legendary | Void |
| ☐ | Xiloco | Legendary | Magic |
| ☐ | Galapo | Epic | Magic |

### High Elves — 8

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Galathir | Mythical | Magic |
| ☐ | Islin | Legendary | Void |
| ☐ | Othorion | Legendary | Force |
| ☐ | Prysma | Legendary | Magic |
| ☐ | Roanas | Legendary | Magic |
| ☐ | Solanar | Legendary | Void |
| ☐ | Talenna | Legendary | Spirit |
| ☐ | Siendra | Epic | Magic |

### Ogryn Tribes — 8

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Grugtha | Legendary | Magic |
| ☐ | Jeroboam | Legendary | Force |
| ☐ | Klaazag | Legendary | Void |
| ☐ | Kroz | Legendary | Spirit |
| ☐ | Tuskkor | Legendary | Force |
| ☐ | Ghrukkus | Epic | Force |
| ☐ | Goon | Rare | Spirit |
| ☐ | Jailer | Rare | Magic |

### Orcs — 8

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Ash'nar | Mythical | Force |
| ☐ | Gaellut | Legendary | Void |
| ☐ | Kro'khad | Legendary | Void |
| ☐ | Shy'ek | Legendary | Magic |
| ☐ | Zarguna | Legendary | Magic |
| ☐ | Jorrg | Epic | Magic |
| ☐ | Nson | Epic | Magic |
| ☐ | Survivor | Epic | Force |

### Undead Hordes — 8

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Blood Marchioness Mina | Mythical | Magic |
| ☐ | Mina | Mythical | Magic |
| ☐ | Fabian | Legendary | Force |
| ☐ | Gaspard | Legendary | Void |
| ☐ | Herakletes | Legendary | Force |
| ☐ | Maria | Legendary | Spirit |
| ☐ | Sanguine Maria | Legendary | Force |
| ☐ | Vallaryn the Equalizer | Legendary | Magic |

### Dark Elves — 7

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Arachoa | Mythical | Force |
| ☐ | Eva | Legendary | Magic |
| ☐ | Mavara the Web Diviner *(partial row — some stats already set)* | Legendary | Magic |
| ☐ | Noldua | Legendary | Force |
| ☐ | Sydax | Legendary | Spirit |
| ☐ | Varkos | Legendary | Force |
| ☐ | Zyclic | Legendary | Force |

### Dwarves — 7

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Cinda | Mythical | Force |
| ☐ | Blacktusk | Legendary | Force |
| ☐ | Granyt | Legendary | Spirit |
| ☐ | Hilvi | Legendary | Force |
| ☐ | Hilda | Epic | Force |
| ☐ | Isbeil | Epic | Force |
| ☐ | Maddak | Epic | Magic |

### Banner Lords — 6

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Joan | Mythical | Magic |
| ☐ | Adelyn | Legendary | Force |
| ☐ | Cecilia | Legendary | Void |
| ☐ | Edward | Legendary | Force |
| ☐ | Fearmonger | Epic | Void |
| ☐ | Silvain | Rare | Void |

### Shadowkin — 6

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Ieyasu | Legendary | Spirit |
| ☐ | Ishiyama | Legendary | Spirit |
| ☐ | Leonardo | Legendary | Void |
| ☐ | Masahiro | Legendary | Force |
| ☐ | Yukimasa | Legendary | Force |
| ☐ | Taneko | Rare | Magic |

### Skinwalkers — 6

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Loriaca | Legendary | Magic |
| ☐ | Ukko | Legendary | Spirit |
| ☐ | Fimo | Epic | Force |
| ☐ | Fren'zi | Epic | Magic |
| ☐ | Boorn | Rare | Force |
| ☐ | Tolog | Rare | Force |

### Sacred Order — 5

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Artor | Legendary | Force |
| ☐ | Basim | Legendary | Force |
| ☐ | Maud | Legendary | Spirit |
| ☐ | Noelle | Legendary | Spirit |
| ☐ | Wixwell | Legendary | Magic |

### Barbarians — 4

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Arne | Mythical | Magic |
| ☐ | Bayek | Legendary | Void |
| ☐ | Greggor | Legendary | Force |
| ☐ | Zaharis | Legendary | Spirit |

### Demonspawn — 3

| ☐ | Champion | Rarity | Affinity |
|---|---|---|---|
| ☐ | Gracchos Turn Drake | Legendary | Spirit |
| ☐ | Gracchos Turn-drake | Legendary | Force |
| ☐ | Lamasu | Legendary | Magic |

---

## Out of scope — do NOT capture (6)

Common/Uncommon are excluded from the product (Rare+ only), listed here so they aren't
mistaken for gaps:

- Elven Ranger (Uncommon, High Elves)
- Gromoboy (Uncommon, Ogryn Tribes)
- Knight Errant (Uncommon, Banner Lords)
- Mountaineer (Common, Dwarves)
- Razorleaf (Uncommon, Demonspawn)
- Thornhide (Uncommon, Lizardmen)

## Summary

| Rarity | Missing |
|---|---|
| Mythical | 12 |
| Legendary | 79 |
| Epic | 24 |
| Rare | 20 |
| **Total in scope** | **135** |
