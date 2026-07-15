# Insights Ledger — the engine's durable "brain"

The accumulating record of what the recommendation engine KNOWS and BELIEVES, and how
each belief got there. This is the Deep-Blue knowledge store: conversation + captured
games surface an insight → it's recorded here as `proposed` → a human approves → it's
`encoded` into the store the deterministic engine reads (`damage-mechanics.js`, seeds,
config) → a later capture `verified` it improved the model. Nothing is load-bearing until
approved; magnitudes stay nominal until calibrated. This file is the audit trail; the
scoreboard (`scoreboard.md`) tracks whether the model is actually getting better.

**Status lifecycle:** `proposed` → `approved` → `encoded` → `verified` (→ `calibrated`).
Every insight cites EVIDENCE (a game mechanic and/or a captured run) — never a hunch.

---

## INS-0002 — Speed / Turn-Meter buffs are multiplicative team-turn multipliers
- **Status:** `encoded` (structure) · magnitude `nominal` (uncalibrated) — 2026-07-14
- **Class:** game-mechanic fact (→ allowed to be a model rule, per CLAUDE.md discipline #4)
- **Claim:** A team-wide [Increase SPD] / [Increase Turn Meter] buff gives every ally more
  turns over a time-budgeted fight, multiplying EVERY per-turn source (poison, HP-Burn,
  attack turns). It is the TWIN of the sustain-is-multiplicative rule (§3): sustain adds
  turns by keeping you alive, speed adds them by making them come faster. Its value shows
  up in OTHER champions' damage bars, so a pure speed-support reads ~1% on its own bar
  while contributing far more (the §4 support-understatement trap).
- **Evidence:**
  - Mechanic: speed = turn frequency (core Raid mechanic; same footing as §3).
  - Code audit (2026-07-14): `Increase Speed` was credited ONLY where a goal required it
    (Fire Knight shield-break); earned ZERO on Clan Boss/DoT dungeons; absent from the
    contribution model, synergy layer, and watchdog.
  - Capture: DonBrogni CB key 2026-07-14 (9.94M/134t). Fielded Apothecary (Healer +
    Increase Speed + Increase Turn Meter). Model PREDICTION before the rule scored her
    **0.0% contribution** — structurally blind to the champion the user found pivotal.
- **Encoded in:**
  - `lib/damage-mechanics.js` §3b — `TURN_MULTIPLIER_TAGS`, `TURN_MULTIPLIER_CAP`,
    `teamTurnMultiplier()`, `SPEED_IS_MULTIPLICATIVE`.
  - `lib/contribution-model.js` — team-turn multiplier scales team damage; granted
    throughput attributed back to the buffer(s).
  - `lib/watchdog.js` — `rawGrant` credits team-turn buffs (so a speed-support isn't benched).
- **Verified (N=1, directional):** re-eval of the same CB team moved Apothecary
  **0.0% → 23.1%** contribution; killTurns 45→35; confidence 0.63→0.86. See scoreboard SB-0001.
- **Calibration target:** `TURN_MULTIPLIER_TAGS` magnitudes (Speed 0.20 / TM 0.10, cap 0.35)
  are conservative game-knowledge nominals, NOT battle-tuned. Do not tune off a few runs;
  calibrate against captured DoT-team runs with/without a speed buffer once ≥ several exist.
- **Open:** should Speed + Turn Meter combine additively (current) or by max? Buff uptime /
  reliability weighting (a speed buff that drops is worth less). Speed also aids SURVIVAL
  (act before the boss) — not yet credited on the survival side.

---

## INS-0003 — Credit RARE champions at MAX (booked) skills
- **Status:** `approved` (Mike directive 2026-07-14) · `encoded` (representation hook only)
- **Class:** modeling assumption (rarity-conditional default) — amends a prior CLAUDE.md default.
- **Claim:** Rare skill books are cheap/abundant in-game, so a Rare champion should be
  evaluated at MAX skills: **booked** chances, **reduced** (booked) cooldowns, and books-only
  effects treated as functional. Epic/Legendary/Mythical keep the conservative default
  (respect the player's explicit `is_booked`) because their books are scarce.
  Motivating case: Apothecary (Rare) — her Increase Speed / Turn Meter / Heal should be
  credited at booked reliability, not penalized as unbooked.
- **Evidence:** game economy (Rare books common); code audit 2026-07-14 — engine currently
  DROPS `is_booked` in `mapRoster` and ignores booking in its math, so all approved tags
  already count regardless (rares are effectively booked TODAY for coverage/contribution).
- **Where it bites (why the rule still matters):**
  1. **Reliability layer (future):** when debuff chance/cooldown get plumbed into
     `reliabilityFactor`, a Rare must use `chance_booked` / `cooldown_booked`, never unbooked.
  2. **Books-only tags** (0% unbooked, e.g. Avir Decrease ATK, Pharsalas Provoke): count them
     for Rares. (Most are already `approved` live, so no immediate change.)
  3. **UI / CLAUDE.md default:** the champion sheet "booked defaults to No — never pre-checked"
     should carry a **Rare carve-out** (default Yes, or don't ask). NEEDS confirmation.
- **Encoded in:** `lib/match-engine.js` mapRoster → `assume_booked` (rarity Rare → true).
  Representation-only hook today; the reliability path MUST consult it when plumbed.
- **Open / needs approval:** amend the CLAUDE.md "booked defaults No" rule for Rares; set the
  manual roster UI to default Rares to booked. Not done unilaterally (edits a stated project rule).

---

## INS-0001 — Debuff value is conditional on the team's damage type
- **Status:** `encoded` · `verified` — 2026-07-14 (pre-existing; recorded here for completeness)
- **Class:** game-mechanic fact.
- **Claim:** Decrease DEF / Ignore DEF / Increase ATK boost ATK-vs-DEF **attack** damage
  ONLY; they do NOTHING for %maxHP DoT (Poison / HP Burn / Warmaster). So on a poison team
  they are near-worthless, while Poison Sensitivity (amplifies poison) and sustain/speed
  (buy turns) are what matter.
- **Evidence:** DonBrogni CB runs (Uugo Decrease DEF ~2% bar on a poison team); the same
  CB key above shows Decrease DEF on 3 champs + Increase ATK on 2 — coverage would credit
  all five as "damage buffs"; the model correctly credits ~0 to them vs poison.
- **Encoded in:** `lib/damage-mechanics.js` §1–§2, §5; enforced at load in `cb-damage-model.js`.
- **Consumers:** contribution model, watchdog (grant term), explain.js (debuff carve-out).
