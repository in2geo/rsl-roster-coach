# Spider-13 turn-by-turn track — reality (Ezio team, live capture) vs sim

Live-fight tracking, 2026-07-29. Reality = screenshots from Mike's Ezio-team run (Pelops lvl60, Tagoar,
Bambus, Ezio, Vergis). Sim = 12-seed avg trajectory of the same fixture. Purpose: the reality trace-oracle —
compare state turn-by-turn to localize where the model diverges.

| Turn | metric | REALITY (screen) | SIM (12-seed avg) | verdict |
|---|---|---|---|---|
| 42 | Skavag HP% | ~90% | 89% | ✓ match |
| 42 | boss debuff stack | ~11 icons | 2.6 | ✗ **sim 4× under** |
| 42 | Spiderlings alive | ~10 | 9.9 | ✓ match |
| 42 | Spiderlings w/ HP Burn | several (~3–5) | 0.8 | ✗ **sim ~5× under** |
| 63 | Skavag HP% | ~100% (HEALED UP) | 88% | reality oscillates up |
| 63 | boss debuff stack | ~5 | 3.4 | under |
| 63 | Spiderlings alive | ~8 | 9.3 | ✓ |
| 79 | Skavag HP% | ~82% | ~90% | reality dropping |
| 79 | boss debuff stack | ~8–9 | ~2.5 | ✗ **sim 3× under** |
| 79 | Spiderlings w/ HP Burn | **5+ (7k ticks each)** | ~0.5 | ✗ **sim ~10× under** |

## The two divergences — both are the two under-modeled damage engines, now VISIBLE

1. **Spiderlings carrying HP Burn: reality 3–5+, sim ~1.** At t79 reality shows 5+ Spiderlings taking ~7k
   burn ticks *simultaneously* — each splashes 3% of Skavag's MaxHP onto her. That is Pelops's 1.7–2.2M
   engine. The sim keeps only ~1 Spiderling burning at any moment → Pelops stuck at 572k (2.5–4× low).
   - **Refines the earlier "consume strips the burns" theory:** the sim has ~10 Spiderlings ALIVE at every
     checkpoint, but only ~1 is BURNING. So the dominant failure is not that carriers are consumed — it's
     that HP Burn is not being **placed** on enough of them. Pelops burns an attacker only when it attacks
     HIM (Master of Games, on-attacked). In reality his Taunt pulls many Spiderlings onto him each cycle →
     5+ burning. In the sim, few Spiderlings attack Pelops, so few get burned. → **Taunt / focus-fire
     targeting + on-attacked placement is the prime suspect**, not the consume.

2. **Boss debuff stack: reality 5–11, sim ~3.** Reality loads Skavag with a deep stack (many Poisons +
   HP Burn + Dec DEF/ATK/ACC + Weaken); the sim never accumulates more than ~3. This is Bambus's
   poison-redirect (dump onto highest-RES = Skavag) under-fueled — his 3.1× damage gap, made visible.

## Where the model matches (so it's not globally broken)
Skavag HP% early (~89–90%), Spiderling population (~10), and the vanilla dealers (Tagoar/Vergis/Ezio ~1.3×)
all track reality. The divergence is specifically the two DoT-stacking engines.

## Reality dynamic the sim misses
Skavag **heals back to full** between t42 (90%) and t63 (~100%) — the consume/lifesteal heal, on screen
(Mike: "she heals up many times"). The sim holds a flatter ~88–94%. So reality is a tug-of-war (big DoT
stack vs big heal) that the sim flattens because it under-builds the DoT stack.

## The oscillation — sim reproduces the CADENCE but nets to a STALEMATE (the killer finding)

Mike walked the fight live (t42→t124): Skavag alternates a NON-consume turn (Spiderlings tick HP Burn → she
drops) and a CONSUME turn (eats Spiderlings → heals up). The net over ~205 turns decides the fight.

SIM Skavag at each of her turns (seed 3):
```
t14 CONSUME 89% | t34 -- 97% | t57 CONSUME 80% | t77 -- 95% | t102 CONSUME 79% | t121 -- 83% | t139 CONSUME 79% | t152 -- 100%
```
She oscillates **79%–100% and never trends down** → burn ≈ heal per cycle → **unkillable; the team wipes
first.** Reality is the same oscillation with a **downward tilt** (heals to full at t124, but dies ~205t) →
**burn > heal.**

**Root cause = burning-Spiderling COUNT, and it is a PLACEMENT problem, not a survival one.** The sim keeps
~10 Spiderlings ALIVE the whole fight but only **~3 BURNING** (often 0); reality keeps **5–10 burning**. Each
burning Spiderling splashes ~3% of Skavag MaxHP/tick, so reality's ~8 burning ≈ 24% MaxHP/round (beats the
consume heal) vs the sim's ~3 ≈ 9% (loses to the heal). That ~3× deficit is the whole damage wall.
Corrects the earlier "consume strips the burns" theory — carriers survive; they just never get burned.

## Next model levers (in priority order)
1. **Why does the sim keep only ~3 Spiderlings burning vs reality's 5–10?** Pelops burns an attacker only
   when it attacks HIM (Master of Games, on-attacked). Trace: his Taunt uptime, how many Spiderlings attack
   him per cycle, and how many actually get HP Burn placed (once per enemy skill). The gap is here.
2. **Bambus poison-redirect fuel** — boss debuff stack tops out at ~3 vs reality's 5–11 (his 3.1× gap).

## Confirmed reality dynamics (Mike, live, 2026-07-29)
- Consume is a 2-turn alternation; on the non-consume turn Skavag visibly takes HP-Burn damage.
- "Boss just healed" at t124 — full HP after a consume (the heal spike is real and large).
- Streamer-overlay frames (K1scuta/Wuggalix/E1ixir7 viewer names) are first-party game state from Mike's
  source — factual state, used as the reality oracle.
