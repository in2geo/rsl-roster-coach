# Model Scoreboard — is the evaluator getting better?

The running record of the contribution model's PREDICTION vs captured REALITY, per
reconciled run. This is the Deep-Blue "is the eval function improving?" signal — the thing
that turns "we changed something" into "the model got measurably closer to reality." Each
entry logs the divergence before and after an encoded insight (see `insights-ledger.md`).

Accuracy metric (interim): per-champion contribution ranking + share vs the captured
damage bars, read qualitatively until enough runs exist for an aggregate error metric.
Caveat: a support's low damage BAR understates its true contribution (§4), so "closer to
the bar" is NOT the only goal — the goal is the ranking reflects real value (kill-speed +
survival + granted multipliers), which the bar alone can't show.

---

## SB-0002 — DonBrogni Dragon's Lair Stage 20, 2026-07-14 (controlled 5th-slot A/B/C/D)
Same 4-champ poison+sustain core (Xenomorph, Ezio, Underpriest Brogni, Bad-el-Kazar);
only the 5th slot varied. REALITY outcome ranking:

| 5th slot | result | turns | duration | deaths |
|---|---|---|---|---|
| Uugo | Win | 94t | 177s | 0 (best) |
| Apothecary | Win | 103t | 184s | 1 (Apothecary) |
| Deacon | Win | 125t | 218s | 2 |
| **Bladerider** | **LOSS** | 113t | 201s | **full wipe** |

MODEL CHECK (watchdog on the losing Bladerider team, contentKey=dragon): ranked Bladerider
**LAST** (composite 0.34) and flagged BOTH winning swaps (→ Uugo, → Apothecary). Uugo ranked
**#1** overall — matching the best real outcome. **The watchdog would have warned against the
team that wiped.** Strong directional validation on a SECOND dungeon (toward the ≥2-dungeon gate).

**Corroborates:** INS-0002 (Uugo/Apothecary = the two Increase-Speed champs = the two fastest
clears), INS-0001 (Bladerider's Increase ATK/C.DMG useless on a poison team → wipe), and
sustain-as-constraint (trading sustain for a nuker lost).

**Candidates (NOT acted on — N=1 per slot, RNG possible):**
- Watchdog ranked **Uugo (support) ABOVE Xenomorph (the poison carrier)** — plausible over-weight
  of sustain+grant vs damage; a support shouldn't outrank the engine that does most of the damage.
  Calibration candidate for the composite weights.
- No per-hero damage captured for Dragon (survival/result/duration only) → can't attribute damage.
- ~~Deacon is UNTAGGED~~ **CORRECTED 2026-07-14:** Deacon is "Deacon Armstrong" (Epic) in the
  DB and IS tagged (AoE Damage, Decrease Defense, Leech, Increase Turn Meter, AoE Decrease TM).
  The real gap is a **missing `champion_aliases` row** ("Deacon" → "Deacon Armstrong"), so the
  capture name never matched — reconciliation blindness, NOT a tagging gap. (Original claim was
  made from a query using the wrong name form — a reconciliation-name-resolution failure mode to
  watch for.) Secondary: SPD Aura is TEST_DATA-rejected (his 19% SPD aura unrepresented), A1 Leech
  chance is inverted (30 unbooked/50 booked, DB has 10/30), Multi-Hit A1 missing (A1 hits ×2).
- battleSpeed still null; durationSeconds present (all wins < 300s budget = real clears, not grinds).

---

## SB-0001 — DonBrogni Clan Boss key, 2026-07-14 (9.94M / 134t / all died)
Fielded: Xenomorph (poison engine), Ezio (poison + poison-sensitivity), Underpriest Brogni
(HP Burn + sustain), Michelangelo (attack buffs + sustain), Apothecary (Healer + Increase
Speed + Increase Turn Meter). Insight applied: **INS-0002** (speed = turn multiplier).

| Champ | Reality (dmg bar) | Model BEFORE | Model AFTER |
|---|---|---|---|
| Xenomorph | 66% | 50.7% | 39.0% |
| Underpriest Brogni | 17% | 19.4% | 14.9% |
| Ezio Auditore | 12% | 29.8% | 23.0% |
| Michelangelo | 4% | 0.1% | 0.1% |
| **Apothecary** | 1% (bar) | **0.0%** | **23.1%** |
| — killTurns | (didn't kill; CB) | 45 | 35 |
| — confidence | — | 0.63 | 0.86 |

**What improved:** the model stopped scoring the pivotal turn-multiplier support at ZERO;
it now recognizes Apothecary as a major contributor (§4 — her value is in others' bars).

**Still diverging (open items, NOT yet acted on — need more data, per discipline #4):**
- Ezio over-credited (model 23% vs 12% bar) — his Poison / Poison Sensitivity nominal
  magnitude likely too high, OR nominal stats overstate him. Calibration candidate.
- Xenomorph under-weighted vs its 66% bar — the carrier's poison coefficient may be low
  relative to the debuff/turn multipliers. Calibration candidate.
- Michelangelo 4% real vs 0.1% model — his own direct hits aren't captured by the tag-only
  damage proxy (Debuff Spread / attack buffs mismatch a poison team, but he still hit for 4%).
- CB is modeled as a kill-race with NOMINAL boss HP; real CB is chest-tier scored and never
  "killed". A CB-specific reconciliation (chest tier vs captured total) is the right metric.
- Survival side unmeasured (incoming-damage-per-stage data gap) → confidence is kill-speed-only.

**Discipline note:** N=1. This entry VERIFIES the direction of INS-0002 (0% → recognized);
it does NOT calibrate any magnitude. The over/under-credits above are logged as candidates,
not changes.
