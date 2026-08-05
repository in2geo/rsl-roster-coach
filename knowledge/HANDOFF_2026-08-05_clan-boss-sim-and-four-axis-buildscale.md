# HANDOFF 2026-08-05 — Clan Boss in the sim + the contribution model + 4-axis buildScale

**Branch:** `session/qa-rungs-2026-07-23` (pushed, commit `cc6a7ac`).
**One line:** Clan Boss (Demon Lord) now RUNS in the turn-by-turn sim, the selection layer scores
CB champions by **per-skill valued contribution** instead of binary tags, and `buildScale` finally
reads **all four sunk-investment axes** (level × stars × masteries × graded books) — so a maxed L60
and a bare L40 are no longer 17% apart, they're 2×.

---

## COLD START — read in this order
1. **`CLAN_BOSS_REVIEW.md`** (repo root) — the source-mechanics packet. Verbatim Demon Lord kit,
   affinity two-phase rotation, DoT caps, weak-hit math, the 10-debuff cap, and the open questions
   already put to Mike. **Read before touching any CB model.** (CLAUDE.md hard rule.)
2. **`knowledge/CONTRIBUTION_MODEL_SPEC.md`** — the valued + magnitude + saturation model and the
   per-skill `champion_skill_tags` schema (§6). This is the "why" behind the scoring rewrite.
3. Memory: **[[buildscale-four-axis-2026-08-05]]** (the buildScale rework, with the landmark anchors),
   **[[acc-is-advisory-not-a-gate-2026-08-05]]** (no hard ACC line — `debuffLandChance`),
   **[[dev-seed-start-not-lockout-2026-08-01]]** (development BIASES, never vetoes).
4. This handoff for the frontier.

---

## WHAT SHIPPED THIS SESSION

### A. Clan Boss simulation (v0 — honest brackets, exact where we have numbers)
- **`lib/sim/clan_boss.js`** — Demon Lord content module. The boss NEVER dies; the objective is
  **banked damage → chest tier** measured at the **~50-turn Gathering Fury wall**. Single target,
  single affinity per key, immunity list, boss-turn clock (`cbBossTurns` + `endBattle`).
- **`lib/sim/dragon-fixture.js`** — `buildBoss` hook so CB supplies its own boss from
  `clan_boss_stats` + `CB_BOSS_RES` (Dragon/Spider path byte-identical). `"Clan Boss"` in `DUNGEONS`.
- **`lib/sim/engine.js`** — gated hooks, ALL default-off: poison/HP-burn per-tick **caps** vs the boss
  (in `tickDots` AND `activatePoisons`/`activateHpBurns` — the activation path was the bug the reviewer
  predicted), the **%maxHP mastery gate** (`disableMasteryMaxHpVsBoss`), `state.cbLedger`. No drift:
  `buildScale`/CB hooks never touch the Dragon/Spider numbers.
- **`tools/sim-clan-boss.mjs`** — runner. Prints total damage → chest tier, survivors, turns, flags.
- **3 reality anchors** in `test/golden/`: `clan-boss-donahilvi-hard-current.json` (6.21M),
  `-ezioxeno-current.json` (7.82M), `-ezioxeno-artor-current.json` (9.0M).

**Modeled EXACTLY:** poison + HP-burn DoT (absolute caps, DEF-independent), affinity weak-hits, the
10-debuff cap, Crushing Force (∝ target MaxHP). **BRACKETED (missing data, never fabricated):** boss
**ATK** (Flesh Wither/Dark Nova AoE → survival), boss **DEF** (direct-hit calibration), the per-proc
**mastery cap value** (Warmaster/Giant Slayer %maxHP disabled + flagged). This is the honest analogue
of Dragon's "boss modeled, waves flagged."

### B. Contribution model — per-skill, valued, saturating
- **`migrations/2026-08-05_champion_skill_tags.sql`** (applied) — one row per (champion, SKILL, tag)
  WITH magnitude (%, stacks, duration, hits, condition). Fixes the flat `champion_tags` checkbox that
  rated premier-poisoner Xenomorph == incidental-poisoner Coldheart. Additive; `champion_tags`
  untouched until the whole roster migrates (spec §6 staged rollout).
- **`seeds/2026-08-05_cb_skill_tags.sql`** (applied) — 25 per-skill tags for the CB pool
  (Xenomorph, Ninja, Coldheart, Narma, Artak, Ezio) from VERBATIM `skill_summary`.
- **`tools/bucket-score.mjs` + `tools/pool-select.mjs`** — the damage bucket now reads per-skill DoT
  **throughput** (`cbDotThroughput`), stacking coverage with `stackDemand`, magnitude-weighted.
  Coldheart correctly dropped out of the carry tier; Ezio (poison ACTIVATOR) surfaces.

### C. buildScale — four axes (the last thing we touched, Mike-driven)
- **`lib/bucket-magnitude.js`** — `buildScale = 0.12 + 0.88·(levelStars × mastery × book)`.
  Floor 0.5→0.12. Landmarks: maxed L60 6★ +mast +books → **1.0**; **L40 4★ bare → ~0.54**
  (Mike: "he MIGHT be worth HALF"); fodder → 0.17 (biased, never vetoed).
- **`lib/gestal-context.js`** — new **`bookFraction(g)`** grades books from real per-skill levels
  (bookable skills only, maxLevel>1). Exposed as `book_fraction`. Fixes the INS-0033 binary cliff:
  Michelangelo 3/4-on-A2 = **92% booked → 0.906** (was 0.833, same penalty as a bare champ); Ninja
  1/5·1/6·1/5 = **19% → 0.929** (still top only because he has **boss mastery**).
- Masteries: boss-mastery (Warmaster/Giant Slayer) 1.0 / complete-tree-no-boss 0.90 / none 0.80.
- **Capture-gap discipline:** a MISSING field ⇒ neutral 1.0. Only explicit false/number from Gestal
  docks. Fixtures without the fields are unaffected. Gear still EXCLUDED (portable).

---

## THE CURRENT CB RECOMMENDATION (DonaHilvi, Hard)
`node --env-file=.env.local tools/pool-select.mjs cb Hard`
→ **Ninja · Michelangelo · Artak · Ezio Auditore · Mausoleum Mage** (Leader: Ezio SPD), grade 111.2.
Buckets: damage 160 · amplification 176 · mitigation 107 · sustain 100 · **tempo 59 · cleanse 59**
(both flagged un-fillable). Gear notes: Ezio ACC 30/90, Mausoleum Mage ACC 63/90.

Standalone value diagnostic: `SHOW_VALUES=1 node --env-file=.env.local tools/pool-select.mjs cb Hard`

---

## FRONTIER — pick up here (highest-leverage first)

1. **⭐ XENOMORPH DOESN'T MAKE THE TEAM, and reality says he should.** Both high captures (7.82M, 9M)
   ran Xenomorph — your PREMIER poisoner — but the pool spends the last seats on Artak (mitigation) +
   Mausoleum Mage (cleanse) because the poison **`stackDemand` saturates before it pulls a second
   dedicated poisoner**. This is the last big magnitude-blindness. The fix is NOT a grade-max pass
   (two standing Mike rulings against it, pool-select L137/L208) — it's making the poison demand
   **scale with the DoT-race nature of CB** so a second premier poisoner earns a seat. Start:
   `stackDemand` in the CB cfg + `cbDotThroughput`. Diff Xenomorph vs Artak for seat 4 directly.

2. **Michelangelo's mastery tab is unread.** Gestal says `has_boss_mastery: false` for him → buildScale
   0.906. If he actually runs Warmaster/Giant Slayer he's ~1.0 and edges Ninja. **A Gestal re-sync
   settles it authoritatively** — do this before trusting any low buildScale on a champ Mike says is
   developed. (Screenshots this session PROVED the book data was right — A2 really is 3/4 — so don't
   assume "stale"; verify.)

3. **The amplification bucket still lumps DoT-amp with attack-amp.** It over-credits attack-amps
   (Xeno's Decrease DEF, worthless on a DoT team per damage-mechanics rule §1) as if they helped CB
   poison. Split amplification per team damage-type. (`ALLOCATION` amplification=15 in bucket-score.)

4. **CB sim still brackets 3 numbers.** Boss ATK (AoE survival), boss DEF (direct-hit), per-proc
   mastery cap. Until captured, the sim's EXACT total is DoT-only. Wiring the caps into
   `estimateCbDamage` + a `cb-model-validate` re-fit against the 3 anchors is the follow-up.

5. **Roster-wide per-skill tags.** Only the 6 CB champs have `champion_skill_tags` rows. Coldheart's
   seat fully resolves once the whole DonaHilvi roster is populated (spec §6 transition).

---

## GUARDRAILS THAT BIT THIS SESSION (don't relearn them)
- **buildScale is SELECTION-layer only** — the sim engine never imports it, so it CANNOT cause golden/
  self-test drift. Verify a selection change with `SHOW_VALUES` + the pool, not the battle suite.
- **Two Mike rulings forbid grade-max passes** (pool-select L137/L208). Express a missing capability as
  a DEMAND that reads short (a bucket), never "maximize grade freely." Sanctioned path.
- **ACC is advisory, not a gate** ([[acc-is-advisory-not-a-gate-2026-08-05]]) — `debuffLandChance`,
  never a hard cutoff. 0 ACC is playable; recommend, don't lock.
- **All content changes go through committed seeds** (CLAUDE.md) — the migration + seed are committed;
  keep it that way. Applied via `tools/apply-seed-pooler.mjs` (pooler, NOT IPv6 migration), then
  `notify pgrst, 'reload schema'` for PostgREST to see a new table.
- **Never look a champion up by raw name** — `lib/champion-names.js` registry; every "not found" is a
  bypass. `buildUserChampions(gestal, db, dbAliases)` needs the alias rows or it silently drops champs.

## HOW TO RUN
- CB team: `node --env-file=.env.local tools/pool-select.mjs cb Hard`
- CB values: `SHOW_VALUES=1 node --env-file=.env.local tools/pool-select.mjs cb Hard`
- CB sim: `node --env-file=.env.local tools/sim-clan-boss.mjs test/fixtures/clan-boss-demon-lord.json`
- No-drift: `node tools/sim-selftest.mjs` (156/0) + `node --env-file=.env.local tools/sim-golden.mjs`
