# Session Handoff — 2026-07-23: multiplier capture, DB persistence, and the write-back lesson

**COLD-START DOC — read this FIRST** (it is the latest front), then the ⭐⭐ memories at the top of
`MEMORY.md`. For the QA-protocol/simulator details this builds on, read
`HANDOFF_2026-07-22_qa-ladder.md` next (still valid; this continues it).

Branch: `session/turn-loop-2026-07-22` (unchanged). **⚠ DB IS NO LONGER UNTOUCHED** — see below.

---

## 0. THE LOAD-BEARING LESSON (read even if you read nothing else)

**Captured data MUST be written to the durable store (master worksheet + a committed seed) in the SAME
session, or it is ORPHANED and lost.** Mike had re-captured all 29 Mythical multipliers *multiple times*
across prior sessions because the values only ever landed in chat/scratch and never reached the
worksheet. THIS session I repeated the failure — parked all 29 in a scratch `mythical_multipliers_todo.csv`
and didn't persist until he asked "where is that stored?".

**A memory rule is NOT a fix** — the equivalent rule already existed (Tag Policy #18) and didn't prevent
it; I even cited #18 while committing the same failure. Enforcement needs a **hook** (harness-run) or a
**write-through workflow** (persist per-champion as captured; the DB has no single-writer problem), NOT
another prose reminder. Mike declined building the hook this session, but the point stands. See
`[[multiplier-writeback-required]]`.

---

## 1. WHAT CHANGED — two workstreams

### A. QA rungs + multiplier_type (extends the qa-ladder handoff)
- **New rung FIRED vs CONSUMED** — `tools/sim-effects.mjs` + a `recordEffect` ledger in
  `lib/sim/engine.js`. Two metrics per effect; catches "represented but not consumed" automatically.
  Distinction to keep: **producer-side** (effect fired, zero state delta — caught generically) vs
  **consumer-side** (buff present but ignored at point of use — shield-absorb, veil-targeting — needs
  point-of-use asserts). Emits 2 demonstrated blanks (no passive-trigger system; targeting ignores
  `[Perfect Veil]`). `[[fired-vs-consumed-rung-2026-07-22]]`.
- **Rung 4 loop closed** — `tools/sim-golden.mjs` now RUNS the sim on the golden fixture's exact builds
  and scores outcome/survival (bucket-4, non-blocking). dragon16-donbambus: sim LOSS / real WIN.
- **`multiplier_type` IMPLEMENTED** — the sim now reads the `champion_skills.multiplier_type` COLUMN
  (was never fetched) and scales damage off ATK/**HP**/**DEF** (`normStat`/`scaleStat`). Vergis was
  already `3.9`/`DEF` in the DB → reading the column fixed him for free. Spec 66/66, gate green.
  `[[multiplier-capture-convention]]`.

### B. Multiplier capture + persistence (the session's bulk)
- **All 29 two-form Mythicals captured** (Mike pasted skill cards; I extracted → worksheet + DB).
  Worksheet Mythical damage skills **18 → 150 filled**. Scaling types are richer than ATK/HP/DEF:
  `%MaxHP`, `HP+ATK`, `HP+DEF`, `DEF+ATK`, `ATK+ACC`, and **formulas** (ACC/RES/SPD-based, buff-count,
  debuff-count). Working file: `mythical_multipliers_todo.csv` (root).
- **Worksheet data-quality issues found** (cleanup backlog): reworked champs carry STALE names/summaries
  (Mina alt = *Arne's* names + SPD-formula; Joan base+alt renamed; Polara whole alt form + dup alt A1;
  Siegfrund alt A1); placeholder names (Embrys, Nell); truncated summaries hide damage skills from any
  "Attacks"-based classifier (Krixia, Polara, Joan "one enemy") — so any auto "missing multiplier" count
  is a mild UNDERCOUNT. Fixed 14 names during the write.
- **Transcript recovery** — mined 6 prior session transcripts. FINDING: prior Legendary/Epic/Rare
  captures were **already saved** (the apparent conflicts were just the two-column `3.5`+`DEF` vs
  `3.5 DEF` format). Only genuinely lost work was the **Mythicals** (now fixed) + **2 stray skills**
  (Deacon Armstrong, recovered). My "~1528 mentions" claim was a raw-substring OVERCOUNT — real
  user-pasted data was ~48 skills.

---

## 2. ⚠ DB POSTURE — NO LONGER UNTOUCHED

Seeds APPLIED to the live DB this session (all committed files + applied via `tools/apply-seed-pooler.mjs`):
- **206** Ezio multipliers · **207** Dragon-16 team · **208** 29 Mythicals (136 rows) · **209** Deacon Armstrong (2 rows).
- Only **seed 205** (Dragon wave composition) remains file-only.
- Worksheet backups made before writes: `BACKUP-2026-07-23-preMythicalMultipliers.xlsx`,
  `BACKUP-2026-07-23-preDeaconRecovery.xlsx`.

The `PENDING_MULT` overlays in `sim-dragon.mjs`/`sim-golden.mjs` were DELETED (DB is the single source now).

---

## 3. WORKSHEET LAYOUT REFERENCE (Skills tab)
Col O=`Verification Status`, **Q=`Review Notes`**, **R=`Damage Multiplier`**, **S=`Multiplier Type`**.
(Champions tab col Q is a different thing: `Core Data Complete`.) Recovery/capture write path:
backup → workbook CLOSED (check `~$*.xlsx` lock) → `openpyxl.load_workbook(path)` with **`data_only=False`**
(never True — it clobbers formulas) → match rows by **(Champion, Form, Slot)**; Form col 5 is empty for
base, `'alternate'` for alt.

---

## 4. RECOMMENDED NEXT
- **Legendary/Epic/Rare missing-multiplier lists** — scriptable (single-form), but FIRST harden the
  damage-skill classifier for the gaps found (spelled-out "one enemy", "N times at random", buried
  Attacks clauses, truncated summaries) so the list isn't a silent undercount.
- **Worksheet name/summary cleanup** for the reworked Mythicals (Mina/Joan/Polara/Siegfrund) + placeholders.
- **Enforcement** (if Mike reverses): a Stop-hook that blocks on capture-CSV data not in the worksheet, or
  write-through DB persistence — the real fix for the write-back failure, not a memory.
- **The QA/sim front** (from the qa-ladder handoff): survival is still the dominant sim error; the
  **passive-trigger system** is the highest-leverage build.
