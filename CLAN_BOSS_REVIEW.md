# Clan Boss (Demon Lord) — source-mechanics review

**What this is:** the per-dungeon source-mechanics packet for Clan Boss — the analogue of `DRAGON_REVIEW.md` / `SPIDER_REVIEW.md` / `FIRE_KNIGHT_REVIEW.md` / `ICE_GOLEM_REVIEW.md`, which CLAUDE.md makes required reading before modelling, scoring, or simulating a dungeon. Until now Clan Boss was the one core content without one. It consolidates everything folded into `lib/dungeon-mechanics.js` (`clan_boss`) and `lib/cb-shadow-goals.js` as of 2026-08-05, so those files can stay summaries and this is the authority.

**Why CB is different from the four dungeons:** it is **not a stage ladder** and **not a kill** — it is 6 *difficulties* of one fight against a boss who never dies, scored by **total key damage → chest tier**. It has **no waves** and a single target, and — uniquely — an **affinity that switches between keys** (Void → a random Force/Magic/Spirit once the clan crosses 50% that day). So the engine's win/loss-and-survival oracle doesn't directly apply; the CB oracle is a damage total vs `clan_boss_chest_tiers`.

**Source labels used below:** **[T1]** = in-game Index / Compendium (Demon Lord Hard cards, read 2026-08-05 — authoritative); **[T2]** = hand-read community factual data (the "Master Clan Boss Stat Chart", AyumiLove, and two player writeups); **[Mike]** = first-party confirmed. On any conflict, T1 wins.

**Status:** no CB simulator exists yet, and CB is scored by damage, not the stage scan. Nothing here changes live behaviour — it's the reference for the CB damage model (`lib/cb-damage-model.js`), the shadow goals (`lib/cb-shadow-goals.js`), and a future `makeClanBossContent`. **Open questions and a per-item decide list are at the end.**

---

## 1. What Clan Boss *is* (the objective)

- **The Demon Lord never dies.** He bottoms out at ~1% HP and **resets on the DAILY reset** [T2/Mike] — you never get a kill.
- **The goal is a ONE-KEY CLEAR = your single key's TOTAL damage clears the top-chest threshold** of the difficulty you ran (`clan_boss_chest_tiers`). The chest is the goal, not a kill.
- **Collective bonus:** when the whole clan drains the shared bar to the 1% floor, everyone who damaged him gets a **double/bonus chest** — so finishing ONE difficulty outright beats spreading hits across several.
- **Chest rule [T1]:** always take the **top chest of a lower difficulty over the first chest of a higher one** — a Demon Lord's final chest beats the next tier's first chest.
- **6 difficulties** (Easy / Normal / Hard / Brutal / Nightmare / Ultra-Nightmare), mapped to `stage_number` 1-6 only as plumbing to reuse the engine scan.
- **No waves precede him, and he is a single target** [T1] → an **AoE nuke has no cleave advantage**. The damage signal is **multi-hit A1s** (more Warmaster/Giant Slayer procs) + **[Enemy MAX HP] damage**, not AoE.
- **He is slow** relative to a fast team [T1] → out-speed him to land multiple hits per his turn.
- **The deliverable for the app:** recommend the **top difficulty whose top chest the account can one-key** — the `scanDungeonStages` analogue on a 6-difficulty axis.

---

## 2. Boss kit — verbatim [T1] (Demon Lord Hard, shows the VOID base)

Three active skills. **Community skill names differ from the Index** — "Crushing Force" is the only shared name; the Index names win.

| Index name [T1] | Community alias [T2] | What it does |
|---|---|---|
| **Crushing Force** (A1) | (same) | "Attacks 1 enemy. Places a **[Stun]** for 1 turn. This debuff **cannot be resisted**. Damage inflicted is **proportional to [Enemy MAX HP]**." → the single-target nuke; higher-HP target = harder hit, so park it on a **high-DEF / low-HP** tank. |
| **Flesh Wither** (A2) | "Belittle" | A **2-hit** AoE (Damage based on **[ATK]**) that places the **affinity debuff** for 2 turns (table below). Hits hard → pre-place Increase DEF / Shields *before* it lands. On Void: **2.5% [Poison]** — the boss places 2.5% (a "5%" writeup was wrong for the boss; but 5% is a real *champion* poison strength with its own cap, §4). |
| **Dark Nova** (A3) | "Crash Through" | AoE (Damage based on **[ATK]**): **1 hit on Void**, no self-buff; **4 hits on Force/Magic/Spirit**, then **self +25% [Increase ATK]** (2t). ⚠ The buff lands **after** the 4 hits, so the first Crash Through isn't self-boosted — it ramps his *later* AoEs, making the affinity boss progressively more dangerous. |

**How both AoEs change by affinity** — confirmed [T2] (AyumiLove full skill listings + DeadwoodJedi):

| Affinity | A2 Flesh Wither (2-hit) places, 2t | A3 Dark Nova |
|---|---|---|
| **Void** | 2.5% Poison | 1 hit, no self-buff |
| **Force** | 25% Decrease ATK | 4 hits → +25% Increase ATK (self, 2t) |
| **Magic** | 25% Decrease ACC | 4 hits → +25% Increase ATK (self, 2t) |
| **Spirit** | 15% Decrease SPD | 4 hits → +25% Increase ATK (self, 2t) |

**Both AoEs scale off his ATK** → landing **Decrease ATK on the boss** before they hit is the #1 survival lever.

### Passives — verbatim [T1]

- **Infernal Resilience [P]:** "Decreases the damage the Demon Lord receives from **[HP Burn]** and **[Poison]** debuffs, as well as **Skills that inflict damage based on enemy MAX HP**. Immune to **[Stun], [Freeze], [Sleep], [Decrease SPD]** debuffs, as well as **MAX HP destruction, Turn Meter reduction, and HP exchange** effects."
  - **The reduction is an ABSOLUTE PER-TICK CAP** (the cap always binds → DoT is **cap-bound, not %maxHP**). Full numbers in §4; folded into `CB_POISON_CAPS` / `CB_HP_BURN_TICK`.
- **Gathering Fury [P]:** "Starting from the 10th turn, the damage inflicted by all Skills increases each Turn… Starting from the 20th Turn, damage is increased by a greater amount. Starting from the 50th Turn, all attacks will **ignore any [Block Damage] and [Unkillable]** buffs on each target." *(The card lists ONLY this at t50 — no "Block Revive on kills"; that earlier claim was dropped.)*
- **Almighty Immunity [P]:** immune to **[Stun], [Freeze], [Sleep], [Provoke], [Block Active Skills], [Block Passive Skills], [Fear], [True Fear], [Petrification], [Berserk], [Enfeeble], [Nullify], [Ensnare], [Fatigue], [Hunter's Gaze]** + **HP exchange, HP balancing, and cooldown-increase** effects.
- **Unfaltering Speed [P]:** immune to **[Decrease SPD]** and **Turn Meter reduction** effects. *(Reinforces Infernal Resilience — you cannot slow him or deplete his TM, same as Dragon.)*

---

## 3. Affinity switches between keys + Weak Hits

**[Mike first-party CONFIRMED 2026-08-05]** the between-keys switch; **[T2]** the matchup/weak-hit detail.

> **GAME-WIDE MECHANIC — not CB-specific.** The affinity triangle + Weak Hits apply in **every dungeon** and are **already modeled at both layers**: the **sim engine** (`computeRawHit` / `affinityMult` in `lib/sim/engine.js` — `DISADVANTAGE_FLAT 0.80`, `WEAK_HIT_CHANCE 0.35`, `WEAK_HIT_MULT 0.70`, `BEATS` triangle) applies to every combatant; the **selection layer** (`lib/bucket-magnitude.js` `affinityPlacementFactor` — **0.65** for a weak champ's active-skill debuff, **1.0** for passive/non-hit placers that bypass weak hits, documented there as a "GAME FACT, Mike 2026-07-20") scores it against each stage's `bossAffinity` via `affinityMatchup` (`lib/formulas.js`). This session's confirmations (0.80×0.70 → 0.716 avg; non-hit bypass) **match the existing implementation** — no code change, it validates the model. What differs per dungeon is only the **boss's affinity**: Dragon / Spider / Ice Golem / Fire Knight have a **fixed per-STAGE rotation** (in their reviews); Clan Boss is the only one that **changes it by HP** (Void → the day's affinity, between keys). The one thing to keep true everywhere: each dungeon's scan must **pass its current `bossAffinity`** into the scorer so the (already-correct) factor fires.

- **The boss starts each day VOID** (neutral to all → you can reliably steer who eats his hits → the easiest mode). Once the **clan's cumulative daily damage crosses 50% HP**, the affinity changes to a **random one of Force / Magic / Spirit — for the NEXT battle, not mid-fight** (Plarium-confirmed): your current key finishes in its current affinity, so **each individual KEY is a single affinity** (Void early in the day, the day's affinity later; per difficulty — Easy's state is independent of Hard's), holding until the daily reset. **A CB sim models one affinity per battle**, not a mid-fight phase change. *(This supersedes the earlier "two-phase within one key" framing.)*
- **Matchup triangle:** Magic beats Spirit · Spirit beats Force · Force beats Magic · **Void neutral both ways**. So vs a **Force boss**, Magic champs are weak / Spirit champs favourable, etc.

### Weak Hits (the affinity-key tax)

A champion attacking a boss it is **weak** into: **each damaging hit has ~35% chance to be a Weak Hit**, which:
- deals **×0.70 damage**, **cannot crit**, **cannot place the debuffs attached to that hit**, and **cannot trigger crit/normal/strong-dependent effects**;
- **fires BEFORE the ACC-vs-RES check** — so even 100% placement + high ACC still fails on a weak hit;
- hits the on-attack debuffs hardest: **Decrease ATK/DEF, Weaken, Poison, Leech, HP Burn, debuff-extension**.
- **Non-hit debuff placers (skills that place without an attack) are NOT subject to weak hits** — they bypass this entirely.

**Team implication (affinity keys only; Void keys are immune to weak hits):** prefer **Void champs** (never weak) or the **favourable affinity** vs the day's boss (Force boss → Spirit, Magic boss → Force, Spirit boss → Magic). A disadvantaged on-hit poisoner loses ~⅓ of its intended stacks. **Spirit is the most disruptive** switch (its Decrease SPD breaks speed tunes); Magic's Decrease ACC makes *your* debuffs fail; Force's Decrease ATK mainly cuts ATK-based damage.

**Stun targeting:** the boss tends to aim **Crushing Force at a champ it is favourable into** (Force→Magic champ, Magic→Spirit, Spirit→Force), but also weighs current HP, defensive buffs, Steadfast, and killability — affinity is a component, not the whole rule.

### Sim algorithm (per damaging hit) [T2]
1. Determine attacker-vs-target affinity relationship.
2. If attacker is weak → roll ~35% Weak Hit.
3. If Weak → apply ×0.70, disable crit, suppress hit-attached debuff placement.
4. Else → resolve crit/normal/strong, then debuff placement + ACC-vs-RES.
5. **Multi-hit skills roll hit-quality per hit** (one hit weak while another is normal/crit).

> The engine already implements this **correctly**: `WEAK_HIT_CHANCE 0.35`, `WEAK_HIT_MULT 0.70`, `DISADVANTAGE_FLAT 0.80`, affinity triangle, in `lib/sim/engine.js`. **CONFIRMED 2026-08-05 (Plarium): BOTH penalties apply** — every disadvantaged hit is ×0.80, and a Weak hit takes ×0.70 *more* (0.80×0.70 = **0.56**); average = 0.65×0.80 + 0.35×0.56 = **0.716** (−28.4%). Weak hits also can't crit (the engine disables it) — count lost crits separately.

---

## 4. Damage model

- **The engine = Poison + HP Burn ticking every turn + Warmaster / Giant Slayer masteries.** Masteries on **all 5** are the single biggest lever (per-champ boolean, `lib/masteries.js` — not a tag, never filler).
  - **Warmaster / Giant Slayer are ALSO capped on the Demon Lord** (confirmed 2026-08-05 — NOT exempt): the enemy-MaxHP cap hits the mastery procs too, so a WM proc and a GS proc deal the **same capped base**. Weighting is about **proc count** (`cbMasteryProcs()`): **WM = 0.60/skill** (flat), **GS = hitCount × 0.30/skill**.

    | A1 hits | Warmaster procs | Giant Slayer procs |
    |---|---|---|
    | 1 | 0.60 | 0.30 |
    | 2 | 0.60 | 0.60 |
    | 3 | 0.60 | 0.90 |
    | 4 | 0.60 | 1.20 |

    GS ties WM at 2 hits and wins at 3–4 → the basis for **WM (1–2-hit A1) / GS (3–4-hit A1)**. ⚠ The absolute per-proc capped value per difficulty is the one remaining data item for absolute totals.
- **DoT is CAP-BOUND** (Infernal Resilience) — an **absolute per-tick value that always binds**, so a CB Poison/HP-Burn tick barely scales with boss maxHP. This **flips the engine** from "%maxHP × turns" toward **"capped-tick × number-of-ticking-debuffs × turns"**: maximise the *number* of ticking debuffs (up to the 10-cap) × turns, not %. Folded into `CB_POISON_CAPS` / `CB_HP_BURN_TICK` (`lib/cb-damage-model.js`):

  | Difficulty | Poison tick (2.5%) | Poison tick (5%) |
  |---|---|---|
  | Easy | 10,000 | 20,000 |
  | Normal | 15,000 | 30,000 |
  | Hard | 20,000 | 40,000 |
  | Brutal / Nightmare / UNM | 25,000 | 50,000 |

  - The boss's own Flesh Wither is a **2.5%** poison; **5% is a *champion* poison strength** (deals 2×). **Rarity-independent.** **Poison Sensitivity multiplies AFTER the cap:** `tick = cap × (1 + PS)` — e.g. 25k → **31.25k** at +25%.
  - **HP Burn** is flat by **placer rarity: Rare 50,000 / Epic+ 75,000**, and **only one HP Burn** can sit on the boss at a time.
  - ⚠ **Provenance** (`CB_POISON_CAP_PROVENANCE`): Brutal/NM/UNM + the 5% progression are **observed**; **Easy/Normal/Hard are `community_observed`** — not Plarium-published.
  - **NEXT (measured):** wire the caps into `estimateCbDamage` and re-fit `calibration` via `cb-model-validate`; the live estimator still uses the uncapped %maxHP coeff.
- **10-debuff cap [T1/T2]:** no more than 10 debuffs on the boss at once. Don't overstack Poisoners or they push out the champs placing **[Leech] / [Decrease DEF] / [Decrease ATK]** (surfaced by `formulas.js` MAX_DEBUFFS).
- **Decrease DEF / Weaken amp ONLY the attack/mastery portion, NOT the DoT** (DoT is DEF-independent — `damage-mechanics.js` §1).
- **Extra hits (Counterattack / Ally Attack)** → more Warmaster/GS procs = more damage.
- **Affinity tax (§3):** on-hit damage/debuffs from a disadvantaged champ are ~⅓ suppressed on affinity keys.

---

## 5. Survival model

- **Gathering Fury is the wall.** His damage ramps from turn 10, harder from turn 20; at **turn 50 all attacks ignore [Block Damage] + [Unkillable]** — the hard cap, so a run must effectively finish by ~turn 50.
- **#1 lever: land Decrease ATK on the boss** — both AoEs scale off his ATK, and surviving longer multiplies all your damage.
- **Two timing keys:** (a) pre-place **Increase DEF / Shields before Flesh Wither** (his hardest AoE) lands; (b) the single-target **Crushing Force Stun hits hard** and locks a champ for 1 turn — answer with **Block Debuffs** (stops it) or **Cleanse** (removes it) + healing on the struck champ.
- **Sustain:** whole team in **Lifesteal** gear (heals off the mastery/attack damage), or a **[Leech]** debuff on the boss. Counterattack teams add damage + self-sustain. *(Unkillable / Block-Damage timing works only up to turn 50.)*
- **Difficulty scaling:** Easy/Normal/Hard — a Speed team + a healer is enough. **Brutal/NM/UNM** — cut his damage (Decrease ATK / Weaken) + real sustain.
- **Gear [T2]:** whole team Lifesteal; gloves & chest main-stat **HP% or DEF%**, boots **SPD**; early-game, field your **highest-rank** champs (a 6★/Lv60 out-stats a 5★/Lv50).

---

## 6. Stats per difficulty

| Difficulty | Boss RES [T2] | Boss SPD (confirmed) | Boss HP (`clan_boss_stats`, raid-codex) |
|---|---|---|---|
| Easy | 30 | 90 | 19,020,000 |
| Normal | 60 | 120 | 60,620,000 |
| Hard | 90 | 140 | 194,130,000 |
| Brutal | 130 | 160 | 361,550,000 |
| Nightmare | 170 | 170 | 652,750,000 |
| Ultra-Nightmare | 225 | 190 | 1,171,200,000 |

- **Boss SPD is confirmed** = the `clan_boss_stats` values (90/120/140/160/170/190). The "Master CB Stat Chart" 130/140/150 for Easy/Normal/Hard were **champion-build targets, not boss SPD**.
- **Boss RES [T2]** is not yet in `clan_boss_stats` (no `boss_res` column) — it lives in `CB_BOSS_RES` in `lib/cb-shadow-goals.js`, where it feeds the ACC math.

### Accuracy is ADVISORY, not a gate
There is **no hard ACC line — 0 ACC is playable** (you just land few debuffs). Landing is **computed** by `debuffLandChance(acc, res)` (`lib/formulas.js`) = `clamp((acc − res)/100 + 1, 0.03, 1.0)` → **~100% at ACC = boss RES**, and below it debuffs still land, just less often. Surface **"target ~RES ACC to land Poison/Decrease-ATK reliably"** as a recommendation, never a pass/fail. (`CB_RECOMMENDED_ACC` = boss RES; `CB_ACC_FLOOR` kept only as a back-compat alias.)

---

## 7. The team-building model (roles)

`CB_NEEDS` in `lib/cb-shadow-goals.js` — one difficulty-independent needs set (difficulty moves the recommended ACC + the chest thresholds, passed separately). Each role is scored independently so they don't saturate against each other.

| Role | Weight | Solutions (tags) |
|---|---|---|
| **mitigation** | 1.5 | Decrease Attack (cut his ATK-scaling AoEs — top survival + damage-extender) |
| **boss_damage** | 1.2 | Poison / HP Burn / Poison Explosion / Enemy Max HP Damage (Lane A, DEF-independent) |
| **sustain_absorb** | 1.1 | Shield / AoE Shield / Ally Protection / Block Damage / Unkillable |
| **sustain_heal** | 1.0 | Continuous Heal / AoE Heal / Healer / Heal / Leech |
| **sustain_revive** | 0.39 | Revive / Revive on Death (insurance only — lost turns = lost damage) |
| **cleanse** | 0.9 | Cleanse / Block Debuffs (esp. the affinity Decrease SPD / Decrease ATK, and the Stun) |
| **debuff_amp** | 0.6 | Decrease Defense / Weaken (Lane B — amps mastery + attack, NOT DoT) |
| **extra_hits** | 0.6 | Counterattack / Ally Attack (more Warmaster/GS procs) |
| **tempo** | 0.5 | Increase Speed / Increase Turn Meter / Fervor |
| **debuff_ext** | 0.4 | Increase Debuff Duration / Poison Sensitivity |

**Excluded (the boss is immune — never credit these vs CB):** Stun, AoE Stun, Freeze, AoE Freeze, Sleep, AoE Sleep, Provoke, Fear, True Fear, Petrification, Sheep, Ensnare, Seal, Master Seal, Block Active Skills, Block Passive Skills, Berserk, Enfeeble, Nullify, Fatigue, Hunter's Gaze, Decrease Speed, Decrease Turn Meter (+ AoE variants), Increase Enemy Cooldowns, Block Cooldowns.

---

## 8. Open questions

**Resolved 2026-08-05 (data drop):** the switched-affinity kit (§2 table — A2 2-hit + debuff %s, A3 1-hit-Void/4-hit-affinity + self +25% ATK), the DoT cap tables (§4), boss SPD (§6 — confirmed = stored values; the chart's 130/140/150 were champion-build targets), and the 2.5%-vs-5% poison (the boss places 2.5%; 5% is a champion strength). **Provenance kept:** Easy/Normal/Hard poison caps are `community_observed`.

**Also resolved 2026-08-05:**
- **Weak-affinity disadvantage** — **both** penalties apply: ×0.80 on every disadvantaged hit, ×0.70 *more* on a Weak hit (avg **0.716**). The engine (`DISADVANTAGE_FLAT 0.80` + 35%×0.70) was already correct.
- **Mastery cap** — Warmaster & Giant Slayer **are capped** on the Demon Lord (not exempt); weighting via `cbMasteryProcs()` (WM 0.60/skill, GS hitCount×0.30/skill).

**Still open — one DATA item (not a mechanic question):** the **absolute per-proc capped mastery damage per difficulty**, needed for absolute totals in `cb-damage-model.js`. The proc counts already settle the WM-vs-GS comparison and the selection rule.

---

## 9. Please decide (per item)

**A. Kit correct?** The three skills (Crushing Force / Flesh Wither / Dark Nova), the four passives, and the Void-base reading (§2).

**B. Affinity + Weak Hits (§3)** — the between-battles switch (Void → random Force/Magic/Spirit once the clan crosses 50% daily, per difficulty; each key single-affinity), the matchup triangle, the confirmed disadvantage (×0.80 + ×0.70 on a Weak hit = 0.716 avg), non-hit-placer bypass, and the stun-targeting bias. **Note (2026-08-05): these affinity/weak-hit mechanics are GAME-WIDE — the engine applies them to every dungeon; see §3's banner.**

**C. Damage model (§4)** — the cap tables are now in hand (`CB_POISON_CAPS` / `CB_HP_BURN_TICK`). Accept the **cap-bound** reframe (capped-tick × #debuffs × turns) as the direction, and confirm the WM/GS 1-2/3-4-hit selection rule.

**D. Stats (§6)** — accept the boss RES chart and the ACC-is-advisory treatment; SPD is confirmed. Decide whether to add a `boss_res` column to `clan_boss_stats` (data home) — currently only in `CB_BOSS_RES`.

**E. Roles (§7)** — confirm `CB_NEEDS` and the excluded list.

**F. Next build step** — the two follow-ups are (1) **wire the DoT caps into `cb-damage-model.js`** (`estimateCbDamage` → capped absolute ticks, re-fit `calibration` via `cb-model-validate` — a *measured* change), and (2) a **`lib/sim/clan_boss.js` + `makeClanBossContent`** wired into `buildBattle` — a single-affinity-per-battle boss with the damage→chest oracle. Which first?

*Everything here is documentation — nothing changes live until a decision drives a code/seed change.*
