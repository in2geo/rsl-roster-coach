# HANDOFF — 2026-07-29 — Survival Oracle, Poison Model, and the Spider Damage Wall

**Branch:** `session/qa-rungs-2026-07-23`  ·  **This session's commits:** `2e97b27` → `6389ef8` → `18cc3e2` (working tree clean).
**One-line state:** Spider-13 SURVIVAL is now largely modelled correctly; the team still loses because it does **~4× too little damage to Skavag** — that is the whole next job, and it is a damage-side problem the Survival Oracle does not measure.

---

## 0. Cold-start orientation (read this first)

If you read nothing else: we spent this session turning "the Spider sim loses 100% of the time" into a **localized, single remaining bug**. Do NOT re-open the survival mechanics below — they are confirmed correct by first-party observation. Go straight to **§4 (the damage wall)**.

The mental model that carried the whole session: **the Survival Oracle** — a QA rung that checks what the team *takes*, not what it *deals*. It exists because the entire QA ladder was blind to the receiving side, which let two poison bugs walk straight through. Whenever you touch Spider, run the oracle; it is the gauge.

```
node --env-file=.env.local tools/sim-survival-oracle.mjs 60 "Spider's Den" 13
```

---

## 1. What shipped this session

| Commit | What |
|--------|------|
| `2e97b27` | **Survival Oracle** rung (`tools/sim-survival-oracle.mjs`) + wired into `sim-qa`. **Engine-wide poison-model fix** (per-stack aging + `landDebuff` ACC/RES roll + Spiderling ~37% placement + ACC=75). Per-hero `taken`/`healed` accounting in engine+interpreter. |
| `6389ef8` | Poison-decay **invariant** (`sim-invariants`) + "immortal poison" **mutant** (`sim-mutants`, killed) — mutation teeth for the fix. |
| `18cc3e2` | Skavag consume ATK ramp: **additive-on-base, not compounding**. |

Dragon golden stayed **byte-identical (37/37)** and snapshot **clean** through all of it — every change was Spider-local or additive recording.

---

## 2. The Survival Oracle — the durable takeaway

**The blind spot it closes:** the ladder validated what the team DEALS (damage-dealt residual, win-rate, golden outcome) and whether a mechanic FIRES (turn-verify, fired-vs-consumed) — but never what the team **TAKES** or an effect's **MAGNITUDE** vs reality. So poison could be 40× too hot and every rung stayed green (it still "fired", still "dealt damage", still matched a golden blessed *while broken*). That is why the two poison bugs survived.

**How it works:** Monte-Carlo the sim, assert each hero's **damage-taken per alive-turn** within ±3× a reality band from `data/manual-captures.json`. Spider-13 **GATES** (≥3 captures → blocks, bucket-1). Dragon-16 is **REPORT-ONLY** (single reader anchor, `expected.per_hero` — one suspect capture, do not gate on it). It caught the poison bug at 4–7× on Spider AND 23× on Dragon (engine-wide, invisible to win-rate because Dragon still WON).

**Current oracle reading (Spider-13):** 4/5 heroes in band; only **Bambus (~6×)** fails, and that is a *wipe symptom* — he is the tankiest, so he is last-standing and eats the ramped AoE after everyone else is dead. Fix the damage wall → team wins → Bambus drops into band on its own.

---

## 3. Confirmed Spider-13 mechanics — DO NOT RE-LITIGATE

First-party confirmed by Mike (watching battles) + trace this session. The sim models all of these correctly:

- **Swarm is a full ~10 Spiderlings** — population is not the difference.
- **Pelops RES = 57** (30+27, sim value correct) — resistance is NOT the answer; Spiderling Poison lands ~35% via a **placement chance** (`SIM_SPIDERLING_POISON_CHANCE=0.37`), Spiderling **ACC=75** (the DB add-row's 100 is the in-game "suggested resistance" number, not ACC).
- **Targeting = focus-fire**: all Spiderlings hold ONE target until it dies or Pelops re-taunts (his A3 Taunt, cd4/2t). Squishies (Ezio/Vergis, 16k HP) die when focused; **Tagoar revives** them; **Tagoar dying = wipe**. Do NOT change `chooseSingleTarget` to spread.
- **Skavag consume rotation** (2-turn): Meal turn eats every Spiderling (heal 3%/each, **+10% of BASE ATK/each, ADDITIVE**), Digestion turn AoE (Venom Spray 2.5×ATK / Stupefying Silk 3.0×ATK — datamined, unverified).
- **Mitigation (all firing):** Pelops A3 passive **−20% to all allies** (off when he is dead / under Decrease DEF); Pelops A3 **Magma Shield on all 5 allies** (30% of his MaxHP ≈ 8.7k each, absorbs + reflects); Tagoar A2 **heal** 15% MaxHP AoE; Tagoar A3 revive + shield; Vergis DEF/Ally-Protection/Continuous-Heal.
- **Lifesteal does NOT tick with DoTs** (Mike). Pelops's ~137k heal is lifesteal off his **attacks + Magma-reflection**, NOT his HP Burn. Do NOT wire HP-Burn lifesteal.
- **Low sim "healed" is an OVERHEAL artifact** — the team stays topped-off from good mitigation, so heals restore ~0. It is not a missing-heal bug.

---

## 4. THE NEXT LEVER — the Spider damage wall (start here)

**Problem:** the team survives fine now but **never kills Skavag**. Every trace ends with her at **83–100% HP**. She has ~1.06M MaxHP; the team removes ~17% by t120; reality kills her by ~186t. So team damage-to-Skavag is **~4× too slow** — the fight runs long enough for the (now-linear) ramp to eventually wipe them.

**What I already ruled in/out:**
- Magma reflection IS firing on all 5 allies — but the shields get **eaten down by the swarm** (8.7k → ~1.5–5.5k by t14) and Pelops only refreshes every 4 turns, so for much of each cycle there is little shield left to reflect Skavag's AoE back into her.
- Poison to Skavag is reduced 90% ("Healing Assured") — correct, so Poison is not the boss-damage path.

**The open question for Mike (ask first thing):**
> When you watch Spider-13, what is actually landing the killing damage on Skavag — the **Magma-Shield reflection**, **Pelops's HP-Burn splash** (his burn on the Spiderlings splashes 3% of her MaxHP onto her every tick), or the **Bambus poison redirect**?

That answer picks the thread. Likely suspects in the sim:
1. **HP-Burn splash cadence** — is Pelops's HP Burn staying applied on the Spiderlings (so it splashes onto Skavag every tick)? The consume eats Spiderlings every 2 turns, which may be stripping the burn before it ticks.
2. **Reflection magnitude / shield uptime** — bigger/steadier Magma Shields would reflect more of her ramping AoE.
3. **Bambus poison redirect** — the Dragon-16 engine (Wall-of-Fire → sponge → dump on the boss) — is the analogous Spider path delivering? See `dragon16-bambus-poison-redirect-rootcause-2026-07-26` memory.

**Reproduce the wall:**
```
# boss HP% at wipe + per-hero taken (survival oracle)
node --env-file=.env.local tools/sim-survival-oracle.mjs 60 "Spider's Den" 13
```
To measure damage-to-Skavag per source, instrument `state.effects` filtered to `target === boss.name` (kind 'dot' = HP-Burn/Poison, 'damage' = direct/reflect), or hook `dealDamage`'s reflect path (`attacker.hp -= reflected` where attacker is the boss). Build the battle with `buildBattle({rest, fixture, repoRoot})` on `test/golden/spider13-donbambus-current.json`, `applyBattleLayers(allies)`, `installRecipeRun(st)`.

---

## 5. Open follow-ups (small, deferred)

- **`sim-mutants` teeth for the scripted-poison landing roll** (`landDebuff`) — needs a DB battle to exercise, so no no-DB mutant yet. (The immortal-poison mutant IS covered.)
- **Bambus ~6× oracle failure** — expected to self-resolve once the team can win; re-check after the damage wall.
- **Dragon Survival Oracle is report-only** — needs multi-capture per-hero taken to gate (reader per-hero dungeon capture is broken; see `rslbattlereader-status`). The single `expected.per_hero` anchor (Ezio taken 3509) is flagged suspect.
- **Venom Spray 2.5× / Silk 3.0× coefficients** are community-datamined, unverified — worth confirming from the card if the damage math needs them.

---

## 6. Key files touched this session

- `lib/sim/engine.js` — `upsert`/`expireDurations` (per-stack poison aging), `landDebuff()`, `taken`/`healed` accounting.
- `lib/sim/spider.js` — `landDebuff` for Spiderling poison, `SPIDERLING_POISON_CHANCE`, additive `atk0`/`spidersEaten` ramp.
- `lib/sim/dragon.js` — `landDebuff` for Wall-of-Fire poison.
- `lib/sim/dragon-fixture.js` — Spiderling ACC=75 override.
- `lib/sim/interpreter.js` — `healed`/`taken` accounting at heal/self-damage sites.
- `tools/sim-survival-oracle.mjs` (new), `tools/sim-qa.mjs` (wired), `tools/sim-invariants.mjs` + `tools/sim-mutants.mjs` (poison-decay teeth).
- `data/manual-captures.json` — 16 Spider-13 captures (wins + defeats; per-hero dealt/taken/healed; `energy` dedup key).

**Reality anchor for Spider-13:** ~79% WR; wins are knife-edge near-wipes (down to 1 survivor), ~t85–210; per-hero damage-TAKEN is small and bounded (~8–93k total over the fight); Pelops taken ranges 14.5k–93k.
