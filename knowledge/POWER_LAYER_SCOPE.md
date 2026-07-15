# Power Layer (Layer 0) — Scope

**Status:** scoping · 2026-07-15 · author: modeling session with Mike
**One line:** the engine measures whether you hold the *keys* (tags) but never whether you
can climb the *wall* (raw power). This is the missing wall-measurement layer.

## Why (three observations, one root cause)
1. A maxed Lv50-60 geared team trivially clears LOW stages of every dungeon — no tactic needed.
   The model still gates those stages on placeholder floors + tags, so it under-recommends
   (DonBrogni Spider: model said Stage 5, team farms to 13).
2. The model cannot DERIVE a solo carry — `champion_solo_profiles` is 45 hand-researched
   lookup rows with zero computation. Soloing is the purest wall problem (one champ's damage
   vs stage HP; one champ's sustain vs incoming damage).
3. ACC / affinity / HP floors mis-fire because they are placeholders standing in for a wall
   we never actually measure ([[INS-0014]] ACC-soft, [[INS-0015]] affinity, floors-are-not-gates).

Root cause: **no power/stat-sufficiency model.** The engine is inverted — it leads with
tactics and proxies power with uncalibrated floors. Correct order: power first (can you
brute-force the stage?), tactical hard-gates second (must break shield / deny Skavag),
reliability third (ACC land-rate, affinity, survival headroom — grind-vs-smooth at the ceiling).

## The model: two-sided power (this IS the contribution-model target)
For a team (or a single champ, for solos) at a stage:
- **Kill-speed side** = team damage-per-turn ÷ stage effective HP → turns-to-kill.
  Clears if turns-to-kill ≤ the time/turn budget (~5-min auto).
- **Survival side** = stage incoming-damage-per-turn ÷ team effective bulk+sustain →
  turns-survived. Clears if turns-survived ≥ turns-to-kill.
- **Power-sufficient(stage)** = (turns-to-kill ≤ budget) AND (turns-survived ≥ turns-to-kill).
- Sustain is MULTIPLICATIVE on the survival side (extends turns-survived → multiplies total
  damage): heal/shield/Revive/lifesteal-set. This is where the Sun Wukong revive-sponge lives.

The highest power-sufficient stage is the **power floor**. Tactical hard-gates can still block
specific stages within it; reliability factors (ACC/affinity) only refine confidence AT the
ceiling and are *relaxed by survival headroom* — they must never drag the recommendation
below the power floor (the current bug).

## What's computable TODAY (real data we already hold)
- **Per-champ effective stats** (Gestal `baseStats`, real gear, current level):
  hp / atk / def / spd / crate / cdmg / res / acc. Manual rosters: gear-tier estimate.
- **Damage output:** `champion_skills.damage_multiplier` + `multiplier_type` (1,330 rows) →
  per-turn attack damage = ATK × multiplier × crit-expectation. `cb-damage-model.js` already
  does the source-coefficient math (`estimateCbDamage`, `SOURCE_COEFF`, DoT vs boss HP).
- **Masteries:** Warmaster / Giant Slayer boss-damage flags (`masteries.js`).
- **Sustain:** heal / shield / Revive tags classified in `sustain-profiles.js`.
- **Effective bulk:** HP × DEF-mitigation, team-min (survival is a floor, not an average).

⇒ We can compute a **relative team/champ POWER score** right now: attack damage-per-turn is
boss-HP-independent (ATK vs DEF), effective bulk is direct. Only the *absolute* mapping to a
stage is missing.

## What's missing — and the two ways to get it
Missing: **per-stage stage difficulty** — boss/enemy effective HP and incoming-damage-per-turn.
Not seeded for any dungeon (only Clan Boss has a bossHp input). Source stat tables are images.
Also DoT (%maxHP poison/HP-burn) needs boss HP to value absolutely.

- **Path 1 — seed absolute difficulty (rejected as the starting point):** hand-enter boss HP +
  incoming damage for 100 stages × 4 dungeons from image tables. Expensive, image-locked, and
  exactly the "false precision" trap the gear-calibration note warns about.
- **Path 2 — calibrate power→stage from OUTCOMES (recommended):** compute the relative power
  score from real stats, then fit a monotonic **per-dungeon power→max-clearable-stage curve**
  from a few anchor points. This backs the difficulty scale out of real clears instead of
  seeding boss stats, and absorbs the unknown DoT/HP scale into the fitted curve.

## Where Mike's empirical rule pins the calibration
Path 2 needs anchors. We have them cheaply:
- **Low anchor (the rule):** "5× Lv50-60 + gear clears low stages of every dungeon." → the
  power score of a generic geared Lv60 team ≈ sufficient for ~stage 1-10. Pins the low end of
  every dungeon's curve for free.
- **Ceiling anchors (captured clears):** DonBrogni Spider ~13, IG 14-15, etc. → this team's
  computed power score cleared stage N. Each captured clear is one (power, stage) point.
- **Solo validation set:** the 45 `champion_solo_profiles` are 45 known-good
  (champ, stage, required_set) points — the derived SOLO power model must reproduce them, or
  it's wrong. Built-in test harness for the solo extension.

A monotonic fit through {low-anchor, ceiling-anchors} per dungeon = the calibrated curve.
More captured clears tighten it over time (the existing feedback loop feeds this directly).

## Stat-data inventory (2026-07-15 audit — "check the seeds for other stats")
Prompted by: the affinity data was orphaned in seed prose; check for more. Findings:
- **Survival-wall anchors — HIGH VALUE, already queryable.** `champion_solo_profiles.required_stats`
  has numeric HP/DEF/SPD/ACC/RES for **40 of 45** rows, plus the required gear SET, some
  Plarium-forum CONFIRMED. e.g. Spider 10 = HP 85k/ACC 350/DEF 4500/SPD 247 (Slayer); Dragon 25
  = HP 65-75k/DEF 2600-3200/RES 300-330/SPD 220-250/ACC 250-265 (Regen+Immortal). A solo tanks
  100% of stage incoming, so these DIRECTLY quantify per-stage incoming pressure (the number
  thought image-locked). → primary anchors for the survival-side curve at high stages.
- **Promote-to-queryable constants (currently prose-only in seed comments):**
  - Fire Knight Divine Shield hit-counts: 5 (1-6) / 7 (7-9) / 10 (10-20) / 12 (21-25) — kill-wall.
  - Spider heal-effectiveness = 35% (per-dungeon sustain multiplier).
  - Enemy-stat proxy formulas: Spider ACC = stage×11 ≈ enemyRES+25; RES = stage×10+100 ≈
    enemyACC+100 → per-stage enemy RES/ACC → real debuff land-rates (replaces placeholder ACC floors).
  - %MaxHP caps (Almighty Strength 10% at 21-25); DoT stack rates (5% poison); Klyssus minion
    revive thresholds (80/60/45/30/15%).
- **Absolute enemy stats — NOW CAPTURED for Spider 1-15** (`dungeon_stage_enemies`, seeds/131,
  migration 2026-07-15). Real boss+add HP/ATK/DEF/SPD/RES/ACC/crit: Skavag 71k→1.5M HP, enemy
  RES 30→100 (the true ACC-to-land target, replacing the stage×10 placeholder), enemy ATK for
  incoming damage. This is the kill-speed AND debuff-landing wall in real numbers — no longer
  image-locked for Spider. Other dungeons + Spider 16-25 pending the same capture.
- **Still absent:** Dragon / Ice Golem / Fire Knight enemy stat tables (same capture task);
  incoming-damage-per-turn is derivable from enemy ATK + skill kits but not yet modeled.

## Build sequence
1. **`lib/power-model.js`** — `teamPower(team)` and `champPower(champ)` → {damage_per_turn,
   effective_bulk, sustain_factor}. Reuse `cb-damage-model` source math + `sustain-profiles`.
   Pure function of real stats; no new data. (Computable today; testable in isolation.)
2. **Power→stage calibration** — `powerToMaxStage(power, dungeon)` fit from the anchors above,
   stored as a small committed calibration (per-dungeon curve params), re-fittable as clears
   accumulate. Conservative by default (under-promise near the ceiling).
3. **Wire as a FLOOR in the scan** — the recommended stage = max(power_floor, current tactical
   result), i.e. tactical/ACC/affinity penalties may only refine ABOVE the power floor, never
   below it. This closes the Stage-5 lowball.
4. **Survival→reliability coupling** — survival headroom (sustain incl. Revive) relaxes the ACC
   soft-penalty ([[INS-0014]]) and the affinity penalty ([[INS-0015]]). This is the Sun Wukong
   fix, and it falls out of the survival side of the power model.
5. **Two-number output** — "reliable farm" (power floor, high confidence) vs "push ceiling"
   (highest power-sufficient, slower/riskier). Honest display; maps to the free/AD tiers.
6. **Solo derivation (LATER, hardest):** `champPower` vs the same curve, but must add the
   Lifesteal/Regeneration/Immortal sustain-SET modeling that the general engine deliberately
   ignores (solos live in that regime; `required_set` on the 45 rows encodes it). Validate
   against the 45 curated profiles before trusting any derived solo claim.

## Risks / guardrails
- **Over-recommendation flip:** a power floor calibrated on thin data can tell a player they'll
  clear a stage they won't (worse than under-recommending). Mitigate: conservative fit, and
  check every derived floor against every captured clear before trust (reasoning-discipline #4).
- **Manual rosters have no real stats** — only gear-tier estimates (and `estimateStats` has a
  known level-scaling bug, see stat-estimator memory). The power model is sharpest for Gestal
  rosters; degrade gracefully (wider confidence band) for manual ones.
- **DoT teams** need boss HP for absolute damage — folded into the fitted curve for now; revisit
  if the fit is poor for poison-heavy teams.
- Magnitudes stay NOMINAL until the curve is fit against real clears. Do not ship precise-looking
  stage numbers off an unfit curve.

## Relationship to existing pieces
- `cb-damage-model.js` — the damage half already exists (CB); generalize it.
- `sustain-profiles.js` / `watchdog.js` — the sustain classification exists; promote it from
  display-only to a survival-side INPUT.
- `stat_threshold_checks` (placeholder floors) — become a *fallback* for manual rosters /
  uncalibrated dungeons, not the primary gate.
- ACC-soft ([[INS-0014]]) + affinity ([[INS-0015]]) — remain, but as refinements ABOVE the
  power floor, coupled to survival headroom.
