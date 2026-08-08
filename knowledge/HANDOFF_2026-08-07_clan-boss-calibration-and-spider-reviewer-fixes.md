# HANDOFF 2026-08-07 (evening) — Clan Boss calibration (targeting + cadence + measured Warmaster) + Spider reviewer fixes

Session theme: **first-party-video calibration of the Clan Boss (Demon Lord) model**, plus applying a code
reviewer's Spider findings. All on branch `session/qa-rungs-2026-07-23`. Two commits **pushed**
(`f31fffb`, `7de3ad9`); the Warmaster commit (`8f8e472`) is **committed but NOT pushed**.

## COLD START — read these first
1. This handoff.
2. `CLAN_BOSS_REVIEW.md` (repo root) + `SPIDER_REVIEW.md` — required before touching either model (CLAUDE.md rule).
3. `lib/sim/clan_boss.js` (targeting/cadence/WM-cap) + `lib/sim/engine.js` `applyWarmaster` (the WM cap).
4. Memory: `cb-survival-model-and-boss-calibration-2026-08-06`, the Spider cold-start pointers.

## DURABLE LEARNINGS (these change how CB work is done)
- **Clan Boss caps ALL %MaxHP damage via Infernal Resilience — knowing the % and the boss HP does NOT give the
  damage; the CAP does.** Verified on video: poison ticks show **40k** (our Hard 5% cap) and HP Burn **75k**
  (our Epic+ tick) EXACTLY. Poison caps (Hard): 2.5%→20k, 5%→40k. HP Burn: 50k rare / 75k Epic+ (flat).
- **Warmaster on the Hard Demon Lord = 67,912 per proc** — MEASURED off a first-party video (Ninja A1
  Shatterbolt): a constant RED, non-crit, DEF-independent number, repeated across turns. NOT fitted. (An
  earlier 175k Mikey-anchored *fit* was ~2.5× too high — it was absorbing Mikey's under-modelled base damage.)
  ⚠ Only **Hard** is measured; other difficulties are `null` (WM stays off) until read. ⚠ WM was observed
  proccing **per-HIT** (2nd hit procced, 1st didn't) while the engine models **once-per-skill** — multi-hit
  champs UNDER-count procs (a separate refinement).
- **Boss HP pools all validated EXACT** vs `clan_boss_stats`: Easy 19.02M · Normal 60.62M · Hard 194.13M ·
  Brutal 361.55M · Nightmare 652.75M · UNM 1.1712B. Use these to solve WM flat-vs-%MaxHP with a 2nd-difficulty
  capture.
- **Crushing Force (boss A1) targets the LOWEST EFFECTIVE HP ally (HP + shields), Veil/Taunt-honoured** — the
  shared `chooseAllyTarget` selector, NOT the old highest-MaxHP placeholder. Verified by TWO videos: a
  **shield** redirect (Mausoleum run t9) and a **current-HP** redirect (Artor run t12). Cadence = a strict
  3-turn rotation **Dark Nova → Flesh Wither → Crushing Force** (stun every 3rd boss-turn: t3/6/9/12), keyed on
  `cbBossTurns % 3` (was double-firing at t3,4,7,8…).
- **Gestal: `build-from-sync` reads the `gestal-sync/output/` CACHE, which lags the raw AppData export.** After
  EVERY Gestal Refresh you MUST re-run `sync.js` (or delete the output file). Freshness = the raw
  `champions.json` `extractedAt` / file mtime, NOT the sync tool's `STALE` warning (it fires for anything >5min).
  Only ~18/320 champs have equipped-gear links per sync — re-equip + refresh to link a specific champ
  (Ninja's gear was missing until the user re-equipped).
- **A capture can predate roster changes.** The 13.78M Hard *screenshot* (Mikey WITH masteries) and the older
  *video* the WM number was read from were different roster states — always confirm the capture matches the
  build you're simming.

## WHAT SHIPPED
- **Spider (`f31fffb`, pushed):** (1) Bambus's Sleeping-Sage sponge now fires only on poisons `landDebuff`
  ACTUALLY places (`&& landDebuff(...)`), not on the 0.37 attempt — kills phantom sponge triggers. (2) Silk
  cadence `cd-1` → fires every 4th boss-turn (was 5th), matching the engine convention. Measured: Bambus
  over-attribution 1.66M→1.59M. Silk (Edit B) REGRESSED the anchor WR (70→56) — it's *correct* but exposed the
  survival gap; kept deliberately.
- **Clan Boss targeting + cadence (`7de3ad9`, pushed):** Crushing Force → lowest-effective-HP + 3-turn
  rotation (above). 3 CB captures added to `manual-captures.json` (FIRST CB entries): #90 correct-gear damage
  (13.78M/4:53), #91 Mausoleum stun-log (shield redirect), #92 Artor stun-log (current-HP redirect).
- **Clan Boss measured Warmaster (`8f8e472`, NOT pushed):** `engine.js applyWarmaster` applies
  `min(coeff×MaxHP, cbMasteryProcCap)` vs a boss; `clan_boss.js` `CB_WM_PROC_CAP = { Hard: 67912 }`. Adds the
  runnable `test/fixtures/clan-boss-donahilvi-ezioxeno-artor.json` + `data/observed-builds/donahilvi-cb.json`.

## CB PER-HERO STATE (DonaHilvi EzioXeno+Artor, Hard, `SIM_CB_SURVIVE=real`, seed 1)
Total 8.77M = **64%** of reality's 13.78M (was 55% pre-WM). Per-hero vs reality:
`Mikey 49% · Ninja 48% · Xeno 76%`. WM closes ~HALF of each WM champ's gap by design; the rest is
NON-WM and left visible: **Ninja under-modelled direct/Escalation, Mikey under-modelled base damage, Xeno the
early wipe.** Sim wipes at boss-turn **17** vs reality **~19** (survival ~2 turns short).

## OPEN THREADS (next levers, ranked)
1. **CB Warmaster generalization:** read the WM proc number on a 2nd difficulty (Brutal/NM) — if also 67,912 →
   flat cap; if it scales → %MaxHP. All 6 HP pools are known. Then fill `CB_WM_PROC_CAP`.
2. **CB per-HIT Warmaster:** engine models once-per-skill; reality procs per-hit → multi-hit champs (Ninja A2)
   under-count. Fixing raises Ninja.
3. **CB regular-damage residual (non-WM):** Ninja's Escalation/direct + Mikey's base damage are under-modelled
   (~half their gap). Xeno 76% = the early wipe.
4. **CB survival:** wipe 17→19 (sustain under-modelled) to make `SIM_CB_SURVIVE=real` the default and stop
   using `optimistic` (a 50-turn no-wipe wall — the user called it a token waste; don't run it for calibration).
5. **Spider:** healing mystery = **Leech** (Mikey A3, uncut ~16.6–18%) + swarm suppression, NOT a missing
   mechanic. Hilvi freeze under-lands (modeled ACC 51 → 41% vs video's 60–100%) — ACC 51 is her REAL fresh gear,
   so the cause is masteries (Pinpoint Accuracy) / spider RES, NOT stale gear. Drafted-not-applied: **Edit C**
   (Silk TM ACC/RES gate). Also open: 10-debuff cap not enforced; lifesteal-35% cut scope.

## GOTCHAS
- `manual-captures.json`: **append surgically** (CRLF, 1-space indent, single-line heroes) — never reserialize
  (would reformat all 90+ entries' heroes). CB entries carry extra fields (`boss`, `stunLog`, `deathTurn`,
  `captureType`); nothing reads CB from this file yet (Spider/Dragon only), so they're archival.
- CB `test/golden/clan-boss-*.json` are reality RECORDS (content+heroes, no team/build inputs) — **NOT
  sim-runnable**. Runnable fixtures live in `test/fixtures/` (`clan-boss-demon-lord.json`, and the new
  `...ezioxeno-artor.json`). Runner: `tools/sim-clan-boss.mjs`; per-hero via the scratchpad `cb-wm-sweep.mjs`
  (sums `state.effects` by ally source).
- `data/qa-history.json` auto-appends on every QA run — left UNCOMMITTED (telemetry noise); don't fold it into
  code commits.
- Env knobs: `SIM_CB_SURVIVE=real|optimistic|none`, `SIM_CB_WM_CAP=<n>` (override the measured 67912),
  `SIM_CB_DIFF=<difficulty>`.
- Dragon golden stayed **56 pass / 10 fail** (same reproductions) through every change — the CB/WM edits are
  boss + CB-content gated, so Dragon/waves are byte-identical. Keep it there.
