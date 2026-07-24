# Dragon-16 (DonBambus) — reality anchors

Ground-truth captures of the EXACT fight the sim validates against (team: Ezio, Vergis, Bambus,
Pelops, Tagoar). Two real Full-Auto runs + the live Pelops build. Use as reality anchors; do NOT
treat a single run as the target — the two runs differ enough to prove the outcome is a DISTRIBUTION
(the Monte-Carlo case).

## Run A — 2026-07-22 (review-notes docx), 150 turns, VICTORY, all 5 alive (via revive)
| Champ | Damage | Taken | Healing |
|---|---|---|---|
| Bambus | 506,399 | 22,143 | 0 |
| Ezio | 332,966 | 3,509 | 0 |
| Pelops | 259,218 | 25,650 | 45,460 |
| Tagoar | 71,280 | 4,446 | 92,193 |
| Vergis | 41,818 | 31,833 | 39,397 |
- **Vergis DIED in Wave 2 (~turn 75), revived before Round 3 (turn 86).** All 5 entered the boss alive.
- Timeline: wave1 clear ~t46 · wave2 t49–86 (the risk window) · boss t86–150.
- Ezio taken only 3,509 (Perfect Veil = untargetable, working in reality).

## Run B — 2026-07-24 (victory screen), 164 turns, VICTORY, all 5 alive (no death observed)
| Champ | Damage | Taken | Healing |
|---|---|---|---|
| Pelops | 420,926 | 30,246 | 84,205 |
| Bambus | 342,343 | 24,321 | 0 |
| Ezio | 334,685 | 30,776 | 0 |
| Tagoar | 69,899 | 21,335 | 109,610 |
| Vergis | 58,386 | 53,679 | 91,693 |
- Best-ever on this account: 143 turns / 4:04.

## Run-to-run variance (why Monte-Carlo, not one deterministic run)
- Top damage flips: Bambus 506k (A) vs Pelops 420k (B). Bambus 506k→342k, Pelops 259k→420k.
- One run had a Wave-2 death+revive, the other didn't. Same team, same stage → the win is a rate, not a point.

## Pelops live build (build screen, 2026-07-24) — the gestal snapshot is STALE
- **Lifesteal 4-set: "Heals by 30% of damage dealt"** → Pelops's 45–84k healing is LIFESTEAL, confirmed.
- Total Stats (base+gear): HP 29,650 · ATK 1,668 · DEF 1,790 · SPD 141 · C.RATE 66% · C.DMG 82% · RES 57 · ACC 70. Power 16,354.
- ⚠ The DonBambus gestal snapshot shows Pelops as **Perception 4 / Life 1 / Cruel 1 (no Lifesteal)** — OUT OF DATE.
  sim-suite feeds this stale gear/stats, so this account's sim numbers need a **Gestal re-sync** to be trusted.

## What the sim MUST reproduce (from the docx "simulator QA" section + these anchors)
1. **Wave 2 is the failure risk, not the Dragon.** A boss-only score misses the death+recovery requirement.
2. **Revival is load-bearing** — Tagoar A3 "Rise And Fight" revives all dead allies (30% HP + [Shield] 20% MAX HP).
   Sim must preserve death state, revive TIMING (revive-locked AI: hold until an ally is dead),
   post-revive HP (30%), Turn Meter (0), and cooldown carryover.
3. **Pelops Lifesteal** (30% of damage dealt) is a primary sustain source — must fire off his damage.
4. **Sustain-oriented boss plan**, not burst: Tagoar top healer both runs; team survives a ~64-turn boss phase.
5. **Pace**: real 150 / 164 (best 143) vs sim 179 → sim ~10–20% slow (missing offense amplifiers).
