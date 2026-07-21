# Game mechanics inventory — the checklist of what Raid DOES vs what we model

**Permanent. Living document. Established 2026-07-21.** Companion to
`MODEL_AS_REIMPLEMENTATION.md` — that doc says the engine is a partial reimplementation of Raid's
combat; **this is the list of what there is to implement.**

## Why this exists (the awakening lesson)

Our only enumerated mechanics list was `data/keyword-glossary.json` — 92 entries (32 buffs, 39
debuffs, 14 boss-specific, 7 misc) plus 110 `tags` rows. That list is good, and it covers exactly
**one axis: battle keywords** — things placed on a champion during a fight.

**Awakening is not a buff.** So the only list we owned was *structurally incapable* of containing
it — along with ascension, blessings, empower, gear-set effects and the whole masteries tree. That
is why a human had to notice, and why it will keep happening until the other two axes are
enumerated. It also explains the shape of our failures: strong on "which debuff does this champion
place", blind on "what multiplies this champion's numbers".

## Rules for this document

1. **MENTION ≠ MODELLED.** A field appearing in code is not evidence. `awakening_level` appears in
   five files and enters zero formulas. Every ✅ in the *modelled* column needs a named
   function/formula, not a grep hit.
2. **Enumerate from THE GAME, not from our code.** A list derived from our own model can only
   contain known-unknowns — the exact blind spot this exists to fix.
3. **"Deliberately excluded" is a valid, respectable verdict.** We need enough fidelity to RANK
   teams and PLACE a stage, not Plarium's exact damage numbers. Record the reason.
4. ❓ = needs in-game verification by Mike. Claude cannot see the game; do not guess these.

---

## AXIS 1 — Battle keywords (buffs / debuffs / boss mechanics)

**ENUMERATED ELSEWHERE — do not duplicate here.** `data/keyword-glossary.json` (92) and the `tags`
table (110, all with descriptions). Coverage of this axis is genuinely good.
Known gaps live in the tag-policy work, not here.

---

## AXIS 2 — Character-power systems (what multiplies a champion's numbers)

> ✅ **ACCOUNT-LEVEL BONUS ARITHMETIC IS VERIFIED (2026-07-21).** A GEARLESS champion isolates it
> perfectly — with no gear, the green bonus column can only be account-level. Avenger (Magic, Rare,
> Lvl 1, 3★, zero gear) on Don$Bambus: `HP 2475 +25 · ATK 270 +8 · DEF 173 +2 · SPD/CRATE/CDMG/RES +0
> · ACC 0 +5`. Predicted from Arena Bronze I (+1% HP/ATK/DEF) + Great Hall Magic (ATK +2%, ACC +5
> flat): **8 of 8 stats matched exactly.** ACC settles flat-vs-percent — base ACC is ZERO, so a
> percentage would grant nothing, yet +5 appears.
> **Verified formula:** `hp/atk/def/cdmg = base + base*(arena% + greatHall%[affinity])` ·
> `acc/res = base + greatHallFlat[affinity]` · then gear, blessing bonus, faction guardians.
> **Gestal exports the BASE column only** (Avenger exported `acc: 0`, not 5) — so account bonuses
> must be ADDED by us, and `applyAccountBonus` is right to exist even though its VALUES are wrong.
> ❓ Still open: do the percentages ADD or COMPOUND? Both round to +8 here; needs a bigger case.

| mechanic | captured? | modelled? | evidence / note |
|---|---|---|---|
| Level | ✅ 100% | ✅ | `estimate-stats` scales by level |
| Stars / grade | ✅ 100% | ✅ | used in `usabilityTier`, stat scaling |
| **Ascension** | ✅ 100% (`ascensionFromGestal`) | ⚠️ **free on Gestal, WRONG on manual** | **VERIFIED 2026-07-21.** Ascension CHANGES BASE STATS, including ACC and RES. Pelops the Victor across three accounts: Gnut (ascension 6) `hp 22800 atk 749 def 1310 res 50 acc 10` — an EXACT match to `champions.base_*`; Bambus (lower ascension) `22140 / 738 / 1299 / res 30 / acc 0`.<br>⚠ **`champions.base_*` holds MAX-ASCENSION values.** The Gestal path is fine — its `baseStats` are already ascension-adjusted, so ascension is handled implicitly and for free. **The MANUAL path is not**: it reads `champions.base_*` and therefore credits every champion max-ascension stats, over-estimating any unascended champion — including ACC (0 → 10) and RES (30 → 50). Manual rosters are the SHIPPING path (real users have no Gestal), so this is a live product bug, not a lab one.<br>Also explains part of the Gestal-vs-DB scatter previously attributed to the 2026-06-24 bulk-load errors — some of it is ascension, not bad data. |
| **Awakening** | ✅ 100% (`awakenLevel`) | ❌ | plumbed through 5 files, enters no formula |
| **Empower** | ✅ (`empowerLevel`) | ❌ | never read |
| **Blessings** | ✅ (`blessingId`) | ❌ | never read. ❓ what do blessings actually grant? |
| **Masteries** | ⚠️ `masteryIds` on only ~48% of GEARED champs | ⚠️ partial | only `has_boss_mastery` (Warmaster/Giant Slayer) consumed; **rest of the tree ignored** |
| Gear pieces (main/substats) | ✅ full, real | ✅ | `effective-stats` for Gestal rosters |
| **Gear SET bonuses** | ✅ set + piece count | ❌ | set *effects* not modelled; ❓ required piece count per set not stored |
| **Glyphs** | ✅ field exists (`substats[].glyph`) | ❌ | never read. ❓ confirm they're populated in-game |
| **Great Hall** (Affinity Bonuses) | ❌ levels NOT exported | ⚠️ **modelled wrong** | **VERIFIED IN-GAME 2026-07-21 (live grid).** Per-AFFINITY x 6 stats, levels 0-10. ⚠ **HP/ATK/DEF/C.DMG are PERCENT OF BASE; ACC and RES are FLAT** — the live grid shows ATK as '2 %' and ACC as a bare '5'. An earlier reading of the Help text treated all six as percentages; that was WRONG. Percent curve +2/3/4/6/8/10/12/14/17/20%; the flat ACC/RES curve is unknown beyond level 1 = +5. Data: `data/great-hall-bonus-stats.json`.<br>Mike's live values (Development Level 5): Magic ATK 2% + ACC 5 · Force ATK 2% + ACC 5 · Spirit ATK 2% · Void none. **Real investment is tiny** — vs the flat ACC +20/+40 we inject.<br>❓ A SECOND TAB exists, **'Area Bonuses'**, entirely uncaptured and unmodelled. ❓ 'DEVELOPMENT LEVEL 5' is a further concept we do not capture. |
| **Arena (Classic)** | ❌ tier NOT exported by Gestal | ❌ | **VERIFIED IN-GAME 2026-07-21.** Account-WIDE tier bonus by medal count, Bronze I (900) +1% → Platinum (3,617) +25%. **HP / ATK / DEF ONLY — grants NO ACC, NO RES, NO SPD, NO C.DMG.** Data: `data/arena-bonus-stats.json`.<br>⚠ Together with Great Hall this closes the account-level ACC question: `applyAccountBonus()` injects flat **ACC +20 (fair) / +40 (good)** as a 'Great Hall + Arena bundle', but Arena grants 0 ACC, Great Hall grants ~0-3 (a % of a base that is ZERO on 604 of 944 champions), and Faction Guardians grant 0 because none are assigned on any of the 7 accounts. **Real total ≈ 0-3 ACC. We inject 17-37 points of PHANTOM ACC on every champion** — ≈3.7 Spider stages of invented headroom on the stat CLAUDE.md says gates content. Plausible contributor to the 14/21 over-predicting cells.<br>❓ VERIFY: does the Arena bonus apply in PvE at all, or only in Arena? That decides whether it belongs in the dungeon model. |
| **Faction Guardians** | ⚠️ flag only, **and it is FALSE on all 1,370 champions** | ❌ | **VERIFIED IN-GAME 2026-07-21 (Mike screenshot).** Assign DUPLICATE champions; 3 tiers (Rare/Epic/Legendary) x 5 chambers x 2 slots. Bonus applies to **ALL champions of that RARITY in that FACTION** — it does NOT attach to the guardian champion, so `isFactionGuardian` can never yield it. **We would need chamber-fill state per faction x rarity, which Gestal does not export.**<br>**Chambers fill IN ORDER and are CUMULATIVE** — chamber N active means 1..N are all active; removing a champion deactivates that chamber AND every higher one. Each chamber grants a DIFFERENT stat, so a full set grants all five.<br>Rare: +10% HP · +10% ATK · **+7 ACC / +7 RES** · +10% DEF · +3 SPD<br>Epic: +10% HP · +10% ATK · **+15 ACC / +15 RES** · +10% DEF · +6 SPD<br>Legendary: +10% HP · +10% ATK · **+30 ACC / +30 RES** · +10% DEF · +10 SPD<br>"Active in every battle" (game text). Champions with no duplicate obtainable (e.g. Lydia the Deathsiren) can never be guardians.<br>⚠ MATERIAL: +30 ACC ≈ **3 Spider stages** of the `stage x 10` ACC floor.<br>⚠⚠ **AND IT DOES NOT CANCEL IN RANKING.** An account-wide offset largely cancels when COMPARING two champions (see MODEL_AS_REIMPLEMENTATION: common factors cancel in a comparison). This one is **PER-FACTION**, so it changes which champion is better — it can corrupt TEAM SELECTION, the half we believed was safe. |
| **Books / skill levels** | ✅ 100% (`skills[].level/maxLevel`) | ❌ | `isFullyBooked()` EXISTS; engine still uses a rarity **guess** (`assume_booked`), its own comment says "representation-only" |
| ❓ *others?* | | | **Mike: walk the champion detail screen and add any row not listed** |

---

## AXIS 3 — Combat-resolution systems (how a fight is computed)

| mechanic | captured? | modelled? | evidence / note |
|---|---|---|---|
| 8-stat vector (HP/ATK/DEF/SPD/ACC/RES/C.Rate/C.DMG) | ✅ | ✅ | `champions` base_* + `effective-stats` |
| Crit rate / crit damage | ✅ | ✅ | `critFactor()` in contribution + cb-damage models |
| Affinity (Magic/Force/Spirit/Void) | ✅ | ✅ | INS-0015; `applyAffinityToConfidence` |
| **Hit types (Weak / Normal / Crushing)** | ❌ | ⚠️ partial | affinity modelled as a confidence factor; the **placement channel** (a Weak Hit cannot place an active-skill debuff) is noted in `bucket-magnitude` but not in the damage math. ❓ confirm exact rates |
| ATK-vs-DEF damage formula | — | ⚠️ nominal | `damage_multiplier_score` proxy; not the real formula |
| **DEF diminishing returns** | — | ❌ | CLAUDE.md lists it as a `formulas.js` TODO |
| %maxHP damage family (Poison/HP Burn/Warmaster) | ✅ | ✅ | `damage-mechanics.js` §1; DEF-independent |
| **%maxHP boss cap (Normal 21-25 / Hard)** | ✅ 47 real `maxhp_pct` | ✅ 2026-07-21 | **UNVALIDATED** — 0 corpus runs field a cap-affected champ at 21+. ❓ confirm 10%/5% in-game |
| MAX-HP destruction (≠ damage) | ✅ | ❌ | split out in seed 202; shrinks the pool, not modelled |
| Stacking caps (Poison 10, HP Burn 1) | — | ✅ | `SOURCE_STACK_CAP` |
| Debuff landing (ACC vs RES) | ❌ **landings never captured** | ⚠️ floors only | 31× in the gap backlog; ACC floors unverifiable |
| Debuff chance / duration / cooldown | ❌ | ❌ | **76× — top backlog item**; blocks reliability×uptime |
| **Turn meter / speed order** | ⚠️ turns only | ❌ | **no turn model**; audit flags "turn count captured but no speed/turn model" 29× |
| **True Speed / tick formula** | — | ❌ | CLAUDE.md `formulas.js` TODO |
| **Incoming damage / survival** | enemy ATK ✅ | ❌ | `incomingDamagePerTurn = null`. **65% of losses are here** |
| Incoming-damage taxonomy (%maxHP vs ATK-vs-DEF) | — | ❌ | mirror of §1; raw ATK inverts known walls (INS-0016) |
| Mitigation stacking (multiplicative) | — | ✅ | `combinedDamageTaken()` |
| Protection mechanics (Shield/Ally Protection/Block Dmg/Unkillable) | ✅ tags | ⚠️ | `PROTECTION_MECHANICS` has damageType/stacks; not in a survival calc |
| Revive / Self-Revive / ally-gated revive | ✅ | ❌ | tags split 2026-07-21 (seeds 201/203); no sustain math consumes them |
| Auto-battle AI skill order | ❌ **unreadable from memory** | ⚠️ `auto_reliable` attribute | must be entered by hand (see ai-settings memory) |
| Time budget (~5 min, wall-clock) | ✅ duration | ⚠️ nominal | `DEFAULT_BUDGET_TURNS = 50` proxy |
| Battle speed multiplier | ❌ reads null | ❌ | unguarded assumption; constant across corpus today |
| ❓ *others?* | | | **Mike: stat panel + hit-type feedback; add any row not listed** |

---

## How to use this

- **Adding a row:** name the mechanic, what it does, whether the input is captured, whether a named
  formula consumes it. If unsure whether it's modelled — it isn't; grep is not evidence.
- **Prioritising:** rank by **battles-flipped in `tools/battle-suite.mjs`**, not by intuition. That is
  the whole point of having a metric. Current floor: 204/324, balanced accuracy 52.9%.
- **Do not fit around a missing row.** Fitting free coefficients hides an unimplemented mechanic
  inside a constant and makes it permanently invisible (see `MODEL_AS_REIMPLEMENTATION.md`).

## Current top of the list (measured, 2026-07-21)

1. **Survival / incoming damage** — 65% of real losses occur while our kill-side calls the fight
   comfortable. Needs the incoming-damage taxonomy first.
2. **Booked from Gestal** — the data is 100% captured and the helper exists; we use a guess instead.
   Smallest effort-to-correctness ratio on the board.
3. **Awakening + ascension** — 100% captured, zero formulas.
4. Then re-measure. Anything that doesn't move the suite gets reverted.
