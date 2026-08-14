# HANDOFF — st20 wave engine decoded: it was MISSING MECHANICS, not wrong formulas (2026-08-13b)

**Branch:** `session/qa-rungs-2026-07-23`  ·  **Tip:** `a010a62` (committed, **NOT pushed**)
**Read first:** memory `[[handcalc-turn-economy-before-damage-2026-08-13]]` (the durable lesson), then this.

---

## 30-SECOND ORIENTATION

Started on thread #1 from the prior handoff: "why does the sim over-punish DonaHilvi Dragon **st20**
(sim WR 38% vs real ~91%, taken 2-3× over, turns 215 vs 121)." I spent the first half chasing the WRONG
answer — the DEF-mitigation formula and the enemy ATK ladder (downstream damage numbers). **Mike (walking
the video, the sensor) corrected me three times.** The real cause was **THREE missing MECHANICS** on this one
team, all the same root: I modeled each skill's PROSE + my assumptions instead of resolving every `[Bracket]`
keyword to its documented effect.

**The DonaHilvi st20 team wins by TURN-DENIAL + INFEST CHAIN-DETONATION, not tanking:**
1. **Freeze-lock** (Hilvi A2 freezes all mobs — ~31% of mob turns do nothing).
2. **[True Fear]** (Xeno A2 on all other mobs) = **restricted to DEFAULT SKILL (A1), NOT a turn-skip** — locks
   them off their nukes.
3. **Outspeed** (team 148-196 vs mobs 95-101) → mobs barely act.
4. **Poison** melts the frozen mobs (DEF-independent), then
5. **[Infest] death-explosion** (Xeno): an Infested mob dying to poison deals **50%·its-maxHP PURE AoE** to all
   surviving mobs, **CHAINS**. This is the single biggest wave-clear source (~373k). **No 10% "minion" cap** —
   Dragon wave mobs are separate champions, not Hellrazor's minions (glossary wrongly calls Infest "weak in dungeons").

**Durable discipline (Mike, load-bearing):** RESOLVE EVERY `[Bracket]` on both sides to its real effect, and
model **who-acts-when (CC + Fear + speed + TM) BEFORE any damage formula.** Never defer a mechanic as "minor"
without a measurement. Ask "what is this team's STRATEGY?" up front. Don't recalibrate a load-bearing formula
(defMitigation) off rare noisy mob-hit anchors — clean captures are rare precisely because mobs are locked down.

---

## WHAT SHIPPED — commit `a010a62` (NOT pushed)

| File | Change |
|---|---|
| `lib/sim/recipes.js` | **Authored `XENOMORPH-A2`** (+ `F_XENO_A2` 5.9 ATK). Was falling through to kitToRecipe → placed NEITHER Infest nor True Fear. Now: [Stun]+[Infest] on target, [True Fear] on all enemies. |
| `lib/sim/engine.js` | **`explodeInfest`** + `checkDeaths` now LOOPS (chains). 50%·maxHP PURE to same-side survivors; 10% cap only for boss/minions; credited to the Infest placer (reads `inf.sources`). |
| `lib/sim/engine.js` | **[Fear]/[True Fear] → A1-restriction** (was turn-skip). Sets `actor._forceDefaultSkill`, consumed in `pickSkill` + `pickEnemySkill`. Corrects the old "misfire/forfeit" model. |
| `tools/handcalc/dragon.mjs` | **NEW** independent turn-by-turn Dragon hand-calc (clone of `cb.mjs` per `DUNGEON_TEMPLATE.md`; imports NOTHING from lib/sim). Walks st20 wave 1. |

**Verified:** selftest **156/0**; sim-suite **Dragon 68.3%** (≈ prior 68.5%, NEUTRAL — no regression);
st20 **median turns FIXED** (215→~121, now passes); **wave 1 now clears** via the Infest chain.

---

## ⚠ THE HONEST CATCH — st20 WR did NOT improve (38%→23%)

The mechanics are CORRECT and turn-count is fixed, but WR fell. Loss localization (40 seeds):
**boss 17 · wave 2 13 · wave 1 1.** Two reasons, both now SHARPLY localized:

1. **Boss phase (17/40) is the DOMINANT loss driver** — untouched by these wave mechanics. This is the
   biggest remaining lever (Scorch / purple-bar / survival). START HERE next.
2. **True Fear, done right, EXPOSED a coupled bug:** it forces mobs onto their A1 — which is always an
   ATTACK — instead of their non-damaging A2/A3 (Crossbowman's Sharp-Eye buff, Hordin's self-buff). Combined
   with the sim's **mob A1 hits being ~1.8× too big at L280**, forcing A1 attacks over-punishes the waves.
   ⭐ The evidence is a CLEAN structural signal, not a noisy anchor: **hand-calc Crossbowman A1 basic = 15,063
   > real Crossbowman A3 nuke = 13,200.** A basic attack cannot exceed a nuke → the per-hit magnitude at L280
   is somewhat too hot. (Mike confirmed mobs ARE genuinely L280 and the ATK/DEF ladder is first-party correct,
   seed 211 — so this is the `defMitigation` LEVEL-scaling, not the data. But do NOT fit it to sparse anchors.)

---

## FIRST-PARTY ANCHORS (Mike video, 2026-08-13) — reuse to validate

- **Tayrel A2 Singing Steel** (DEF×3.5, AoE) with Decrease DEF + Decrease ATK on Tayrel: **~3,208 normal / 4,050 crit**.
  Reconciles because Tayrel's dmg ∝ his OWN DEF → [Decrease Defense] cripples his output (×0.4), + [Decrease Attack] ×0.5.
  ([Decrease Attack] does NOT reduce a DEF-scaling skill; only [Decrease Defense] does.)
- **Crossbowman A3 Blunted Arrow** (ATK×5.5): **13,200 normal / ~14,640 crit** on Mikey (Taunt+shield).
- **Hordin A2 Bloodletter** (ATK×6.5) with Decrease ATK: **15,389**.
- **[Infest] explosion:** a **Crossbowman (maxHP 144,429)** dying under Infest dealt **72,214** (=50%) to Hordin
  AND Tayrel (Tayrel's number didn't DISPLAY — a real mob can die "with HP left" during a death cascade).
- st20 mobs (seed 211, hand-read): Tayrel HP168516/ATK5894/DEF4381; Hordin 177770/8363/2947;
  Crossbowman 144429/7168/3266; Apothecary 175910/5814/3266. All L280, Magic, cr15/cd50.
- ⚠ **STALE FIXTURE BUILD:** real in-battle HP is 10-60% ABOVE `data/observed-builds/donahilvi-dragon-ezio-xeno.json`
  (Ezio 31,099 real vs 19,271 build). `tools/handcalc/dragon.mjs` has both (REALHP=1 knob).

---

## OPEN THREADS (ranked)

1. ⭐ **Boss-phase survival at st20** — the dominant loss driver (17/40). The wave engine is now modeled;
   the boss phase is where WR is lost. Read `DRAGON_REVIEW.md` + `[[dragon-survival-wipes-masteries-and-purple-bar-2026-08-12]]`.
2. **Mob per-hit magnitude at L280** — `defMitigation` over-penetrates DEF at high enemy level (real behaves
   ~L60; first-party DEF ratio 1.26 = L60, and A1>nuke inversion). ⚠ It's a load-bearing formula used by EVERY
   dungeon/boss — recalibrate the level term ONLY with a proper derivation, and re-check the Dragon boss
   coefficients didn't silently absorb the old over-penetration. Don't fit to 3 anchors.
3. **Xeno revive-on-Infest-death passive** (deferred in `XENOMORPH-A2`) — Xeno self-revives 50% HP when an
   Infested enemy dies; on this team that's frequent → real sustain not modelled.
4. **`a010a62` is NOT pushed** — review then push.

## HOW TO RUN
- Hand-calc walk: `TRACE=1 node tools/handcalc/dragon.mjs` (knobs: `REALHP=1`, `ENEMYLVL=60`).
- Metric: `node --env-file=.env.local tools/sim-per-hero-bands.mjs 40` (st20 in CONTENTS) ·
  `node --env-file=.env.local tools/sim-suite.mjs` (headline) · `node --env-file=.env.local tools/sim-selftest.mjs`.
- Reality captures: `gestal-sync/RslBattleReader/output/battle-log.json` (st20 DonaHilvi wins have per-ally HP traces).
- Prior handoff: `HANDOFF_2026-08-13_reader-perhero-fixed-and-def-validated.md`.
  Durable: MODEL≠SIMULATOR; resolve every bracket; IMPLEMENT/MEASURE, never FIT.
