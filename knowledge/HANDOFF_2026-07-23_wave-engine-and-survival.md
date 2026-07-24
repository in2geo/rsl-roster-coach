# Session Handoff — 2026-07-23 (PM): engine unification, formula coeffs, turn-by-turn verification, and the SURVIVAL diagnosis

**COLD-START DOC — read this FIRST** (latest front). Then, in order: the ⭐⭐ memory
`wave-engine-unification-2026-07-23.md`, then `HANDOFF_2026-07-23_rng-montecarlo.md`, then the
⭐⭐/⭐⭐⭐ memories at the top of `MEMORY.md`.

**Branch/DB posture:** all work is on `session/qa-rungs-2026-07-23` (branched off `main`, **NOT yet
merged or pushed** — 9 commits `6812d1a`…`<reviews>`). DB unchanged this session. The wave stats seed
(211) is first-party in-game screenshots (Mike, 2026-07-23) and is applied live.

---

## 0. THE ONE-LINE STATE

The sim's OFFENSE now matches the real Dragon-16 fight in shape (AoE openers, HP-Burn grind, mobs
half-dead early). **The entire remaining gap is SURVIVAL** — and it is precisely diagnosed, not yet
built: the sim doesn't fire the passive/shield/taunt mechanics that keep the real team's protected
champions alive, so it kills the healers in wave 1. **Everything downstream (boss, purple bar, poison
explosion, Magma reflect) is blocked on survival.**

---

## 1. WHAT WAS BUILT (commits, in order)

- **`6812d1a` — 3 QA rungs.** Mutation (`sim-mutants.mjs`, rung 9, 100% kill rate), regression snapshot
  (`sim-snapshot.mjs`, rung 10, bless workflow), and the **reality trace-oracle** (`sim-trace.mjs`, rung
  3b) — runs the sim on a golden fixture's exact builds + real waves, compares turn-by-turn to the
  recording, reports the first divergence. All wired into `sim-qa.mjs`.
- **`b1b98a3` — per-hero oracle.** Trace-oracle also scores per-champion damage/healing/**taken** vs the
  recording. Catches "right result, wrong reasons."
- **`b62b979` — Pelops Lifesteal wired** (was discarded) + `TRACE=N` / `DUMP=Name` fight inspection.
- **`7b69dbc` — ENGINE UNIFIED.** Root cause of "wave mobs don't do their real skills": two code paths
  (`actChampion`/`applySkill` full vs a stripped `actEnemyMob`). Now `applySkill` is SIDE-AWARE
  (opponents/ownSide from `actor.side`); `actEnemyMob` = pick-skill-then-`applySkill`. Only the boss keeps
  a scripted kit. **⇒ enemy buffs/heals/revives/on-attacked/reflect all work for mobs for free; this is
  what ARENA needs and what Ice Golem / Fire Knight waves reuse — do NOT re-build wave execution per
  dungeon.**
- **`c8a3a4f` — formula coeffs.** `parseCoeff` is multi-term (`2.5 ATK + 0.2 HP`) + per-target-debuff
  bonus (`(2 + Total Debuff) ATK`, Arbalester A3, was dealing 0) + SPD stat; dynamic modifiers flagged.
- **`07c5899` — AI opens AoE when >1 enemy up** (Ezio A2 first, confirmed vs Plarium's documented AI:
  A2→A3→A1) + **`TURNLOG=lo-hi`** per-turn effect ledger (the "verify one turn at a time" tool).
- **`d62a15a` + reviews — battle-reviews folder.** `test/reviews/` = human ground-truth, one doc per
  recorded run; the oracle scores the machine-readable `test/golden/*.json` fixtures.

All green throughout: 120 spec / 8884 invariants / 12 sensitivity / 11 effects / 6-6 snapshot / 100%
mutation. Bucket 1 = 0.

---

## 2. THE SURVIVAL DIAGNOSIS (the session's payoff — done via turn-by-turn verification vs Mike's real run)

Mike walked the whole real fight turn-by-turn (screenshots + narration → `test/reviews/dragon16-2026-07-23.md`).
The `taken` column of the VICTORY screen IS the survival target:

| champ | taken (real) | taken (sim) | role |
|---|---|---|---|
| Ezio | 3,820 | ~17k | veiled — should be untouchable |
| Tagoar | **5,778** | **15,803 then dead** | healer — should be barely hit |
| Pelops | 23,205 | high | tank |
| Vergis | 45,610 (out-healed) | dies early | damage sponge |

**The signature of working protection: hits pile on the TANK + SPONGE; healers/veiled are barely touched.
The sim inverts this** — a mob hits Tagoar for 15,803 (65% of his HP) in wave 1 and kills him. So the gap
is NOT "not enough healing" (the real team heals 232k vs 88k taken); it is that **the sim doesn't keep the
hits off the protected champions.**

**The build backlog (all SURVIVAL, all now on solid first-party-data ground):**
1. **On-condition passive triggers** — Vergis **Second Wind** (Shield + Continuous Heal, parsed `[P]
   no-trigger` → never fires), Tagoar **Aid the Feeble** (−10% dmg to allies ≤50% HP), Pelops **−20% team
   damage reduction** (A3 passive). The engine only fires start-of-turn/start-of-battle/on-attacked; these
   need on-HP-threshold / each-round / conditional triggers.
2. **Shield uptime** — Tagoar unshielded t6→27; Pelops's Magma Shield fires t4 then t37 (cd counts per
   champion-turn, so a slow champ's cd4 = ~33 game-turns). Shields also "override" not stack.
3. **Ally Protection** — applied but not redistributing the big single-target hits.
4. **Taunt coverage** — ~50% uptime lets a mob (Renegade) dodge the taunt and never catch Pelops's HP Burn
   (real: all 5 burning by t15; sim: 4/5 by t9, Renegade t44).

Score any fix with `TURNLOG` + the oracle's per-hero `taken` vs the review. **Do NOT tune DEF_K to force
survival** — the mob stats/kits are first-party now, so the mitigation error (if any) is separate; implement
the passives first.

---

## 3. STILL OWED / NEXT (priority order)
1. **The passive-survival system** (highest leverage) — on-condition triggers for Second Wind / Aid the
   Feeble / Pelops −20%, then shield uptime, then Ally Protection redistribution, then taunt coverage.
2. **Boss-phase mechanics** (blocked until survival lets the sim reach R3): poison explosion/detonation
   (Ezio ~t124, unmodelled), the Magma reflect off the Dragon (~t153, modelled).
3. **Multi-hit** ("attacks N times" — Tagoar A1 2×, Lua/Renegade A2 3×): coefficient per hit, still 1×.
4. **Wire the Monte-Carlo rung (7) into `sim-qa`** and put a CI on its win rate.
5. Housekeeping: import the 2026-07-22 `.docx` review is DONE (now in `test/reviews/`); merge/push the
   branch when ready.

**Method that finally worked (Mike's insistence):** stop chasing aggregates and guessing — recreate the
battle ONE TURN AT A TIME (`TURNLOG`), compare each turn to the real recording, fix the first divergence,
re-run. That is what localized offense-fixed / survival-is-the-gap. Keep doing that.
