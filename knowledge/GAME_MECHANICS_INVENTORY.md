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

| mechanic | captured? | modelled? | evidence / note |
|---|---|---|---|
| Level | ✅ 100% | ✅ | `estimate-stats` scales by level |
| Stars / grade | ✅ 100% | ✅ | used in `usabilityTier`, stat scaling |
| **Ascension** | ✅ 100% (`ascensionLevel`) | ❌ | 5 refs in `gestal-context`, **0 elsewhere** |
| **Awakening** | ✅ 100% (`awakenLevel`) | ❌ | plumbed through 5 files, enters no formula |
| **Empower** | ✅ (`empowerLevel`) | ❌ | never read |
| **Blessings** | ✅ (`blessingId`) | ❌ | never read. ❓ what do blessings actually grant? |
| **Masteries** | ⚠️ `masteryIds` on only ~48% of GEARED champs | ⚠️ partial | only `has_boss_mastery` (Warmaster/Giant Slayer) consumed; **rest of the tree ignored** |
| Gear pieces (main/substats) | ✅ full, real | ✅ | `effective-stats` for Gestal rosters |
| **Gear SET bonuses** | ✅ set + piece count | ❌ | set *effects* not modelled; ❓ required piece count per set not stored |
| **Glyphs** | ✅ field exists (`substats[].glyph`) | ❌ | never read. ❓ confirm they're populated in-game |
| **Great Hall** | ❌ **NOT exported by Gestal** | ⚠️ estimated | `estimate-stats.js` substitutes an `account_development` bundle. ❓ real values readable in-game |
| Arena bonus | ❌ | ⚠️ | folded into the same bundle as Great Hall |
| **Faction Guardians** | ⚠️ flag only, **and it is FALSE on all 1,370 champions** | ❌ | **VERIFIED IN-GAME 2026-07-21 (Mike screenshot).** Assign DUPLICATE champions; 3 tiers (Rare/Epic/Legendary) x 5 chambers x 2 slots. Bonus applies to **ALL champions of that RARITY in that FACTION** — it does NOT attach to the guardian champion, so `isFactionGuardian` can never yield it. **We would need chamber-fill state per faction x rarity, which Gestal does not export.**<br>Legendary: +10% HP · +10% ATK · **+30 ACC / +30 RES** · +10% DEF · +10 SPD<br>Epic: +10% HP · +10% ATK · **+15 ACC / +15 RES** · +10% DEF · +6 SPD<br>⚠ MATERIAL: +30 ACC ≈ **3 Spider stages** of the `stage x 10` ACC floor. A per-faction uniform offset — precisely the unknown that hides inside a calibration constant. |
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
