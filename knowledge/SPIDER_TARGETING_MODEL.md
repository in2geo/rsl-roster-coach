# Spider's Den — the targeting model, and why the engine can't see this dungeon

**Established 2026-07-22 with Mike, in conversation. Everything here is either (a) stated by Mike
from in-game knowledge or (b) verified against our own DB in the same session. Nothing is fitted.**

> ⚠ **THE HEADLINE FINDING.** Almost every mechanic below was **already captured in our database and
> consumed by nothing.** `Taunt` is a tag with the correct description. `Perfect Veil` is tagged on
> 59 champions. Ascension is derived correctly. Books are 100% captured. The HP-Burn ally-splash is
> written into `keyword-glossary.json`. **The gap between this engine and a competent human is not
> missing knowledge — it is captured knowledge that never reaches anything that scores a team.**

---

## 1. Spiderling targeting — the hierarchy

Spiderlings pick **the easiest available kill**, evaluated in this order:

1. **WEAK AFFINITY vs the stage.** Magic stage → targets Spirit · Spirit stage → Force ·
   Force stage → Magic · Void stage → no advantage, skip to the next rule.
   (They deal 30% more to a weak affinity, so they swarm it.)
2. **TAUNT.** An ally under a `[Taunt]` buff. ⚠ **Weak affinity OUTRANKS taunt** — the taunt only
   takes over once the weak-affinity pool is empty (or dead). This is the correction that made the
   model match reality; the intuitive ordering (taunt first) is WRONG.
3. **Lowest current HP%,** once someone drops under 50%. *(Dynamic — not evaluable pre-fight.)*
4. **Lowest MAX HP.** The tie-breaker at full health. This is why glass-cannon carries get swarmed.

**Untargetable is a filter that sits above all of it:** `[Perfect Veil]` / `[Veil]` remove a champion
from the pool entirely. Ezio's passive self-veils for 2 turns **at the start of every round**, so he
is effectively permanently unpickable — which is why the swarm falls through to the next Spirit
champion instead of the squishiest one.

⚠ Do NOT model the rule-4 "deterrent" (`[Shield]`/`[Counterattack]` discourage attacks) off tags.
A champion who can *cast* Shield is not shielded. Implementing it that way picked the TANKIEST
target — the exact inverse of the rule. Deterrents need active-buff state we don't have.

### Worked example — Don$Bambus [Ezio, Pelops, Kael, Bambus Fourleaf, Tagoar]
`Ezio (Spirit 16k, VEILED) · Pelops (Spirit 28k, TAUNT) · Kael (Magic 11k) · Bambus (Magic 26k) · Tagoar (Magic 24k)`

| stage affinity | victim | why |
|---|---|---|
| Magic — 2,6,10,14,18,22,25 | **Pelops** 28k | weak=Spirit; Ezio veiled, so the 28k tank is the easiest *available* kill |
| Force — 3,7,11,15,19,23 | **Kael** 11k | weak=Magic; **affinity beats the taunt** |
| Spirit — 4,8,12,16,20,24 | **Pelops** 28k | weak=Force; team has no Force → falls through to taunt |
| Void — 1,5,9,13,17,21 | **Pelops** 28k | no affinity edge → taunt *(PREDICTION — unconfirmed)* |

**Consequence: Pelops soaks 21 of 25 stages; the six Force stages are the hole**, where Kael is
pulled out from behind the taunt. That is a per-stage, per-seat prediction from data we already own.

---

## 2. The kill vector — HP Burn splashes off the adds onto the boss

From our own `data/keyword-glossary.json`:

> **HP Burn** — *"At the start of the affected Champion's turn, they **and all allies** take 3% of
> their respective MAX HP. Only ONE HP Burn can be active on a Champion at a time."*

So an HP Burn on a **spiderling** damages **Skavag** for 3% of *her* max HP. One burn per spiderling,
up to 10 spiderlings → **up to ~30% of the boss's max HP per round, from burns never placed on her.**
It is %maxHP, therefore **HP-INVARIANT** — identical throughput at stage 5 and stage 25.

✅ **CONFIRMED by Mike 2026-07-22:** ten burned spiderlings = **ten separate splash events per round**.
So the ~30%-of-boss-max-HP-per-round figure stands, and HP Burn on the ADDS is not merely good here —
it is the primary kill vector, and it does not decay as the ladder scales.

❓ **OPEN — does POISON splash the same way?** Mike: *"same for poisons but HP ticks hit harder on
spider."* Our glossary's Poison entry says target-only (*"Damages the target by 2.5/5% of MAX HP"*),
which contradicts that. If poison-on-adds also reaches the boss, our glossary is incomplete and the
Spider damage ranking changes. **Do not model poison splash until this is settled.**

### Why Pelops the Victor is a beast here
```
A3 "Victor's Bounty" (cd4, 2t)  -> [Taunt] on self  +  [Magma Shield] = 30% of HIS max HP to ALL allies
                                +  [Increase ATK];  passive: all allies take 20% less damage
Passive "Master of Games" (ar=3) -> ANY enemy that attacks him: 100% [HP Burn] + 50% [Petrification]
                                    (once per enemy skill)
```
Taunt pulls the spiderlings onto him → each one that hits him gets HP Burn → every burn splashes 3%
of Skavag's max HP onto Skavag. **He converts the boss's own spawn mechanic into the kill vector:
the more spiderlings she makes, the faster she dies.** He is simultaneously the target, the add-clear,
the team's shield, and the primary damage source — and *all of it is conditional on him being the one
targeted*, which is a mechanic the engine has no representation of.

⚠ Taunt uptime is **2 turns on a 4-turn cooldown = 50% unbooked**, and on auto it doesn't fire until
he takes a turn. That is why the observed sequence is "Kael first, then the taunt kicks in."

---

## 2b. THE FIRST DERIVED STAT FLOOR — the taunt seat needs SPD ≥ 151

**Spiderling SPD is 150, flat at every stage 1-25** (`dungeon_stage_enemies`, real). The taunt only
protects the team if it is UP before the spiderlings move, so:

> **SPD ≥ 151 on the taunt seat, or round 1 resolves with no taunt and the swarm falls through to the
> normal hierarchy (i.e. onto the squishiest champion).**

Confirmed by Mike from play — *"on this account, the spiderlings attack before Pelops gets his taunt
off the first time"* — and reproduced from our own data:

| account | Pelops SPD (NO aura) | +19% aura | round 1 |
|---|---|---|---|
| Don$Bambus | 141 | **168** | ⚠ aura flips this — see below |
| DonCobb07 | 148 | **176** | ⚠ same |
| Don$Gnut | 165 | **196** | Pelops first either way |

> ⚠⚠ **THESE NUMBERS EXCLUDE THE LEADER AURA — corrected 2026-07-22.** `applyLeaderAura()` is called
> AFTER `mapRoster()` (match-engine.js:744/828/1613/1853), never inside it, so every SPD read off
> `mapRoster().mapped.estimated_stats` is pre-aura. A Dragon pre-battle screenshot shows Bambus
> running *"Increases Ally SPD in all Battles by 19%"* (Ezio leading) — which puts Pelops at **168,
> above the spiderlings' 150**, reversing the "9 SPD short" conclusion.
> **UNRESOLVED:** Mike independently confirmed from play that *"the spiderlings attack before Pelops
> gets his taunt off the first time."* Both cannot be true. Candidate explanations: a different
> leader (no SPD aura) is used on Spider; or the delay is skill-order, not turn-order. **Do not use
> the SPD ≥ 151 floor until this is settled** — and always apply the aura before reasoning about
> turn order.

**This is the only stat floor in the project that is DERIVED rather than judged.** Every number in
`stat_threshold_checks` is a placeholder (CLAUDE.md); this one falls out of a mechanic plus the enemy
table. **That is the method for getting the rest**: a requirement + the real enemy stat, not mining
outcomes (the corpus has no stat variation — ACC takes 11 distinct values across 323 battles).

> ⚠⚠ **NECESSARY, NOT SUFFICIENT — corrected 2026-07-22 same session.** Mike: *"I don't think Pelops
> uses his taunt first, I think he uses it second"* (flagged as uncertain). If the auto AI casts A3 on
> his SECOND turn, SPD ≥ 151 does not buy round-one control — it only makes that second turn arrive
> sooner, and ~2 rounds of spiderling attacks resolve on the normal hierarchy first. At 2 poison
> stacks per spiderling the intended victim can be dead before the taunt ever lands.
> **We cannot answer this from our data**, and the reason is §3 defect 7 below. Settle it by watching
> ONE battle: which skill does Pelops cast on his first turn?

It also reframes the Gnut-vs-Bambus gap from unactionable "account maturity" into two nameable
deficiencies on ONE champion: **9 SPD short of controlling round 1, and fully unbooked** (A3 1/4 vs
Gnut's 3/4 → longer cooldown → lower taunt uptime). Same champion, same ascension, both with the
passive.

⚠ SPD is more trustworthy than ACC here: Arena grants no SPD, Guardians are unassigned on all
accounts, and Gestal gear is real — so these are close to true, unlike the phantom-ACC-inflated
numbers.

---

## 3. What the engine gets wrong, concretely

| # | defect | evidence |
|---|---|---|
| 1 | **No targeting model at all.** Survival is a team HP POOL (`contribution-model.js:196`) or team-SUM EHP (`power-model.js survivalProxy`). The real fight is focus-fire elimination. | The recorded defect *"team-min survival keys on the DISPOSABLE seat"* (Fahrakin 14k) was never an artifact — **he is who the game actually attacks.** |
| 2 | **`SOURCE_STACK_CAP = { poison: 10, hp_burn: 1 }`** — HP Burn capped at one. Correct per-target, but there is no term for N burned adds each splashing the boss. | `damage-mechanics.js:228` |
| 3 | **Spider's survival goal never mentions Cleanse.** All three tiers offer `AoE Shield` / `Healer` / `Continuous Heal`. Cleanse and Block Debuffs both exist as tags and appear nowhere. | live DB; and `PROTECTION_MECHANICS` says Shield is `damageType:'direct'` — **it cannot touch DoT**, which is the entire threat |
| 4 | **HP floors (8,000 / 14,000 / 20,000) gate a %maxHP threat.** 10 stacks × 5% = 50% of the victim's max HP per turn — more HP buys **zero** extra turns. | same error CLAUDE.md already documents for Fire Knight |
| 5 | **Books ignored.** `match-engine.js:281`: *"the engine ignores booking today (all approved tags count regardless)"* — a rarity guess replaces data captured 100% in `skills[].level/maxLevel`. Bambus's Pelops is fully unbooked (1/5,1/4,1/4,1/1); Gnut's is 3/5,2/4,3/4 → shorter A3 cooldown → **more taunt uptime**. | matches `GAME_MECHANICS_INVENTORY.md`'s independent #2 ranking: *"smallest effort-to-correctness ratio on the board"* |
| 6 | **The damage link is in no Spider content** — 0 of 18 goals and 0 of 14 boss_exceptions mention it. | queried 2026-07-22 |
| 7 | **AUTO SKILL ORDER: two migrations WRITTEN AND NEVER APPLIED.** `champion_skills.auto_reliable` (2026-07-14) — column absent live. `skill_ai_configs` (2026-07-15) — table absent live (404). The latter's schema carries `priority`, the exact field that answers "which skill does the AI fire first". `reliabilityFactor()` consumes `autoReliable`, always gets null → this is the **1,092× top item in the gap backlog**, 3.6× larger than anything else. | live schema queried 2026-07-22 |

Spider is our worst dungeon — **47.8% balanced accuracy, below chance** (suite floor 204/324, 52.9%).
Defects 1 and 2 are sufficient to explain that on their own: the dominant kill vector and the actual
death mechanism are both unrepresented.

---

## 4. Ascension — verified, and a trap worth recording

Gestal's `ascensionLevel` field reads **0 for all 1,370 champions** across every snapshot. Ascension
is encoded as **`typeId − baseTypeId`** (distribution across the corpus: 0×1281, 1×3, 2×2, 3×60, 4×2,
5×12, 6×10 — none out of range). This is already handled correctly by `ascensionFromGestal`
(`gestal-context.js:95`, verified by a live ascend), and `match-engine.js:248` genuinely enforces
`champion_tags.ascension_required`. **This path is sound — do not "fix" it.**

Pelops per account: **Bambus 5 · Cobb07 3 · Gnut 6** — all ≥ 3, so the HP-Burn passive fires for all
of them. The Bambus/Gnut difference is **books, not ascension.**

---

## 5. Next steps

1. **Targeting resolver** — ~40 lines, all inputs present. Report against `tools/battle-suite.mjs`.
2. **HP Burn ally-splash term** — after the poison question in §2 is settled.
3. **Seed:** add `Cleanse` / `Block Debuffs` to the Spider survival goal; drop or replace the HP floors.
4. **Wire books from Gestal** — 100% captured, demonstrably load-bearing via taunt uptime.

**Validation channel that worked.** Mike stated the answer, the implemented rule reproduced it, and
two real errors of mine were caught by him reading ONE output line ("Pelops is an HP champ, there is
easier prey"). That loop took minutes; the battle corpus cannot settle any of it, because 79 Spider
battles are ~a dozen team configurations replayed, with no stat variation to learn from.
**Print the prediction, have the expert check it.**
