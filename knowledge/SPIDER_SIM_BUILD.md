# Spider's Den — SIM build design (for review, 2026-07-28)

**Goal:** make `lib/sim` able to run a Spider's Den (Skavag) battle — the SECOND dungeon. Supporting a
second dungeon at all is what forces `buildDragonBattle` → `buildBattle(dungeon)` to become generic, so this
build IS P3 weld (1). Source mechanics: `SPIDER_REVIEW.md §1` (authoritative boss kit). This is a design to
approve BEFORE any engine code is written.

## Findings that shape the design (verified this session)
- **Data is already seeded AND app-validated** (Mike's Stage 1–4 encounter screenshots, 2026-07-28).
  `dungeon_stage_enemies` = 2 rows/stage: Skavag `boss` + ONE Spiderling `add` TEMPLATE (confirmed — the app
  renders a single Spiderling alongside Skavag as "Wave 1", not fixed instances). Stats match the DB exactly
  (S1 Skavag 71,430/238/95 · Spiderling 2,850/143/150; scaling up per stage). `dungeon_stage_affinities` = 25
  rows; the per-stage affinity applies to BOTH units. No data gathering needed.
- **Skavag / Spiderling are CONTENT-ONLY** (not player champions; `champion_id = NULL`). Same as **Hellrazor**
  — the Dragon boss is content-only too. Consequence: they are **SCRIPTED in `makeSpiderContent`** (like
  `makeHellrazor` in `dragon.js`), NOT authored as champion recipes. So they add nothing to `RECIPES` and the
  P3(2b) recipe-registry guard needs no carve-out. (Contrast Dragon *mobs* — Tayrel/Hordin/etc. ARE real
  champions, run via the recipe interpreter. Spider has no such mobs.)
- **Spider is single-phase** (no wave/boss split) — `SPIDER_REVIEW.md §2`.
- **No Spider battle recording exists** → the Spider sim can be gate-1 (spec-conformant) only; gate-2
  (reality) waits on a capture. Same split we use for Dragon.

---

## Slice A — the generic builder adapter (weld 1), behaviour-preserving

Today `buildDragonBattle({rest, fixture, repoRoot})` (`lib/sim/dragon-fixture.js`) hard-codes: the dungeon
name gate, `makeDragonContent`, `HELLRAZOR_IMMUNE`, the `wave`-role grouping, and `dragon-wave-data.json`
levels. Everything else (champion load, name resolver, boss build from the DB row, exact ally builds from the
fixture) is dungeon-agnostic already.

**Change:** rename to `buildBattle(...)`; move the Dragon-specific bits into a per-dungeon CONFIG registry:

```
const DUNGEONS = {
  "Dragon's Lair": {
    bossImmune:  HELLRAZOR_IMMUNE,
    levelFor:    (stage, repoRoot) => <read data/dragon-wave-data.json>,   // Spider: () => 60 (or a source)
    buildEnemies: (rows, stage, ctx) => ({ waves }),        // role 'wave' grouped by wave_number
    makeContent: ({stage, boss, waves}) => makeDragonContent({ stageNumber: stage, purpleBarHp: 0.20*boss.maxHp, waves, boss }),
  },
  "Spider's Den": {
    bossImmune:  SKAVAG_IMMUNE,
    levelFor:    () => 60,                                   // (until a Spider level source is confirmed)
    buildEnemies: (rows, stage, ctx) => ({ spawnTemplate }),// role 'add' → ONE Spiderling template (not fixed instances)
    makeContent: ({stage, boss, spawnTemplate}) => makeSpiderContent({ stageNumber: stage, boss, spawnTemplate, spawn: SPIDER_SPAWN }),
  },
};
```

`buildBattle` dispatches on `fixture.content.dungeon`. **Back-compat:** keep `export const buildDragonBattle =
buildBattle` so the four callers (`sim-trace`, `sim-golden`, `sim-fixture-volume`, `model-golden`) don't
change. **Dragon path stays byte-identical** — verified by model-golden 7/7 + model-snapshot no-drift + the
full ladders. This slice ships de-Dragoning with zero behaviour change; it's the safe first step.

---

## Slice B — `makeSpiderContent` + the spawn/consume engine primitive

`makeSpiderContent({stageNumber, boss, spawnTemplate, spawn})` returns a single-phase content:
`{ phases: [{ name: 'skavag', enemies: [boss], actEnemy: actSpider }], onRoundStart, lifestealFactor: 0.35,
   maxHpDamageCap: (stage>=21 ? 0.10 : null) }`.

New engine touchpoints (all no-ops for Dragon → byte-identical) — see the AUTHORITATIVE spec below for the
exact numbers:
- **Event-driven spawn hooks** in `simulate()` — `content.onBattleStart` (spawn 6), `content.onTurnStart(state,
  actor, {extra})` fired at the start of EVERY turn incl. extra turns (Spider: `actor.side==='ally'` → spawn
  `min(2, 10−living)`), and Skavag's own turn-end (spawn `min(4, 10−living)`). Dragon sets none → no-op.
  Spawn = `makeCombatant` from `spawnTemplate` (role `add`, stage affinity, level), pushed to `state.enemies`.
- **Skavag turn-start CONSUME + snowball** (in `actSpider`, BEFORE her attack, ALTERNATING turns, only when
  ≥1 Spiderling): consume ALL living Spiderlings → `boss.hp = min(maxHp, hp + 0.03*maxHp*N)`, `boss.atk *=
  (1 + 0.10*N)` PERMANENT. The longer the fight, the stronger she gets. Recorded to the effect ledger.
- **`content.lifestealFactor`** consumed in the engine's lifesteal heal (Dragon unset → 1.0). Spider = 0.35
  ("lifesteal heals only 35% vs Spider").
- **`SKAVAG_IMMUNE`** — the FULL Almighty Immunity list, VERBATIM from the in-game card (Tier-1):
  `['Stun','Freeze','Sleep','Provoke','Block Active Skills','Block Passive Skills','Fear','True Fear',
  'Petrification','Berserk','Enfeeble','Nullify','Ensnare','Fatigue',"Hunter's Gaze"]` + immune to HP-exchange,
  HP-balancing, and cooldown-increase effects. Plus **Healing Assured**: immune to `Heal Reduction`. CC lands
  on Spiderlings (not immune), never Skavag.
- **Healing Assured REDUCES Poison damage to Skavag to 10% of normal — a 90% reduction** (EMPIRICALLY
  VALIDATED, Mike 2026-07-28; high confidence, not a bracket). → `content.poisonDamageFactorVsBoss = 0.10`,
  applied in `tickDots` when the target is Skavag. **Big modelling consequence:** raw Poison ticks are nearly
  worthless ON the boss, so the sim will (correctly) show the 15–25 kill coming from Poison Explosion / %MaxHP
  skills / HP Burn, NOT Poison stacks — matches why `SPIDER_REVIEW` lists those as the wall/endgame damage.
  (Poison on the SPIDERLINGS is unreduced.)
- **Lifesteal 35%** applies vs BOTH Skavag AND her Spiderlings (card: "when attacking Skavag or her
  Spiderlings") → `content.lifestealFactor = 0.35` applies to any Spider enemy, not just the boss.
- **Spiderling action** (`actSpider` when actor is an add): **SINGLE-target** attack that applies **TWO 5%
  MaxHP Poison** stacks per hit (observed). Card notes Spiderling-Horde damage is `[Enemy MAX HP]`-based
  (consistent with the %MaxHP Poison). Simple scripted mob — no recipe. ⚠ **The ONE remaining unknown: the
  Spiderling's direct-hit ATK coefficient.** Carry as a flagged bracket (documented default) until observed —
  but the primary threat is the 2×5% Poison per hit ×10 spiderlings, which IS pinned, so the direct-hit coeff
  is second-order.

## Slice C — Skavag's active kit + the 21–25 passives

- **Stupefying Silk** (see the authoritative card spec below): AoE ATK attack + 70%-chance −30% TM per
  target + Sleep-on-empty. Reuses `decreaseTurnMeter` + the `tm_depleted` conditional-placement + the
  `Almighty Persistence` TM-halving on stages 21+ applies to Skavag herself (not relevant here — this is her
  OWN skill hitting allies). The 70% chance rolls per target.
- **Stages 21–25 boss passives (affect SKAVAG only, never the Spiderlings):**
  - **Almighty Strength** — caps each **ENEMY-MAX-HP-based SKILL HIT** against Skavag at 10% of her MAX HP.
    ⚠ CRITICAL CLASSIFICATION (Mike 2026-07-28): the cap is for **skill hits whose damage formula scales on
    enemy MAX HP** (Coldheart Heartseeker, Royal Guard Takedown — the engine's `maxHpPct` skill path). It does
    **NOT** cap **debuff damage** — HP Burn ticks and Poison ticks scale on MAX HP too but are DoT, not skill
    hits, so they are UNCAPPED. Rule: `if sourceType==SKILL_HIT && scaling⊇ENEMY_MAX_HP → cap;
    if sourceType∈{HP_BURN, POISON} → no cap`. → VERIFY the existing Dragon `maxHpDamageCap` already applies
    ONLY on the `maxHpPct` skill path (not in `tickDots`); if so, reuse it as-is (it's the same mechanic) — I
    expect it does, since DoT is a separate code path, but confirm before wiring. This matters for Spider
    specifically because the 15-25 damage strategy is Poison/HP-Burn, which must stay UNCAPPED.
  - **Almighty Persistence** — Turn-Meter reduction applied TO SKAVAG is halved (a 40% TM cut removes 20%).
    New modifier on `decreaseTurnMeter` gated on `target===boss && stage>=21`. Does not affect Spiderlings.
- **Affinity** per stage from `dungeon_stage_affinities` (already loaded by the shared builder).
- **Stage tiers** (`SPIDER_REVIEW §2`: 1-14 nuke / 15-20 wall / 21-25 HP-Burn) are a *recommendation-layer*
  concern, not a sim concern — the sim just runs the stage's stats + boss kit. Noted so we don't over-build.

## Slice D — fixtures + QA rungs (gate-1 only for now)

- A spec-level Spider fixture (synthetic team; no reality record yet).
- A `model-spider.mjs` rung (mirror of `model-boss.mjs`): assert Skavag's called→fired→applied sequence —
  consume→snowball fires, Enfeeble on CD, Almighty Immunity blocks CC on the boss but not Spiderlings, the
  spawn cap holds, lifesteal is cut to 35%. Teeth via `model-mutants` (boss-style mutants on `makeSpiderContent`).
- Reality (gate-2) deferred until a Spider battle is captured.

---

## AUTHORITATIVE runtime spec (Mike, 2026-07-28) — the Skavag mechanic

Single continuous round; the observed team is the Dragon team (recipes already exist). Spider is content-only
(Skavag + Spiderling scripted in `makeSpiderContent`, not recipes — confirmed).

### Spawning is EVENT-DRIVEN (not once-per-round). Cap 10 alive; every spawn is `min(N, 10 − living)`.
| Trigger | Spiderlings spawned |
|---|---|
| Encounter begins | **6** |
| A player champion **begins a turn** (normal OR Extra Turn) | **2** |
| Skavag **ends her turn** | **4** |
- Opening develops: begin 6 → champ1 +2 = 8 → champ2 +2 = 10 → champs 3–5 add 0 (capped). No reserve/queue —
  over-cap spawn attempts create nothing; later deaths are refilled 2-at-a-time on subsequent qualifying turn
  starts.
- **Counterattacks and ally-attacks do NOT count as turns. Extra Turns DO** (a normal + an extra turn both
  spawn 2 → a single "ally turn start" hook, fired for extra turns too, covers both).
- Source: AyumiLove Spider guide (initial 6, +2 per champ turn/Extra Turn, +4 at Skavag turn-end, cap 10).

### Skavag's turn — CONSUME (before her attack) then act then end-spawn
```
SKAVAG_TURN_START
  if consumeEligible AND living Spiderlings > 0:
      consumed = (all living Spiderlings); remove them all
      heal Skavag by 0.03 × MAX HP × consumed        // 10 consumed → +30% MAX HP
      Skavag.atk *= (1 + 0.10 × consumed)  PERMANENT  // 10 consumed → +100% ATK, permanent
      consumeEligible = false
  else:
      consumeEligible = true                          // empty-field / cooldown turn
  action: Enfeeble if available (AI rules) else Venom Spray
SKAVAG_TURN_END
  spawn min(4, 10 − living)                            // she re-seeds 4 even right after consuming all
```
- **Alternating consume:** eligible on boss turns 1,3,5…, not 2,4… — but eligibility ONLY flips to false when
  she ACTUALLY consumed (N>0). An empty-field turn does NOT burn the cooldown ("if Skavag consumes"). ⚠
  community-reported edge case — flag for isolated confirmation, but implement as written.
- Consume happens BEFORE the end-of-turn spawn-of-4, so those 4 survive to act on their own Turn Meters.

### Skavag's two active skills — VERBATIM from the in-game card (Tier-1, Stage-13 screenshot 2026-07-28)
Both are **AoE ATK-based attacks**. Coefficients are NOT on the card → datamined (mark `community` in the ledger).
- **Venom Spray** — "Attacks all enemies. Damage increases by 15% if the target has [Poison] debuffs." →
  AoE, `raw = coeff × ATK × (target has any Poison ? 1.15 : 1.00)`, per-target affinity/variance/crit/DEF-mit.
  Coeff **2.5×** is community/datamined (HellHades) — card confirms the +15%-if-Poison and ATK-scaling, not
  the number.
- **Stupefying Silk** (this is the skill `SPIDER_REVIEW.md` mislabeled "Enfeeble") — "Attacks all enemies.
  Has a **70% chance** of decreasing the Turn Meter by 30%. If a target's Turn Meter is fully depleted, places
  a [Sleep] debuff for 1 turn." → AoE ATK attack **plus** a 70%-chance −30% TM (per target) + Sleep-on-empty
  (reuses `tm_depleted`). NOT guaranteed TM. Coeff **3.0× ATK, cooldown 4** (community/datamined). NB
  "[Enfeeble]" is a DEBUFF Skavag is IMMUNE to, unrelated to this skill.

### Engine-hook implications (all no-ops for Dragon → byte-identical)
- Replace the earlier single `onRoundStart` idea with **`content.onTurnStart(state, actor, {extra})`** fired by
  `simulate()` at the START of every turn (incl. extra turns): Spider spawns `min(2,10−living)` when
  `actor.side==='ally'`. Plus `content.onBattleStart` → spawn 6; Skavag's own turn-end → spawn 4.
- Spiderlings are fast (SPD 150) combatants that act on their own TM: attack + 5% MaxHP Poison (stacking).

## Sequencing / safety
Slice A is behaviour-preserving and independently valuable (it's weld 1) — safe to land first, Dragon
byte-identical. Slices B–D are additive (new files + no-op hooks) and can't regress Dragon if the hooks
default off. Each slice: verify Dragon golden/snapshot unchanged + the new Spider rung green, before commit.
