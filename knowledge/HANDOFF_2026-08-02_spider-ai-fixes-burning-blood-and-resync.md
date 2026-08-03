# HANDOFF 2026-08-02 — Spider-13 DonaHilvi: AI-order fixes + Burning Blood + re-sync (WR 0%→40%)

**COLD START: read this, then `[[spider-ai-priority-and-boss-timing-2026-08-01]]`, then `[[sync-gear-capture-gap-2026-08-01]]` and `[[donahilvi-spider-climb-anchor-2026-07-31]]`.**

Pick-up target: the **DonaHilvi Artak+Ninja Spider-13 team** (Michelangelo, Coldheart, Hilve the Rime-called, Ninja, Artak). Reality clears 13-16 fast; sim was 0% WR at session start, now **40%**. Goal: 40% → ~100%.

## What this session did (all uncommitted on `session/qa-rungs-2026-07-23`)

**1. Three champion AI skill-order fixes** — these were the boss-timing lever. In `lib/sim/ai.js`:
- `CONFIRMED_SKILL_ORDER`: added **Coldheart `['A2','A3','A1']`** and **Hilvi (`Hilve the Rime-called` + `Hilvi`) `['A2','A3','A1']`**. Both prioritize their control skill over the default A3-first.
  - Coldheart's real AI is "A2 AoE over A3 nuke" (the infamous "Coldheart AI is horrible") → her A3 (Heartseeker, −100% TM drain) first fires on **turn 2**, never wasted on the low-TM opening boss. **RESULT: boss first-consume t23 → t39 (reality t40).**
  - Hilvi opens A2 (freeze-all), then A3 for the proactive [Increase SPD]+TM-fill.
- **`proactiveBuffs` unlock** in `canUseSkill`: Hilvi's A3 (Ward of the Glacier) is a REVIVE that also grants buffs "even if no allies were revived" (card text). The revive-lock was wrongly holding it; now `case 'revive': return anyDead || !!s.proactiveBuffs`, keyed on the "even if no allies were revived" regex in `readSkillKit`. Pure revivers (Tagoar/Iudex Artor) stay locked.
- `lib/sim/recipes.js`: Coldheart A3 cooldown **5 → 4** (card: base 5, "Lvl 5 Cooldown -1").

**2. Full Burning Blood engine** (Artak passive — was SILENTLY DEFERRED; Mike rightly called that out — never park load-bearing mechanics in a `deferred:[]` array again):
- Engine hook `state.onHpBurnActivate` fired at BOTH burn-activation sites (`lib/sim/engine.js`: tickDots HP-Burn branch + `activateHpBurns`) → `applyBurningBlood` in `interpreter.js`.
- Each [HP Burn] activation destroys 5% of Artak's MAX HP (cap 50%); destroyed% `d` scales **+1% DMG** (`a.dmgMult`, consumed in `computeRawHit`) **/C.DMG/DEF + 2 SPD/RES per 1%**. Lower MAX HP → lowest EHP → off-Taunt target → "dies first" falls out naturally.
- A3 `SELF_RECOVER_ON_BURN` op (`recipes.js` ARTAK-A3 seq 40): restore destroyed MAX HP 10% per burn **PLACED** (= healing — current HP rises with max) + heal 5% MaxHP per burn **BLOCKED/RESISTED**. Reads a `{landed, resisted}` tally now RETURNED by `placeDebuffs` and stashed in `ctx.placeResult`.

**3. Re-sync (the WR lever, 12%→40%)** — the Gestal snapshot was STALE for Artak: at snapshot time his gear was still on his predecessor **Iudex Artor**; Mike swapped Artak in and moved the gear after. Fix:
```
node gestal-sync/sync.js                                   # re-normalize Gestal's export (needs a fresh Gestal Refresh)
node --env-file=.env.local tools/build-from-sync.mjs a6261acc35588c94 \
  "Michelangelo,Coldheart,Hilve the Rime-called,Ninja,Artak" \
  > data/observed-builds/donahilvi-spider-artak.json        # NB: build-from-sync writes to STDOUT — MUST redirect
```
Artak's real gear: HP 19610, **ACC 170 (was 10!)**, SPD 158, Perception×3/Offense/Speed/Divine-CritRate. His damage went 88k → in-band; taken dead-on ✅; heals. ⚠ Only ~15/307 champs have equipped-gear links in any sync — re-sync when a champ was recently geared.

**Dragon golden stayed 39 pass / 3-of-3 REPRODUCED through every change** (safety held).

## The mechanic (Mike first-party, verified vs replay — do NOT re-derive)
- **Skavag (boss) has NO swarm-charge** (`spider.js:42`) — she fills on her own SPD 95. My earlier "swarm over-turns → over-charges boss" cascade was WRONG.
- She reaches full TM ~t27 but **doesn't MOVE until ~t39** because the **discrete-overflow scheduler** (Spider-only, `nextActorDiscrete`, `state.discreteScheduler`) queues faster units (allies + alive swarm) ahead of her via preserved overflow. Plus **Coldheart's A3 −100% TM drain** resets her (single-target → forced onto the boss since adds are untargetable), **enabled by Hilvi's A3 [Increase SPD]** letting Coldheart overtake the boss.

## Reality calibration (captures 66-67, Mike first-party 2026-08-01/02)
St13 Artak team: **Turns 51-52 · boss 1st-move t40 & moves ONCE · swarm moves 11 · ally ~40**. Taken TINY (~35-39k total), healing HUGE (~137-169k). Always ~10 spiders alive (respawn on death at 0 TM). Post-consume refill = 4 (Skavag) then +2/ally-turn. Spiderling St13: HP 42570, ATK 2129, DEF 473, SPD 150, **RES 100**, ACC 100.

## FRONTIER — WR 40% → 100%, two isolated levers
1. **Coldheart/Mikey HEALING MYSTERY (likely the last big sustain lever).** Reality: Coldheart heals **50k**, Mikey **21k** — with NO heal set and NO heal skill. Ninja lifesteal modeled but under (13k vs 61k). Chase: a **healing blessing** (`blessingId` is in the sync), uncaptured lifesteal, or a team-heal source not modeled. Start here next session.
2. **Swarm over-turn.** Sim swarm moves **34 vs reality 11**; fight drags **89t vs 56**. Freeze (Hilvi A2 cd5/1t + Ninja A3 cd5/1t) can't sustain suppression — the over-turning swarm STARVES the control champs (bistable loop). Reality keeps the swarm frozen-alive at high TM (out-queues the slow boss + doesn't attack + burns→splash the boss). This also makes Artak *over*-deal (778k vs 349k) because he survives the too-long fight; fixing length normalizes it.

## How to resume
- **QA bands:** `node --env-file=.env.local tools/sim-per-hero-bands.mjs` → read the **"DonaHilvi/Artak+Ninja (Artor out)"** block (sim vs captured per-hero dealt/taken/healing + WR + turns).
- **Dragon safety (must stay 39 pass / 3-of-3):** `node --env-file=.env.local tools/sim-golden.mjs`.
- **Turn census:** set `state.onTurn` to tally ally/boss/spiderling moves (reality target 40/1/11).
- Fixture `test/golden/spider-donahilvi-artak-current.json` → build `data/observed-builds/donahilvi-spider-artak.json`.

## Files touched
`lib/sim/ai.js` · `lib/sim/recipes.js` · `lib/sim/interpreter.js` · `lib/sim/engine.js` · `data/observed-builds/donahilvi-spider-artak.json` · `gestal-sync/output/DonaHilvi_a6261acc35588c94.json` · `test/golden/spider-donahilvi-artak-current.json` (note) · `data/manual-captures.json` (67 caps).

## Also available (asked this session)
Pool team for **DonaHilvi Dragon's Lair**: Michelangelo (lead, ACC aura) / Iudex Artor / Ninja / Coldheart / Hilvi (grade 105.9; the Mausoleum-Mage variant is 105.7 but needs an ACC gear move). `node --env-file=.env.local tools/pool-select.mjs dragon a6261acc35588c94`.
