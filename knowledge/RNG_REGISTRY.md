# RNG_REGISTRY.md — the canonical enumeration of every stochastic mechanic, and whether the engine rolls it

**Source of truth for "what is subject to RNG in Raid combat, and is our engine actually rolling it."**
Derived from `RNG Engine Info.docx` (Mike, Plarium-cited) intersected with the live engine
(`lib/sim/engine.js`, `lib/sim/interpreter.js`). This is the RNG-specific instance of the project's
standing discipline: **MENTION ≠ MODELLED**, and its sharper RNG-edition sibling —
**MODELLED-DETERMINISTICALLY ≠ ROLLED**. A mechanic that is "in the engine" but resolved to a fixed
value or an expected value when the real game rolls it is a silent hole, and the handoff's
100%-sim-vs-88.5%-reality gap is believed to live exactly there (buffs/procs that never lapse).

## How to read the status column (THREE states, not two)

- **ROLLED** — draws from a seeded stream on its stochastic path. ✅
- **EV / DETERMINISTIC-BUT-SHOULD-ROLL** — resolved to a fixed or expected value where Raid rolls it.
  This is the failure mode the coverage audit exists to find. ⚠
- **NOT MODELLED** — absent entirely. ❌
- **DETERMINISTIC (CORRECT)** — Raid resolves it deterministically too; rolling it would be a *bug*. ✅det

Determinism is the DEFAULT: `makeState({seed:null})` runs with `state.rng === null` and every roll
collapses to the v0 threshold, so the Model (teeth tests) stays byte-for-byte reproducible. RNG is
opt-in via a seed. Any change here MUST preserve the `seed===null` path exactly.

## Current streams (`RNG_STREAMS`, engine.js)

`['damage', 'crit', 'affinity', 'debuff', 'target', 'ai', 'mastery']` — each independently seeded off
the master (append-only, so adding a stream never perturbs the earlier streams' sequences). Live-draw
status as of this writing:

| stream | drawn by | status |
|---|---|---|
| `debuff` | placement chance + ACC/RES land (8 sites) | ✅ workhorse |
| `crit` | `critMult` | ✅ |
| `damage` | `dmgVariance` (default OFF) + interpreter damage-mod chance | ⚠ mostly dormant |
| `target` | interpreter `random_ally` only | ⚠ barely used |
| `mastery` | Warmaster/Giant Slayer proc | ✅ (added with this doc) |
| `affinity` | — | ❌ **declared, never drawn** (see WEAK/STRONG_HIT) |
| `ai` | — | ❌ **declared, never drawn** (reserved for AI-choice RNG) |

## The registry — doc roll type → engine status

Priority = relevance to the only first-party-validated cell (DonBambus Dragon-16). The Dragon boss is
Void (ignores affinity); waves carry affinities, so affinity RNG affects **wave clear speed → incoming
→ healer survival**, which is the coupled chain the survival gap runs through.

| # | Roll type (doc) | Real-Raid basis (Plarium-cited in doc) | Engine status | Stream | Priority |
|---|---|---|---|---|---|
| 1 | **DAMAGE_VARIANCE** | per-hit variance on every direct-damage instance (also each AoE target, each multi-hit, counters, ally/bonus attacks) | ⚠ present, **default OFF**, range unverified | `damage` | HIGH — the literal "rolled low → someone died" window; blocked on a verified ±% |
| 2 | **CRITICAL_HIT** | each eligible hit rolls vs effective C.Rate | ✅ ROLLED | `crit` | — (but no affinity interaction, see #3) |
| 3 | **WEAK_HIT / STRONG_HIT** | advantage: 50% Strong + 15% C.Rate. disadvantage: −20% flat + 35% Weak (−30%); Strong = +30% | ✅→ **ROLLED** (seeded); seed=null = v0 1.30/0.70 | `affinity` (live) | DONE (damage layer). ⏳ DEFERRED: advantage +15% crit, weak-hit blocks effect placement (not Damage/Heal), disadvantage weak/crit/normal resolution |
| 4 | **HIT_TYPE_CONVERSION** | gear/skills convert Weak→Crit (Affinitybreaker), Crit→Normal (Reaction) | ❌ NOT MODELLED | — | LOW — gear-tier, out of current scope |
| 5 | **SKILL_PROC** | any "X% chance to place/remove/…" | ⚠ rolls `d.chance` on debuffs; mostly **inert (chance data absent)** EXCEPT **CC placement now reads the chance from skill text** (Stun/Sleep, `readSkillKit` 2026-07-25) | `debuff` | HIGH (blocked) — the "76×" top data backlog; doc: **granularity must be STORED, not inferred from %**. CC extraction is the first partial |
| 6 | **ACCURACY_RESISTANCE** | separate ACC-vs-RES check AFTER skill proc; must not be combined | ✅ ROLLED (`landChance`) | `debuff` | — (two-stage structure already correct) |
| 7 | **RANDOM_TARGET** | attack/buff/debuff/revive/redirect a random eligible unit | ⚠ `random_ally` only | `target` | MED — need random-enemy / redirect / random-revive; eligible-set-then-sample |
| 8 | **RANDOM_SKILL** | reduce/increase CD of a random skill | ❌ NOT MODELLED | — | LOW |
| 9 | **RANDOM_BUFF** | remove/steal a random buff | ❌ NOT MODELLED | — | LOW |
| 10 | **RANDOM_DEBUFF** | remove/transfer/spread a random debuff | ❌ NOT MODELLED (tag policy rejects random-pool) | — | LOW |
| 11 | **RANDOM_EFFECT** | place one of several / activate one of several | ❌ NOT MODELLED | — | LOW |
| 12 | **BONUS_DAMAGE_OR_ATTACK_PROC** | repeat/extra-hit/bonus/join attack (e.g. Slayer set repeats AoE) | ❌ NOT MODELLED | — | MED — added attack generates its own downstream rolls |
| 13 | **EXTRA_TURN** | Relentless etc.: chance + **diminishing** on consecutive extra turns | ❌ NOT MODELLED | — | MED — large turn-economy effect if any unit has it (check roster) |
| 14 | **COUNTERATTACK_PROC / REACTION_PROC** | chance-based counters/reactions (passive, Retaliation/Avenging gear, masteries) | ⚠ on-attacked fires at **100% deterministic** | `mastery`?/new | MED — chance-gate where real proc <100% |
| 15 | **FEAR_ACTIVATION** | Fear/True Fear: **50%** the skill fails and the turn is lost (True Fear also puts it on CD) | ❌ NOT MODELLED (Fear is NOT in `CC_SKIPS_TURN`) | — | MED if Fear is in play; occurs after skill selection, before execution |
| 16 | **SHEEP_REMOVAL** | 50% to remove Sheep after the Sheep-skill attack | ❌ NOT MODELLED | — | LOW |
| 17 | **EFFECT_BLOCK / EFFECT_DEFLECT / BUFF_PROTECTION / COOLDOWN_PREVENTION** | Deflection, Frostbite, Feral, Stone Skin, Protection, Refresh — distinct stages, NOT one generic "resist" | ❌ NOT MODELLED | — | LOW — gear-tier |
| 18 | **GEAR_PROC** | Stun/Sleep/Provoke/Poison/Freeze sets, Slayer repeat, etc. | ✅ **WIRED (on-attack placement family)** — `gear` stream, gated on COMPLETE sets, IGNORES ACC/RES, 1 roll/target (`lib/sim/gear.js` + `fireGearProcs`). ⏳ DEFERRED: counters (Retaliation/Avenging/Frost) · extra-turn (Relentless) · cooldown (Reflex/Impulse/Merciless) · Slayer repeat · defensive (Deflection/StoneSkin/Protection/Feral) — surfaced via `gearDeferred`. ⏳ recipe-path firing (applySkill only for now) | `gear` | INERT for Dragon-16 (team has NO complete proc set — all ×1 partials); census-proven, matters for other teams |
| 19 | **ACCESSORY_PROC** | remove random debuff, prevent CD, Crit→Normal, counter-on-hit | ❌ NOT MODELLED | — | LOW |
| 20 | **MASTERY_PROC** | Warmaster/Giant Slayer (60%), Cycle of Magic/Revenge, Retribution, Deterrence… | ⚠→✅ **Warmaster now ROLLED** (was EV `0.024`); rest of tree ignored | `mastery` | HIGH — done for Warmaster |
| 21 | **BLESSING_PROC** | chance procs; **varies by Awakening level** → store prob/eligibility by level | ❌ NOT MODELLED | — | LOW — app doesn't collect blessings yet |
| 22 | **RELIC_PROC** | chance effects not in the champion's native kit | ❌ NOT MODELLED | — | LOW |
| 23 | **PASSIVE_PROC** | trigger condition deterministic; **activation can still be a chance roll** | ⚠ passives fire at 100% | new | MED |
| 24 | **ENCOUNTER RNG** (ENCOUNTER_RANDOM_SELECTION / BOSS_SKILL_PROC / BOSS_TARGET_SELECTION) | Hydra head regrow, boss random target/effect | ❌ NOT MODELLED (dragon.js boss is scripted/deterministic) | — | LOW for Dragon — doc says attach to the ENCOUNTER def, not the universal engine |
| 25 | **TIE_BREAK** (unverified) | equal TM/SPD, equal lowest-HP%, equal targeting scores | ✅det deterministic tie-break | — | **doc says DO NOT auto-RNG — test for a hidden deterministic order first.** Current determinism is the correct posture; supersedes the "speed-tie owed" TODO |

## What is DETERMINISTIC and must stay so (doc's "not independently random")

The engine already treats all of these deterministically — this is CORRECT, do not "fix" them into
rolls: turn order from SPD/TM · normal AI skill selection · normal targeting rules · cooldown &
duration countdown · DEF mitigation · shield absorption · Ally-Protection damage division · **Poison /
HP Burn tick values** · healing formulas · Turn-Meter amounts · condition checks ("target below 50%") ·
death/revive eligibility · target eligibility · boss skill rotations · guaranteed passives/effects ·
which target is lowest-HP (given no unresolved tie). Random damage may *change* which enemy is lowest-HP,
but *selecting* that enemy afterward is deterministic.

## The roll-record schema (the census target)

The doc specifies exactly the FIRED/ROLLED/CONSUMED extension proposed for the effect ledger. A full
roll record should carry: RNG type · source ID · trigger event · acting unit · recipient/eligible
candidates · base probability · modified probability · roll granularity · random value · pass/fail or
selected outcome · parent event · pre-roll state · seed & RNG-stream position. The effect ledger
(`recordEffect`) records fired/consumed/note today; the census rung (`tools/sim-effects.mjs`) should be
extended to assert **every RNG-subject effect has `rolled=true` on its stochastic path** (auto-flags any
new deterministic-should-be-stochastic mechanic) and that the **empirical rate ≈ stated `p`** over N
seeded runs. A `rolled` field has been added to the Warmaster records as the first step.

## Data blockers (why the long tail can't just be turned on)

IMPLEMENT-DON'T-FIT forbids inventing probabilities. These are blocked on data capture, not code:
- **SKILL_PROC chances** — `champion_skills` has no per-effect chance column populated; `d.chance` is
  null across the board ("76× top backlog", `GAME_MECHANICS_INVENTORY.md`).
- **Strong/Weak damage MAGNITUDE** (#3) — the doc gives the *probabilities* (50%/35%/+15% crit) but not
  the damage multiplier of a Strong vs Weak hit. Do not activate the affinity damage roll with a guessed
  magnitude; the current 1.30/0.70 nominal is EV-like and stays until the magnitude is source-verified.
- **GEAR_PROC / ACCESSORY / BLESSING / RELIC** — the app does not yet collect this loadout data.

## Change log
- 2026-07-25 — created from `RNG Engine Info.docx`. Added the `mastery` stream and converted Warmaster
  from a baked EV (`0.024 = 0.04 × 0.60`) to a rolled 60% proc (EV-preserving: `WARMASTER_RAW =
  WARMASTER_MAXHP / WARMASTER_PROC`). No new fitted constant. Added `rolled` to Warmaster ledger records.
- 2026-07-25 — **affinity WEAK/STRONG hit implemented** (#3) from Plarium's official affinity guide
  (two screenshots): the two-layer model on the `affinity` stream (now LIVE) — advantage 50% Strong
  (×1.30), disadvantage flat −20% + 35% Weak (×0.70); seed=null keeps v0 1.30/0.70 (golden/teeth frozen,
  verified 8/8 · 120/120). Named constants `STRONG_HIT_CHANCE`/`WEAK_HIT_CHANCE` (⚠ graph says 30% Strong
  — CONFIRMED in-game by Mike: 50% Strong-hit CHANCE, +30% DAMAGE; the graph's "+30% Strong Hit Chance"
  label conflated the two). Volume UNCHANGED (100%, turns identical)
  — DECISIVE reason: **every Dragon-16 enemy is Void** (boss Hellrazor + all wave mobs Lua/Faceless/
  Arbalester/Renegade — DB-confirmed 2026-07-25), so affinity NEVER fires (Void = neutral). A pessimal
  bracket (advantage→Normal, disadvantage→always-Weak) ALSO gave byte-identical results — doubling as a
  POSITIVE CONTROL that the mobs are genuinely all-Void (a mis-seeded non-Void champ would have moved it).
  Affinity is a KEEP (correct, census-enforced) but INERT for this all-Void cell; matters only for non-Void
  content. Deferred: +15% advantage crit, weak-hit effect-block.
- 2026-07-25 — **GEAR_PROC definitions captured** (`data/gear-set-procs.json`, 20 chance-based sets,
  Plarium-verbatim) from the Artifact Sets reference.
- 2026-07-25 — **GEAR_PROC on-attack family WIRED** (`lib/sim/gear.js` `gearProcsForBuild` +
  `fireGearProcs` in `applySkill`, new `gear` stream). Gated on COMPLETE sets; gear debuffs IGNORE ACC/RES
  and roll once per target (doc §15). seed=null → threshold. Census 20/20 (gear live + Toxic fidelity
  probe). INERT for Dragon-16: every champ's proc sets (Toxic×1/Frost×1/Daze×1/Avenging×1) are INCOMPLETE
  ×1 partials → empty `gearProcs` → no-op (DB-confirmed) — the gear analogue of the all-Void mobs. Deferred
  families (counters/extra-turn/cooldown/repeat/defensive) + recipe-path firing surfaced as flags, not
  silently dropped. sim-effects BENIGN now treats "proc missed" as a documented non-consumption.
- 2026-07-25 — built the **roll census rung** (`tools/sim-rolls.mjs`, 15/15, wired into `model-qa.mjs` +
  the QA ladder). It EXECUTES this registry: instruments the stream bundle and asserts (B) each live
  mechanic draws its stream while `affinity`/`ai`/`target` stay dead, (C) each rolls at its stated `p`
  (Warmaster 60% / crit at C.Rate / debuff at ACC-RES land chance — deterministic boundary probes),
  (D) the roll flips world state, (E) streams are decorrelated (forcing crit doesn't perturb the debuff
  sequence). A deterministic-should-be-stochastic mechanic now fails a test instead of hiding in a
  constant — the audit self-enforces. Confirmed empirically: `damage` is dormant (SIM_DMG_VAR off).
