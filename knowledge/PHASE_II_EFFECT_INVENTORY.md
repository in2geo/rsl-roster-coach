# Phase II — Complete Effect Inventory (Dragon-16 slice)

**Every discrete effect of every skill for all 5 champions**, from the verified DB text
(`PHASE_II_SLICE_SKILLS.md`). Built 2026-07-24 after realising the milestone authoring had only pulled
effects from the DAMAGE-bearing skills — the no-damage skills (Bambus A3, Pelops A3, Tagoar A3, Vergis A2)
and passives had effects that were never catalogued. This doc is the master checklist so **nothing hides**.

**Status:** ✅ authored & executing in `recipes.js` · 📝 catalogued, deferred to the named milestone (not yet
built) · ⚠ authored-but-CONSUMER-missing (placed, but nothing reads it yet).
**Milestone:** A=damage · B=buffs/debuffs · C=state (heal/shield/TM/cooldown/revive) · D=triggers/passives · E=named exception.

---

## Bambus (Magic)

| # | skill | effect | recipient | cat | M | status |
|---|---|---|---|---|---|---|
| 1 | A1 | 3.8×ATK attack | 1 enemy | damage | A | ✅ |
| 2 | A1 | AoE-if target ≥2 debuffs | all enemies | targeting | A | ✅ |
| 3 | A1 | 30% Decrease SPD @75% 2t | enemy hit | debuff | B | ✅ consumed (turn order — engine.effectiveSpeed) |
| 4 | A1 | [Sleep] 1t, unresistable | self | debuff | D | 📝 (coupled to passive) |
| 5 | A2 | 5.6×ATK attack | all enemies | damage | A | ✅ |
| 6 | A2 | [Shield] 30% caster MaxHP 2t | all allies | shield | C | 📝 |
| 7 | A2 | +1t to all ally buff durations | all allies | buff-dur | C | 📝 |
| 8 | A2 | −1t to all enemy buff durations @75% | all enemies | buff-dur | C | 📝 |
| 9 | A2 | +3% ally Shield per enemy buff shortened | all allies | shield | C | 📝 |
| 10 | A2 | [Sleep] 1t | self | debuff | D | 📝 |
| 11 | **A3** | 50% [Increase ACC] 2t | all allies | buff | B | 📝 **(was uncatalogued)** |
| 12 | **A3** | 50% [Increase ATK] 2t | all allies | buff | B | 📝 **(was uncatalogued)** |
| 13 | **A3** | [Enfeeble] @75% 2t (not bosses) | all enemies | debuff | B | 📝 **(was uncatalogued)** |
| 14 | **A3** | 50% [Decrease ACC] @75% 2t | all enemies | debuff | B | 📝 **(was uncatalogued)** |
| 15 | **A3** | 50% [Decrease ATK] @75% 2t — bosses instead | boss | debuff | B | 📝 **(was uncatalogued)** |
| 16 | A3 | [Sleep] 1t | self | debuff | D | 📝 |
| 17 | P | transfer ally debuffs→self while [Sleep] @75% | self | transfer | D/E | 📝 |
| 18 | P | remove [Sleep] at start of turn | self | cleanse | D | 📝 |
| 19 | P | transfer self debuffs→highest-RES enemy on Sleep-removal | enemy | transfer | D/E | 📝 |

## Ezio Auditore (Spirit)

| # | skill | effect | recipient | cat | M | status |
|---|---|---|---|---|---|---|
| 20 | A1 | 4×ATK attack | 1 enemy | damage | A | ✅ |
| 21 | A1 | 60% [Decrease DEF] @75% 2t | enemy hit | debuff | B | ✅ (consumed by damage) |
| 22 | A1 | ↑ unresistable if self [Veil] | — | condition | D | 📝 |
| 23 | A2 | 4×ATK attack | all enemies | damage | A | ✅ |
| 24 | A2 | 2× 5% [Poison] @75% 2t | all enemies | debuff | B | ✅ (DoT consumed) |
| 25 | A2 | 25% [Poison Sensitivity] @75% 2t | all enemies | debuff | B | ✅ consumed (amplifies Poison tick — engine.poisonSensitivity in tickDots) |
| 26 | A2 | unresistable if self [Veil] | — | condition | D | 📝 |
| 27 | A2 | instantly activate [Poison] on enemies ≥4 debuffs | all enemies | activation | D | 📝 |
| 28 | A2 | [Stone Skin]→2 [Bomb] @75% (2t detonate) instead | all enemies | exception | E | 📝 |
| 29 | A2 | all-Stone-Skin → −1t Bomb countdown | all enemies | exception | E | 📝 |
| 30 | A3 | 5×ATK attack | 1 enemy | damage | A | ✅ |
| 31 | A3 | ignore 35% DEF | enemy hit | mitigation | A | ✅ |
| 32 | A3 | steal all buffs (before attack) | enemy hit | steal | C | 📝 |
| 33 | A3 | unresistable steal if self [Veil] | — | condition | D | 📝 |
| 34 | A3 | ignore [Shield]/[Strengthen] buffs | enemy hit | mitigation | A | 📝 (ignore_shield flag) |
| 35 | P1 | bonus dmg ∝ ATK when enemy <25% after Assassin hit; ignore 100% DEF, no crit | enemy | trigger | D | 📝 |
| 36 | P2 | [Perfect Veil] 2t at start of each Round | self | buff/trigger | D | 📝 (untargetable — top survival) |
| 37 | P2 | 35% reduce a >50%-MaxHP hit to 0 | self | trigger | D | 📝 |
| 38 | P2 | 35% counterattack when attacked | self | trigger | D | 📝 |

## Pelops the Victor (Spirit) — HP-scaled

| # | skill | effect | recipient | cat | M | status |
|---|---|---|---|---|---|---|
| 39 | A1 | 0.25×HP attack | 1 enemy | damage | A | ✅ |
| 40 | A1 | 50% [Decrease ATK] @75% 2t | enemy hit | debuff | B | ⚠ placed; consumed only vs boss hits |
| 41 | A1 | ↑ unresist/unblock if target [HP Burn] | — | condition | D | ✅ (unresistableIfTargetUnder) |
| 42 | A2 | 0.4×HP attack | 1 enemy | damage | A | ✅ |
| 43 | A2 | ignore 50% DEF if target [HP Burn] | enemy hit | mitigation | A | ✅ (ignoreDefIfTargetUnder) |
| 44 | A2 | +10% dmg per debuff-turn on self&target, ≤200% | self-scaling | damage | A | ✅ (dynamic scaler — interpreter.dynamicScaleFactor) |
| 45 | A2 | if dmg<50% MaxHP: steal buffs + [Stun] 2t | enemy hit | steal/CC | C | 📝 |
| 46 | **A3** | 50% [Increase ATK] 2t | all allies | buff | B | 📝 **(was uncatalogued)** |
| 47 | A3 | [Magma Shield] 30% caster MaxHP 2t | all allies | shield | C | 📝 (survival keystone) |
| 48 | A3 | [Taunt] 2t | self | buff | C/D | 📝 (survival keystone) |
| 49 | A3 | −20% damage taken while self not [Decrease DEF] | all allies | trigger | D | 📝 (team DR) |
| 50 | A3 | one-copy-only / not-on-dead-dupe rule | — | exception | E | 📝 |
| 51 | P | immune [Stun]/[HP Burn]/[Petrification] | self | immunity | D | 📝 |
| 52 | P | 100% [HP Burn] on attacker (50% if self Decr-DEF) | attacker | trigger | D | ✅ (chanceIfCasterUnder) |
| 53 | P | 50% [Petrification] on attacker (25% if Decr-DEF) | attacker | trigger | D | ✅ (chanceIfCasterUnder) |

## Tagoar (Magic)

| # | skill | effect | recipient | cat | M | status |
|---|---|---|---|---|---|---|
| 54 | A1 | 1.8×ATK attack ×2 hits | 1 enemy | damage | A | ✅ |
| 55 | A1 | 60% [Increase DEF] 2t | lowest-HP ally | buff | B | ⚠ placed, no DEF-buff consumer |
| 56 | A2 | 3.7×ATK attack | all enemies | damage | A | ✅ |
| 57 | A2 | 30% [Increase SPD] 2t | all allies | buff | B | ✅ consumed (turn order — engine.effectiveSpeed) |
| 58 | A2 | heal 15% caster MaxHP | all allies | heal | C | 📝 |
| 59 | A3 | revive dead @30% HP | all allies | revive | C | 📝 (key) |
| 60 | A3 | [Shield] 20% caster MaxHP 2t | all allies | shield | C | 📝 |
| 61 | A4(P) | −10% damage to allies ≤50% HP | allies ≤50% | trigger | D | 📝 (Aid the Feeble) |

## Vergis (Spirit) — A1 DEF-scaled

| # | skill | effect | recipient | cat | M | status |
|---|---|---|---|---|---|---|
| 62 | A1 | 3.9×DEF attack | 1 enemy | damage | A | ✅ |
| 63 | A1 | 30% [Reflect Damage] @40% 2t | random ally | buff | B | ✅ consumed (attacker takes value% — engine.reflectDamage in dealDamage) |
| 64 | **A2** | 15% [Continuous Heal] 3t | target ally | heal-o-t | C | 📝 |
| 65 | **A2** | 30% [Increase SPD] 3t | target ally | buff | B | 📝 **(was uncatalogued)** |
| 66 | **A2** | 30% [Reflect Damage] 3t | target ally | buff | B | 📝 **(was uncatalogued)** |
| 67 | A2 | 50% [Ally Protection] 2t | all allies except self | buff | C/D | 📝 (survival key) |
| 68 | **A2** | 60% [Increase DEF] 2t | self | buff | B | 📝 **(was uncatalogued)** |
| 69 | P | [Shield] 10% MaxHP 2t on losing ≥10% MaxHP in one hit | self | trigger | D | 📝 (Second Wind, key) |
| 70 | P | 15% [Continuous Heal] 2t when HP<50% | self | trigger | D | 📝 (Second Wind, key) |

---

## Tally (70 effects total)

| milestone | count | authored ✅/⚠ | catalogued-only 📝 |
|---|---|---|---|
| A — damage | 13 | 13 | 0 |
| B — buffs/debuffs | 17 | 7 (✅3 / ⚠4) | **10** (incl. 8 previously UNcatalogued) |
| C — state (heal/shield/TM/revive/steal) | 15 | 0 | 15 |
| D — triggers/passives/conditions | 20 | 0 | 20 |
| E — named exceptions | 5 | 0 | 5 |

**The correction:** II-B is **not** fully done — 7 of 17 II-B effects are authored (the ones on damage skills);
**10 remain**, of which **8 were never catalogued** until this doc (Bambus A3 ×5, Pelops A3 Increase ATK,
Vergis A2 Increase SPD/DEF/Reflect). Those get authored to finish II-B honestly.
**⚠ = 0 placed-but-inert** — every effect PLACED in the slice now has a consumer (2026-07-24). Consumers:
Increase/Decrease ATK/DEF via engine.statFactor; Decrease Speed + Increase SPD via engine.effectiveSpeed in
the scheduler; Poison Sensitivity via engine.poisonSensitivity in tickDots; Reflect Damage via
engine.reflectDamage in dealDamage. **The remaining work is C+D effects still catalogued-only (📝) — triggers,
conditions, activations, exceptions** — the survival/identity mass that is the whole reason Phase II exists.
