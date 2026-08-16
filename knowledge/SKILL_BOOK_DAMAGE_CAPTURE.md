# Skill-book DAMAGE capture — scope

**Why this exists.** After removing `BOSS_DEF_FACTOR` (the fitted 0.43 DEF fudge) and modelling the real
per-attacker mechanics (Xenomorph's −20% DEF passive, static gear Ignore-DEF), the Michelangelo A1 direct-hit
anchor still leaves a **+19–29% residual** at full DEF (isolation, 2026-08-16). That residual is exactly the
**skill-book damage** term `B` in RAID's formula:

```
Damage ∝ stat × skill_coefficient × (1 + B)          # HellHades / Plarium documented form
```

The sim currently models `stat × skill_coefficient` only. `B` is a **free parameter** because the DB carries no
book-damage progression: `champion_skills` has `damage_multiplier` (the base coefficient — confirmed: Michelangelo
A1 = `2×` ATK, 2 hits) and `cooldown_base/booked`, but **no per-level Damage +% data**. Until `B` is captured,
"the residual is books" is *consistent* (Mikey is fully booked; +19–29% is the normal book range) but **not proven**.

## The one measurement that settles it (do this first)

Michelangelo is our anchor and is **fully booked** (A1✓ A2✓ A3✓). Read his **A1 skill-upgrade preview in the
in-game Index** (Tier 1): it lists the per-level book bonuses (e.g. "Level 2: Damage +5% … Level 5: Damage +10%").
Sum the **Damage +%** entries → `B_A1_max`.

- If `B_A1_max ≈ +29%` → the residual **is** books; the model is complete once books are wired.
- If `B_A1_max ≈ +15%` → ~+14% remains from another term (multiplier vs card, or the affinity-disadvantage handling)
  and needs its own isolation.

Anchor arithmetic to check against (unbuffed, no crit, Dec-DEF + Xeno poison — the t108 state):
`4058(base) × 0.80(aff) × 1.11–1.20(mastery) × 0.513(defM) = 1,856–2,004/hit` vs reality **2,393/hit**.

## Data model

Add a per-skill **max damage-book percentage** (single number is enough to start — the sim already treats booked
skills as fully-booked for cooldowns/chances):

- New column `champion_skills.damage_book_pct` (numeric, default 0). 0 = no damage books on this skill (many skills
  only book cooldown/chance — those stay 0).
- Populated via a committed `seeds/*.sql` (project hard rule: no direct DB writes).
- Optional later: a per-level progression table if partial-booking fidelity is ever needed. Not required now.

## Sim wiring (once data exists)

Apply the book term **conditionally on the champion's real booked state**, which `build-from-sync` already provides
per skill (`skill_levels[slot].maxed`):

- Booked/maxed skill → multiply that skill's damage by `(1 + damage_book_pct/100)`.
- Unbooked skill → ×1 (no book). This keeps it **per-account faithful**: Mikey (booked) gets the term; Xeno/Ezio/
  Hilve/Iudex (unbooked on the st20 team) correctly get nothing.
- Implementation: carry `bookMult` on the formula/skill and fold it into `computeRawHit` alongside `dmgMult`
  (a single multiplicative term, same place as the other per-hit multipliers).

## Capture scope & source

- **Only DAMAGE skills**, and only the **"Damage +%"** book lines (ignore cooldown/chance/duration books).
- **Source hierarchy** (per CLAUDE.md): Tier 1 = in-game Index skill-upgrade preview (authoritative); Tier 2 =
  AyumiLove/HellHades book-progression tables (Plarium's numbers, **human-read only — no automated scraping**).
- **Priority order:** (1) Michelangelo A1 (the anchor — settles the hypothesis); (2) the rest of the captured
  DonaHilvi/Don$Bambus teams; (3) roster-wide Rare+ damage skills, batched.
- Scale note: ~934 champions × ~2–3 damage skills, but most single skills have modest or zero damage books, so the
  populated rows are far fewer than the row count suggests.

## Current implementation (2026-08-16)

A first slice is wired for **Michelangelo A1 only**: `F_MICHELANGELO_A1.bookDamage = 0.20` (four sequential
Damage +5% upgrades), applied as a flat ×(1+B) on the **direct skill hit only** (interpreter `DEAL_DAMAGE` →
`dealOneHit`), gated on the champion's real booked state (`bookedSlots`). Verified: it does NOT touch Warmaster,
Poison, HP Burn, shields, healing, or poison activation (those are separate paths). Reproduces the 2,393 anchor
(as a RANGE, not a point-match).

⚠ **Two known limitations of this slice:**
- **Binary booked gate.** `bookedSlots` is fully-booked-or-nothing. It does NOT model **partial** booking
  (e.g. Hilvi A2/A3 at 2/3) — that needs ordered per-level upgrade data. Harmless today (only Mikey A1 has
  `bookDamage`, and he is fully booked), but must be fixed before adding `bookDamage` to a skill that captured
  accounts run partially booked.
- **Per-skill, hand-entered.** `bookDamage` currently lives on the formula literal, not the DB. Roster-wide it
  should move to `champion_skills.damage_book_pct` (above).

## Status

- Michelangelo A1: DONE (slice). The rest is BLOCKED on the capture above; data model + wiring ~1–2h once `B` values exist.
- Related: `[[skill-book-data-model-2026-08-05]]` (books ≠ masteries; sim = fully-booked for chances/cooldowns).
