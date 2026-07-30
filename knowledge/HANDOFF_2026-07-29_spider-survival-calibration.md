# HANDOFF — 2026-07-29 (session 4) — Spider-13 survival calibration + taken-accounting

> Cold-start doc. Builds on `HANDOFF_2026-07-29_qa-backbone-and-spider-fixes.md` (session 3). Read this
> first for the Spider survival work, then that one for the QA backbone. **Everything this session is
> COMMITTED and PUSHED** on `session/qa-rungs-2026-07-23` (through the shield-taken fix).

## One-line state
Committed items 1 & 2 (QA backbone + stale-red clears), then diagnosed & partially calibrated Spider-13
survival (item 3): the sim was killing Skavag ~2.5× too fast → team never threatened → 98% WR (reality
71%). Fixed the fight-length root (spawn-TM) and calibrated the spiderling damage lever (coeff, anchored to
first-party per-hit), and corrected the `taken` metric to count shield-absorbed damage. **Spider WR now 85–88%
(→71%), death/revive churn emerges, fight 73→~110t (→181t).** The remaining gap is localized to the **team's
HEALING / staying-topped dynamic** — that's the next lever.

## Commits this session (all pushed)
- `6b5d3cf` fix(qa): sim-montecarlo runs real Spider content (was Dragon-in-disguise — Dragon-only bug)
- `243ed98` fix(sim): Spider spawn-TM — opening drop full TM, subsequent drops 0 TM
- `e51eb59` test(qa): clear stale Simulator-side blockers (sim-snapshot re-bless + sim-mutants find-string)
- `3816552` fix(sim): SPIDERLING_COEFF 1.0 → 2.24 (anchored to first-party per-hit)
- `8f2ad09` fix(sim): `taken` counts shield-absorbed (blue) damage, matching the results screen
- (earlier, item 1/2, already pushed: `f558e84` engine fixes, `dc480e4` per-hero-bands+backbone+CI,
  `7bd62c5` investigation tooling+handoffs, `50811c4` model-side stale re-bless)

## The corrected diagnosis (the big reframe)
- **`sim-montecarlo` was Dragon-only** — it built Hellrazor content even for a Spider fixture, so its
  "Spider 100% WR / 203t" was a DonBambus-vs-Dragon-13 faceroll. The session-3 handoff's "sim 203t" for
  Spider came from this. FIXED (`6b5d3cf`) — now dispatches via `buildBattle` for non-Dragon; Dragon path
  byte-identical. **The trustworthy Spider gates are `sim-per-hero-bands` + the now-fixed `sim-montecarlo`.**
- **Real gap = boss dies too fast** (sim ~73t vs reality ~181t; Mike screenshot: TURN COUNT 128, Round 1,
  boss still HIGH HP, ~10 swarm, AoE finishing Vergis). Short fight → boss never ramps → team barely
  threatened → over-survival. NOT the consume-ramp (that's faithful).

## First-party reality anchors from Mike (this session) — TRUST THESE
1. **Spiderling entry TM:** only the dungeon's OPENING drop enters at ~full TM; every subsequent drop at 0 TM.
   (Was a flat 66% → swarm crowded out the slow boss. Fixed `243ed98` → Skavag 2.4→4.7 turns/fight, fight 73→111t.)
2. **Spiderling team damage is mainly ATTACK, not poison.** A spiderling basic hits Tagoar for **~2100 WHITE
   (regular, non-crit) damage**. Sim@coeff1.0 = 937 → 2100/937 ≈ **2.24** (`3816552`).
3. **Bambus MITIGATES most of the poison** via his Sleeping-Sage sponge (75% while asleep) — so low ally-poison
   retention is CORRECT. Do NOT "raise poison volume" (a dead lead).
4. **Pelops takes ~all BLUE (shield) damage** off his Magma + regular Shield → the results-screen "taken"
   counts shield-absorbed damage. Sim `taken` was HP-only → shielded champs undercounted. Fixed (`8f2ad09`);
   this RESOLVED the apparent "Ezio veil-gap" (4k→27k, reality 26k ✅) and "Pelops taunt-draw" (16k→49k,
   reality 38k ✅) — both were **accounting artifacts, not mechanic bugs.**
5. **Bambus's A3 Dream Sight places [Enfeeble]** on all enemies (weak-hit ×0.70) — confirmed LIVE in sim
   (~14 landings/fight). A real survival mechanic.
6. **Boss AoE on Bambus ≈ 3100–4300/hit** — matches the sim at Bambus's current DEF 1138 (Venom 3889/Silk 4667).
   So Bambus's DEF and per-hit AoE magnitude are RIGHT.
7. **Spiderlings never single-target Bambus in reality** (only boss AoE hits him → ~8k). Bambus becoming the
   lowest-HP% is **rare-but-possible** (Mike hasn't seen it).

## VERIFIED FAITHFUL — do NOT re-tune (would be fitting a verified fact)
Skavag HP 1,064,310; spiderling ATK 2,129; speeds 150/95; consume every-other-Skavag-turn; Healing Assured
(poison→10% vs boss, wired engine.js:418/713); Bambus sponge 75%-while-asleep + self-[Sleep] every skill;
Pelops Taunt A3 cd4/dur2 (~40% uptime, obeyed); off-taunt = lowest CURRENT-HP%. spawn-TM opening-only.

## THE OPEN PROBLEM (next session's job): HEALING / staying-topped
Post-fix `sim-per-hero-bands` (Spider) blockers are now the honest signal — total team `taken` ~1.8× reality,
concentrated as OVER-CONTACT on **Bambus (40k/8k)** and **Vergis (74k/29k)**, with WR 85%/71% and fight
108t/181t. Root cause chain (evidence below): the sim **under-heals** → champs dip in HP% → become lowest →
**spiderlings tunnel them** → (for Bambus) his [Sleep] breaks → he stops sponging → eats direct hits + poison
(seed-3: 27 spiderling hits + 23k poison = 95k taken). In reality, heavy healing keeps everyone near-full so
the swarm can't tunnel anyone; the fight is a stable grind to 181t.
- **Healing evidence:** sim healers do a fraction of reality — Pelops heal 4k vs 107k, Tagoar ~20k vs ~100k,
  Vergis 0 vs 55k. ⚠ PART of this is the KNOWN ATTRIBUTION SEAM (Continuous Heal sourced to the string not the
  caster; magma-lifesteal not ledgered — healing is report-only in per-hero-bands). **FIRST STEP: distinguish
  actual under-healing (champs really dip in HP%) from under-COUNTING.** Instrument HP% over time per champ
  (esp. Bambus/Vergis) in a full fight; check whether Continuous Heal / Tagoar heals / Pelops Aid-the-Feeble
  are FIRING and keeping HP topped, or whether the champs genuinely dip.
- **Bambus poison is a SYMPTOM** (confirmed): in seeds where Bambus isn't tunneled (1, 7) he takes 0 poison
  (sponge+dump works, dump correctly before tick, engine.js:767 onTurnStart before 770 tickDots). Only the
  heavy-tunnel seed (3) breaks his Sleep → 23k poison. Fix the tunneling (via healing) and this vanishes.
- **Secondary, minor:** Venom/Silk AoE coeffs (2.5/3.0, datamined estimates) may be a touch high (sim 3889 vs
  reality ~3100 non-crit); spiderlings shouldn't tunnel Bambus at all. Both are downstream of healing — leave
  until healing is right.
- The attribution seam also caps the DEALT/HEALING gates — the clean fix (offered, not done): add per-champion
  `dealt`/`healingDone` accounting fields mirroring the records-only `taken`/`healed`.

## Dragon-16 (separate, still open)
Dragon `taken` OVERSHOOTS (Bambus 46k/18k, Ezio 51k/17k after the shield-taken fix) and the traces show the
sim LOSES where reality WINS ("Vergis/Tagoar survives, real heals ~39k/92k") — a Dragon over-damage /
UNDER-HEAL problem. Likely the SAME healing root as Spider. Worth checking together.

## Scratchpad probes built this session (reusable; in the session scratchpad, not committed)
`trace-spider.mjs` (boss HP/atk/adds curve, consume count, per-hero taken, sponge/enfeeble counts),
`q-attribution.mjs` (per-hero taken by SOURCE via onDamageTaken hook + taken-delta), `q-spiderhit.mjs` /
`q-perhit-all.mjs` (per-hit spiderling damage vs DEF), `q-bossaoe.mjs` (boss AoE vs DEF sweep),
`q-bampoison.mjs` (poison ticks on Bambus + sponge/dump counts). **Consider promoting a Spider whole-fight
tracer to a real tool** — the QA suite has no Spider `sim-trace` (Dragon-only).

## Commands
```
node --env-file=.env.local tools/sim-per-hero-bands.mjs 40         # the Spider+Dragon reality-band gate
node --env-file=.env.local tools/sim-montecarlo.mjs spider13-donbambus-current.json 50   # WR/turns/deaths (Spider now works)
node --env-file=.env.local tools/sim-spider-turnorder.mjs 20       # Skavag turn-share / consume pace
node tools/model-qa.mjs                                            # Model ladder (19/19 green with DB)
```

## Files touched (committed)
`lib/sim/spider.js` (spawn-TM, SPIDERLING_COEFF), `lib/sim/engine.js` (taken += shield-absorbed),
`tools/sim-montecarlo.mjs` (Spider dispatch), `tools/sim-mutants.mjs` + `test/snapshots/engine-behavior.json`
(stale re-bless), plus item-1/2 files. Memory: `spider13-calibration-diagnosis-2026-07-29.md` (+ MEMORY.md index).
