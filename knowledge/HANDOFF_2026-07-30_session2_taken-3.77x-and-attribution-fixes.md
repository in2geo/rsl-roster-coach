# HANDOFF — 2026-07-30 (session 2) — The 3.77× over-taken is the wall; splash attribution fixed; my wrong turns corrected

> **COLD-START: read the earlier handoff `knowledge/HANDOFF_2026-07-30_spider-poison-mirage-and-survival.md`
> FIRST (poison-mirage + survival-is-the-wall), then this. Everything below is COMMITTED + PUSHED on
> `session/qa-rungs-2026-07-23` at `0eb36e8`.**

## One-line state
The whole-fight comparison (`tools/sim-per-hero-bands.mjs`) localizes the Spider-13 loss to **one real number:
the team takes 3.77× too much TOTAL damage** (443k sim vs 118k reality — both count DoT+shield+HP the same
way, so it is NOT a measurement artifact). Damage-out and fight-length are already right. This session also
**fixed the HP-Burn splash attribution seam** (splash-to-boss was invisible; now measured at ~54% of boss
damage, Pelops-led — matching reality's shape) and, importantly, **killed two of my own wrong hypotheses**
via the turn-by-turn trace.

## What SHIPPED this session (commit `0eb36e8`, pushed)
1. **`lib/sim/engine.js` — HP-Burn splash attribution.** The old code credited one aggregate `dot` event
   (own+splash) onto the BURNING unit, so a Spiderling's burn splashing onto Skavag was booked against the
   Spiderling → invisible to target-filtered boss attribution. Now split: own tick → the burning unit, each
   splash share → the unit ACTUALLY hit (Skavag included). **DEALT total (own + Σsplash) is byte-identical by
   construction.** golden ✅ / snapshot ✅ / turn-verify ✅.
2. **`tools/sim-spider-boss-attribution.mjs`** — bucket `dot` by subtype. Boss damage now reads **HP-Burn 54%
   / poison 39% / direct 7%** (Pelops-led). Before the fix HP-Burn read ~0 and "poison/DoT" falsely read 91%.
3. **`data/manual-captures.json`** — new 159t Spider-13 WIN with a first-party **death timeline**: Tagoar died
   ~t80, Vergis ~t120, the three carries survived (3/5 alive). Plus the Taunt-cooldown-race note.

## THE BIG-PICTURE TOOL (use this, stop theorizing from micro-probes)
`node --env-file=.env.local tools/sim-per-hero-bands.mjs` — runs the sim N×, aggregates each hero's
victory-screen numbers (DEALT / TAKEN / HEALING), and lays them next to the captured reality bands. This is
"the final results of the run" and is the honest scoreboard. Spider-13 verdict right now:
- **WR 2% vs 74%** · turns 174 vs 169 ✅ · most DEALT in-band (Ezio/Tagoar/Vergis ✅; Pelops under 807k vs 1.44M).
- **TAKEN 2–10× over on EVERY hero** (authoritative `combatant.taken`). This is the failure, and it is real.

## CORRECTIONS — do NOT re-walk these dead ends (I did, and wasted the session)
- **Protection/aggro-routing is NOT broken.** The turn-by-turn (`tools/turn-verify.mjs '' spider13-...json`)
  proves the Taunt→attack→counter chain fires exactly as Mike described (Pelops taunts → each Spiderling
  attacks Pelops → each takes HP-Burn + Petrification), and whole-fight targeting is reality-shaped: swarm
  picks over the fight = **Vergis 50 / Pelops 37 (taunt windows) / Ezio 18 / Tagoar 7 / Bambus 4** — carries
  ARE protected. I claimed "protection is broken" from aggregates; the trace disproved it.
- **`taken` is NOT apples-to-oranges.** engine.js:603-608 deliberately counts shield-absorbed damage in
  `taken` (Mike first-party note 2026-07-29), and DoT ticks add to it too → matches the game's blue bar. I
  claimed reality doesn't count shields so the over-taken was an artifact — **BACKWARDS, retracted.** The
  3.77× is real.
- **Bambus does NOT take poison damage in the normal cycle.** The every-turn `debuff Bambus [P] → Bambus
  [Poison]` line is the sponge ABSORBING an ally's poison (a placement, zero damage); he wakes+dumps to the
  boss at start-of-turn BEFORE `tickDots` runs (engine order: `onTurnStart` wake/dump → then `tickDots`), so
  it never ticks on him. The only Bambus poison ticks in the trace (2×, ~10k each) are a LATE-GAME EDGE CASE:
  his self-`[Sleep]` lapses → he's awake, not sponging → a poison landing directly on him ticks normally
  (source `"Poison"`, unowned). I wrongly called the absorption line his "damage source." Retracted.

## THE OPEN QUESTION (unproven — do NOT assert, MEASURE)
**Where does Bambus's ~83k `taken` come from?** He is directly targeted only 4× and takes ~0 poison, yet the
bands show 83k. **Hypothesis (code path verified, NUMBER not proven):** Ally-Protection redirect. Spider
attacks call `dealDamage(target, raw, 'direct', sp, state.allies)` (spider.js:73 boss / :129 Spiderling) →
passing the team triggers engine.js:578-585, which spreads a `value%` share of every hit on a protected ally
to the OTHER AP-holders — Bambus among them. So a slice of Vergis's 50 hits (and others') lands on Bambus's
`taken` without him being the target, plus shield-absorbed. **NEXT STEP I stopped before doing:** add an
observe-only `takenBy` breakdown (tag each `target.taken += amount` at engine.js:608 with a `cause`; pass
`cause='ap_redirect'` in the recursive AP call at :583; DoT ticks tag `'poison'`/`'hp_burn'`), run the exact
deterministic fight, print per-ally `takenBy`. This ends the guessing about the 3.77×'s composition.

## THE UNIFIED PICTURE (what's actually true, minus my noise)
Minus RNG, the outcome is the HP/alive trajectory of all combatants over time. "Every skill fires" (verified)
only checks leaves. The composition is failing on the **incoming-damage side**, and it collapses to:
1. **Team takes 3.77× too much TOTAL damage** (443k vs 118k) — REAL, both sides measure it identically. The
   trace shows targeting is right, so this is **swarm turn-share / how many spider actions LAND**, not who
   they hit. 116 swarm picks in a 288t deterministic loss; ledgered DoT-on-allies is only ~82k, so the bulk
   is scripted spider hits (unledgered) + AP-redirect spread + shield-absorbed.
2. **Under-heal 0.28×** — team receives 66k vs reality 233k. This is REAL (measured attribution-free by
   `tools/sim-spider-hp-trace.mjs`, which reads `combatant.healed`, bypassing the Continuous-Heal attribution
   seam). Retract any "healing is just a seam" framing.
3. **Boss kill-rate 0.42×** — boss lives too long (Pelops under-deals: HP-Burn coverage gap, too few
   Spiderlings survive burning because Ezio's counters one-shot them). Longer fight → more exposure → feeds #1.

Net sustain: reality +115k (heals more than it takes), sim −377k. That is the wipe.

## SURVIVAL MODEL REFRAME (first-party, this session)
Reality does NOT require 5/5 survival. The 159t WIN finished **3/5 alive**: the two SUPPORTS (Vergis, Tagoar)
take the most and can die; the three CARRIES (Ezio/Bambus/Pelops) are protected (low taken) and finish. And
support survival is a **race against Pelops's Taunt cooldown** (A3 cd4/dur2, ~43% uptime): Tagoar died on the
last attack before Taunt came back up; on other runs she lives with a sliver because Taunt re-pulls aggro in
time. So the WR-critical target is **carry protection + enough sustain to survive the Taunt-DOWN gaps**, not
5/5 survival.

## RECOMMENDED NEXT MOVES (in order)
1. **Prove the 3.77× composition** — the `takenBy` instrumentation above. Decide: is the excess raw spider
   hits (turn-share too high), AP-redirect spread, or shield-absorbed volume? You cannot fix it until you
   know which.
2. **If turn-share:** measure swarm actions-that-LAND per fight sim vs reality-implied; the lever is
   swarm-control coverage (Petrification ~5% sim vs ~30% reality; Slow ~7-12% vs near-all) — Petrification
   removes the action (turn-meter denial), which directly cuts #1.
3. **Under-heal 0.28×** — WHY do healers under-deliver? cadence / target-selection / hoard-threshold /
   Continuous-Heal firing. `sim-spider-hp-trace.mjs` is the attribution-free gate.

## DISCIPLINE LESSON (the meta-point Mike drove home)
Stop theorizing the outcome from aggregate probes. We have a **turn-by-turn** (`turn-verify.mjs`) and a
**whole-fight scoreboard** (`sim-per-hero-bands.mjs`) — use them to CHECK a claim before stating it. I made
three confident claims from aggregates this session (protection broken / taken is an artifact / Bambus
self-poisons); the turn-by-turn and the code falsified all three. When a number "can't be from X," MEASURE
where it's from — don't narrate a plausible story. See [[reality-anchors-single-run-trap-2026-07-27]] and the
CLAUDE.md reasoning-discipline rules (label observed/inherited/inferred; verify load-bearing facts first).

## Key files / commands
- Big picture: `node --env-file=.env.local tools/sim-per-hero-bands.mjs`
- Turn-by-turn (one fight, human-readable): `node --env-file=.env.local tools/turn-verify.mjs '' spider13-donbambus-current.json`
- Turn-verify RUNG (all contents, blocking): `node --env-file=.env.local tools/model-turn-verify.mjs`
- Boss attribution (now subtype-split): `node --env-file=.env.local tools/sim-spider-boss-attribution.mjs`
- HP trajectory / attribution-free heal+taken: `node --env-file=.env.local tools/sim-spider-hp-trace.mjs`
- Engine hot spots: HP-Burn tick+splash engine.js:411-441 · dealDamage + AP redirect + `taken` engine.js:563-628
  (AP redirect :578-585, `taken +=` :608) · sponge/wake-dump interpreter.js:294-359 · spider attacks spider.js:73/129.
