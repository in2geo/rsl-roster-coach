# HANDOFF — Reader per-hero FIXED, capture→sim loop CLOSED, DEF curve VALIDATED (2026-08-13)

**Branch:** `session/qa-rungs-2026-07-23`  ·  **Tip:** `fe6882e` (all pushed)  ·  **Span:** `619ffb2` → `fe6882e`

Read `knowledge/NORTH_STAR.md` and memory `[[reader-perhero-fix-and-def-curve-validated-2026-08-13]]` first (this handoff is the operational detail).

---

## 30-SECOND ORIENTATION

Two arcs this session. **(A) Finished the DonaHilvi Dragon team's skill recipes** (Iudex + Ninja) and did Dragon dial-in (masteries wired, purple bar recalibrated). **(B) THE BIG ONE — fixed the battle reader's per-hero damage capture, closed the capture→sim per-hero calibration loop, and used it to VALIDATE the sim's DEF+affinity math first-party.** The dial-in method now runs end-to-end: reader captures reality per-hero → `sim-per-hero-bands` grades the sim → localizes the divergence → fix the REAL mechanic (never fit).

**Durable discipline Mike set (load-bearing):** real game math only. Captures are FALSIFIABLE TESTS, never fitting targets. Derive/measure the real formula, implement it, test vs captures; if it doesn't reproduce reality, find the NEXT wrong real thing — do NOT tune a constant to force a match.

---

## WHAT SHIPPED (commits, oldest→newest — ALL PUSHED)

| Commit | What |
|---|---|
| `619ffb2` | Iudex Artor revive-then-cast chain (`REVIVE_AND_CAST` op: revive→buff→cast revived ally's A1→reset-on-kill) |
| `eee3809` | Ninja A3 self-cooldown reduction (`DECREASE_COOLDOWN` self mode — shaves 1 off own Hailburn) |
| `0c5a095` | **Dragon: wired the FULL mastery list into sim-suite** (was a has_boss_mastery BOOLEAN) → Dragon fn 29→18, **+1.1pp (68.5%)** |
| `521ab32` | sim-dragon: fix stale "purple bar 20% flat" message |
| `f23208a` | Dragon purple bar → **flat 15%** (Mike's st16 read), retired the +5% escalation; SIM_PURPLE_BAR_PCT knob. Metric-invisible (A/B 10/15/20% identical) |
| `32a9963` | sim-suite --diagnose: also dump FALSE CLEARS (not just false walls) |
| `b6bf4aa` | **⭐ READER per-hero damage FIXED** — `CaptureDungeon` navigates the live dialog to its OWN hero list (kills the stale-context bug) |
| `b2e0c1e` | sim-suite: `--acct` filter, false-clears dump, `SIM_NO_SPONGE` knob |
| `4320d67` | **Closed the capture→sim loop** — per-hero-bands fixture + CONTENTS for DonaHilvi Dragon st20 (Ezio-Xeno team) |
| `d74aac9` | **Reader: persist per-ally HP traces** (change-points) — enabled first-party DEF derivation |
| `fe6882e` | Dragon: apply affinity to the boss's ATK hits (enemy→team) — a real mechanic `bossHit` bypassed (metric-neutral, kept as verified fact) |

---

## ⭐ THE READER PER-HERO FIX (the headline — a capability RESTORED)

**Problem:** `CbDamageReader.CaptureDungeon` heap-scanned every `HeroBattleStatsContext` and required a "contiguous run of 5", which STALE contexts from prior battles broke → per-hero damage/def/heal left NULL. This was the follow-up SCOPED in `[[in-battle-hp-sampler-built-2026-08-10]]` but never done (the HP-moved fix only ever landed in the sampler — a DIFFERENT object graph).

**Fix (`b6bf4aa`):** navigate the live result dialog to ITS OWN hero list — scan the dialog's pointer slots for a `List<HeroBattleStatsContext>` of the team size (UCL-wrapped or direct; validate every element's klass). Found the dungeon dialog's hero-list at **dialog+0x128** BY STRUCTURE (self-calibrating, no hardcoded offset; CB's is +0x160). Reads the dialog's own 5 → stale contexts structurally impossible. **Verified live: 5/5 on multiple DonaHilvi Dragon captures (wins + defeats).**

**Still missing:** per-hero SKILLS-USED (and kills/grade/level/rounds) — those live in the `heroRounds` **custom columnar blob** (undecoded, `FORMAT_NOTES.md`), with NO dialog UI source. Damage HAD a dialog shortcut (Route 1); skills-used would need the columnar decode (Route 2, hard). Deferred.

**⚠ THE READER IS STILL RUNNING** (PID was 2160). It's capturing per-hero damage AND per-ally HP traces on every dungeon run. Leave it to keep collecting the fresh corpus, or stop it (`Stop-Process -Name RslBattleReader`). Launch: run the Release exe by ABSOLUTE path (`gestal-sync/RslBattleReader/bin/Release/net10.0-windows/win-x64/RslBattleReader.exe`) — relative paths in a backgrounded shell fail (exit 127). Writes to `gestal-sync/RslBattleReader/output/battle-log.json` (NOT `gestal-sync/output/`). `--fields` (ResolveByNameAny) is pathologically slow — avoid; `--dungeoninspect` (namespace-scoped Resolve) is fast.

---

## THE CAPTURE→SIM LOOP (now closed) + FIRST DIAL-IN

`tools/sim-per-hero-bands.mjs` reads the reader `battle-log.json` and grades a golden fixture's sim per-hero DEALT/TAKEN vs the captured reality (WINS only, `--acct`/variant scoped). Added fixture `test/golden/dragon-donahilvi-ezio-xeno-st20-current.json` + a CONTENTS entry.

**First signal — DonaHilvi Dragon st20 (Ezio-Xeno = Michelangelo/Xenomorph/Ezio/Hilve/Iudex):**
- **sim WR 28% vs real 75%; turns 207 vs 121; TAKEN 2-3× too high on EVERY champ** (sim OVER-punishes this team — the OPPOSITE of the corpus false-clears → the survival model has real per-team VARIANCE).
- DEALT mis-distributed (Ezio +91%/Hilve +51% over, Mikey −43%/Xeno −25% under) but team total ~right.
- **DonaHilvi is essentially SOLVED** (30/30 wins right; its 3 "losses" are the RNG tail of a ~96%-WR team — do NOT chase, single-run-anchor trap). The corpus false-clears (fp 21) are OTHER accounts (Bambus/Gnut/Brogni/Thor).

---

## ⭐ DEF + AFFINITY VALIDATED FIRST-PARTY — CORRECT, DO NOT TOUCH

Persisted per-ally HP **change-point traces** (`d74aac9`) so a boss AoE hit (all 5 allies drop on one frame) is recoverable. Derived the DEF curve first-party (cross-ally damage RATIOS cancel the attacker's ATK; divide by the affinity factor; residual tracks DEF). **RESULT: the sim's `defMitigation` (engine.js `1 − 0.85·(1−exp(−DEF/1500))`) MATCHES reality — DEF 970→1405 damage ratio 1.26 (real) vs 1.23 (sim).** Affinity model confirmed too. **So the st20 taken over-count is NOT DEF and NOT affinity.**

**Then fixed a genuine gap it exposed (`fe6882e`):** the boss's scripted `bossHit` bypassed affinity — enemy attacks obey the wheel too (a Magic st20 boss hit a Force ally at ×1.0 instead of ×0.7). Applied `affinityMult` in `strike` (Swipe/Wall of Fire), NOT `scorchStrike` (Scorch is %MaxHP → affinity-independent). Wave mobs already applied it (recipe path). Metric-neutral (st16 Void dominates the corpus; boss is ~2 hits/fight vs wave-dominated total), kept as a verified game fact.

---

## OPEN THREADS (ranked) — the st20 taken over-count residual

1. ⭐ **Wave-phase length** — the st20 fight runs **215 turns vs 121 reality**, almost all in WAVES (boss ~2 hits/fight). Taken is cumulative, so a 1.75×-too-long fight is the dominant taken over-count driver. Suspect: st20 wave mobs too tanky / wave RES-ACC-level inputs wrong (flagged in `[[mastery-layer-and-dragon-turn-gap-2026-08-02]]`). START HERE.
2. **Clean per-hit ATK-vs-Scorch split** — my per-hit metric confounded Scorch (%MaxHP, affinity-independent) with ATK hits. Redo the per-hit sim-vs-reality comparison SEPARATING the two (Scorch = 0.25×maxHP×(fires+1); ATK = Swipe 3×/WoF 3.4×) before concluding the ATK base magnitude is too high. Reality per-hit data is in the ally traces now.
3. **The corpus false-clears (fp 21)** — Bambus/Gnut/Brogni/Thor teams the sim OVER-sustains. Separate from the DonaHilvi OVER-punish. The Bambus sponge was RULED OUT (SIM_NO_SPONGE A/B: Dragon-neutral, Spider-load-bearing).

## METHOD NOTES / GOTCHAS
- **Dragon stage affinities cycle** Magic/Force/Spirit/Void: st16 Void, st17 Magic, **st20 Magic**, st18 Force, st19 Spirit, st21 Force. A Magic attacker → Spirit ×1.3, Force ×0.7, Magic ×1.0. (Got st20 wrong as Force first.)
- **[Veil] hides from SINGLE-TARGET targeting; AoE hits veiled champs anyway** (Mike) — so only true boss AoEs are clean DEF samples; wave single-target "simultaneous drops" are multiple mobs bunched in <0.1s (their affinity signature reads backwards → the tell).
- To derive from a clean hit: isolate a boss AoE where all 5 allies drop on one frame; exclude Scorch/DoT/%maxHP; the cross-ally ratio cancels the attacker ATK.
- Prior handoff: `HANDOFF_2026-08-12_recipe-burndown-ops-and-agent-authoring.md`. Durable: MODEL≠SIMULATOR; IMPLEMENT/MEASURE, NEVER FIT.
