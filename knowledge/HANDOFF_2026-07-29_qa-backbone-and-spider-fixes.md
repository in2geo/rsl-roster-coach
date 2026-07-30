# HANDOFF — 2026-07-29 (later session) — QA measurement backbone + Spider engine fixes

> Cold-start doc. Supersedes nothing — it BUILDS ON `HANDOFF_2026-07-29_spider13-hpburn-race.md`. Read this
> first, then that one for the deeper Spider mechanics. **Everything this session is UNCOMMITTED** (working
> tree on top of `f7eb8aa`).

## One-line state
Real Spider-13 footage resolved the Spider damage/survival mystery; three engine fixes took Spider WR 0%→**100%
(OVERSHOOT vs reality 69%)**; and we built the QA MEASUREMENT BACKBONE the project was missing — a per-hero
reality-band gate, a config of acceptance thresholds, an append-only history log, and a CI workflow. Next
session's job: **commit this**, clear the stale-mutant/stale-assertion QA reds, then **calibrate Spider survival
down from the overshoot** (team must die-and-revive like reality, not be unkillable).

## Reality ground truth (from Mike's video + captures, this session)
- Spider-13, DonBambus/Ezio team (Ezio, Tagoar, Bambus, Pelops, Vergis): **~69–79% WR, median ~181 turns**
  (wins 157–210t). Two victory screens transcribed (164t and 211t) → added to `data/manual-captures.json`
  (now **21 captures**, 15 wins). **Champions DIE every run and are REVIVED** (Tagoar A3 Rise And Fight, cd7) —
  survival is a death/revive CHURN, not damage-avoidance. Ezio is veiled ONLY at the very start (Perfect Veil
  is round-start-only → FAITHFUL, not a bug). Off-taunt targeting = **lowest CURRENT HP** (dynamic; "taunt is a
  reset, then re-pick the most-killable champ now"), NOT lowest MAX HP. Boss has scaling damage (consume ATK-ramp).
- Per-hero reality medians (15 wins): **Pelops dealt ~1.58M, Bambus ~1.08M**, Ezio swings 365K–1.19M, Tagoar
  ~218k, Vergis ~54k. Taken: Pelops ~38k, others 22–30k, Ezio/Bambus lower. Healing = DONE/output (Ezio/Bambus 0).
- Dragon-16 per-hero reality comes from the **reader/watcher** `gestal-sync/RslBattleReader/output/battle-log.json`
  (25+ fully-populated wins; fields damage=dealt, defense=taken, healing=done). WR ~92%.

## Engine changes applied (UNCOMMITTED) + measured effect
All in `lib/sim/engine.js` + `lib/sim/spider.js`:
1. **Targeting → lowest CURRENT-HP%** (`chooseSingleTarget`, engine.js ~668). Was lowest-MAX-HP (a regression
   from the documented rule). Header comment already said current-HP%; body did max-HP. Now matches reality.
   Golden/snapshot unaffected (at full HP it ties → old max-HP tiebreak).
2. **Spiderlings spawn at ~2/3 Turn Meter** (66, not 0). `makeCombatant` now reads `o.turnMeter` (default 0 →
   Dragon byte-identical); `spider.js SPAWN_SPIDERLING_TM=66`. Burn first-tick rate **23%→44%**.
3. **Poison-fuel wiring** (spider.js `spiderlingAct`): the spiderling ally-poison now calls
   `state.onAllyDebuffed(...)` so it routes through Bambus's Sleeping Sage sponge (was MISSING — scripted
   `landDebuff` doesn't auto-sponge; dragon.js:129 does it, spider.js didn't). **Bambus dealt 356k → ~1.02M
   (now IN the reality band).** This was the headline fix.

Net: Spider WR **0% → 100%** (overshoot; reality 69%), sim median turns 203 (reality 181), and the team now
**over-survives** — 0 deaths, per-hero `taken` ~0 vs reality 22–38k, so the reviver never fires. Pelops dealt
703k vs 1.58M (55% low — burn engine still under-produces; reflect≈0 on Spider so it's real, not attribution).

## QA infrastructure built this session (the bulk of the work)
- **`tools/sim-per-hero-bands.mjs`** (NEW) — the missing whole-fight magnitude gate. Per champion, per content,
  compares sim median DEALT/TAKEN/HEALING to the captured p10/median/p90. Sources: `manual-captures.json`
  (Spider, hand-verified) preferred; else reader `battle-log.json` (Dragon-16). Gates DEALT+TAKEN; HEALING is
  report-only. Reads tolerances from `config/qa-thresholds.json`; also gates win-rate and median-turns. Appends
  a record to the history log. **This is now the SINGLE per-hero gate** — the old `tools/sim-survival-oracle.mjs`
  (taken-only) was FOLDED IN and DELETED.
- **`config/qa-thresholds.json`** (NEW) — acceptance thresholds per dungeon. `perHeroDealtPct 0.20`,
  `perHeroTakenPct 0.40` (looser by design — taken has ~9x natural range), `winRatePctPoints 10`,
  `medianTurnsPct 0.15`. "Targets, not permanent tolerances — tighten as the sim improves." Per-content blocks
  hold overrides only (perHeroTakenPct stripped so they inherit the 0.40 default).
- **`tools/qa-history.mjs` + `data/qa-history.json`** (NEW) — the MEASUREMENT BACKBONE. Bare JSON array, newest
  last. Both `model-qa.mjs` and `sim-per-hero-bands.mjs` append a record per run (git commit + ISO ts). Per-hero
  records carry per-champ per-metric {sim, realMedian, verdict, devPct}; model-qa records carry pass/fail +
  full scorecard. Git hash falls back to 'unknown'.
- **`tools/model-turn-verify.mjs`** — extended to run across ALL built contents (Spider-13 + Dragon-16); was
  Dragon-only (that's why Spider-side inert mechanics went unseen). Opps-aware inert gate.
- **`tools/sim-qa.mjs`** — wired in per-hero-bands (taken off-band → spec_violation/BLOCKS = the oracle's old
  teeth; dealt → reality_gap). Removed the two survival-oracle rung calls.
- **`.github/workflows/qa.yml`** (NEW) — CI on push/PR to main: runs model-qa (no-DB) + per-hero-bands (WITH DB
  via `secrets.SUPABASE_URL`/`SUPABASE_SERVICE_KEY`), fails on non-zero, commits `qa-history.json` back on every
  push-to-main (`always()`, `[skip ci]`). **⚠ Mike must add the two secret VALUES in GitHub repo settings** or
  per-hero-bands skips in CI. Fork PRs get no secrets (gate skips there).
- **`knowledge/QA_INVENTORY.md`** (NEW) — complete inventory of all ~24 QA tools for outside review (built via
  parallel agents). §12 lists the known coverage gaps.
- **DELETED**: `tools/model-firing-census.mjs` (a false-positive-prone duplicate I built then retired — it
  lacked the opps discriminator; the idea was folded into extending turn-verify). `tools/sim-survival-oracle.mjs`
  (folded into per-hero-bands).

## Key forensic lessons (why QA missed the sponge bug)
The Bambus sponge was correctly modelled yet never FIRED in Spider (a wiring omission). Root of the miss: the
opps-aware inert check is `inert = opps>0 && consequence===0` — a mechanic with **opps===0 reads as benign n/a**,
indistinguishable from "no opportunity." That's the Action Verification Model's documented COMPLETENESS blind
spot. Also: **scripted content bypasses the effect ledger** — Spider boss/spiderlings damage allies via
`dealDamage` with NO ledger event, so `state.effects` is incomplete for incoming damage (per-hero-bands reads
`combatant.taken` instead). Same root as the sponge: scripted enemies mutate state directly.

## Open items / next steps (prioritized)
1. **COMMIT everything** — engine fixes + all new QA files. Nothing is committed. Branch is on `f7eb8aa`.
2. **Clear the QA reds that are stale, not real:** `model-qa` exits 1 partly from a **stale mutant**
   (`model-mutants` teeth RED(1) — a find-string went stale after the targeting/spawn-TM edits) and
   **`model-spider` 39/42** (3 assertions encode consume-ATK/spawn constants that drifted when spawn-TM=66).
   Verify-then-rebless these so CI can distinguish real regressions from drift.
3. **Calibrate Spider survival DOWN from the 100% overshoot** (THE main sim problem). Reality: 69% WR, deaths +
   revives every run, per-hero taken 22–38k. Sim: 100% WR, 0 deaths, taken ~0. The team is too tanky → the
   reviver (Tagoar A3) never fires. Lever = boss consume-ATK-ramp / output vs the team's mitigation stack. Use
   `sim-per-hero-bands` (taken bands) + `sim-montecarlo` (WR/turns) as the gates; watch qa-history for red→green.
4. **Pelops dealt under-produces cross-content** (Spider 55% low, Dragon 37–41% low). Part is the burn first-tick
   rate (44% vs reality higher); part is **reflect damage not attributed to the reflector** in the ledger.
5. **Close the attribution seams** (clean fix): add per-champion `dealt` + `healingDone` accounting fields to the
   engine, mirroring the existing records-only `taken`/`healed`. Then DEALT includes reflect and HEALING becomes
   gateable (today it's report-only). This also fixes per-hero-bands' Pelops/Vergis dealt undercount.
6. **Add revive + sponge as verify-core CONTRACTS** (QA_INVENTORY §12) — turn-verify still can't regression-guard
   the sponge-wiring bug class.

## Commands
```
node --env-file=.env.local tools/sim-per-hero-bands.mjs        # the per-hero reality gate (both dungeons)
node --env-file=.env.local tools/sim-montecarlo.mjs spider13-donbambus-current.json 50   # WR + turn dist
node tools/model-qa.mjs                                        # Model scorecard (no-DB rungs; currently RED)
cat data/qa-history.json                                       # the measurement backbone, newest last
```

## Files touched (all uncommitted)
- `lib/sim/engine.js`, `lib/sim/spider.js` (engine fixes)
- `tools/sim-per-hero-bands.mjs`, `tools/qa-history.mjs` (new); `tools/model-turn-verify.mjs`,
  `tools/sim-qa.mjs`, `tools/model-qa.mjs` (edited)
- `config/qa-thresholds.json`, `data/qa-history.json`, `data/manual-captures.json` (+1 capture),
  `.github/workflows/qa.yml`, `knowledge/QA_INVENTORY.md` (new)
- DELETED: `tools/model-firing-census.mjs`, `tools/sim-survival-oracle.mjs`
