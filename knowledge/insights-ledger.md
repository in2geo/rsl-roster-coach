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

## INS-0007 — Dungeons have PHASES (waves + boss); champion value is PER-PHASE
- **Status:** `proposed` (Mike, 2026-07-15) — RESHAPES the Layer 3 contribution model; high priority.
- **Claim:** FK / IG / Dragon (and event dungeons) are a WAVE phase (multiple adds) THEN a BOSS phase —
  different enemies, different problems. A champion's value is per-phase: some clear/survive the WAVES,
  some fight the BOSS. Team construction must satisfy EVERY phase — a boss-oriented team dies in the
  waves (and vice-versa). The contribution/watchdog model is PHASE-BLIND: it scores each champ against
  the whole content, averaging away phase-specific value. (The DB already has phases: `phases` tagged
  wave/boss/single + per-phase `goals` — the contribution model collapsed it.)
- **Killer example — Criodan the Blue (Epic, Lv25★4 unbuilt in DonBrogni):** A2 Razor Hail hits ALL
  enemies ×2 at 45% Freeze each + A1 freeze + passive self-TM per freeze = a WAVE freeze-lock/clear;
  A3 gives team +30% SPD + TM. He is worth ~0 vs Hellrazor (boss) and EVERYTHING vs the Dragon-20 waves.
  User's Dragon-20 runs: champs DIE on the way to the boss because the waves hit hard → the binding
  constraint is WAVE SURVIVAL, which the boss-oriented poison team can't do.
- **CRITICAL — this INVERTS the CC-immunity handling (INS-0004 residual, now urgent):** `CC_EFFECTIVENESS.
  dragon=0.40` was going to be LOWERED (~0.15) because the Dragon BOSS is CC-immune. That is BACKWARDS
  for the WAVE phase, where the adds are NOT immune and AoE Freeze is premium. Lowering it would have
  BURIED Criodan — the champ who fixes the problem. Per-content CC isn't just coarse; it's WRONG when a
  champ's value lives in one phase. **DO NOT lower dragon CC_EFFECTIVENESS until CC is scored PER-PHASE.**
- **Fix:** make the contribution model PHASE-AWARE — score each champ's contribution to each phase
  (wave-clear/wave-survival vs boss-DPS/boss-survival) and construct a team that satisfies ALL phases.
  Wave-clear (AoE damage + AoE CC on non-immune adds) becomes a first-class role. Immunity is per-phase
  (boss immune, adds not). This subsumes the INS-0004 residual.
- **GENERALIZATION (Mike, 2026-07-15) — CORRECTED taxonomy: THREE enemy classes across TWO phases, and
  "waves" ≠ "boss-phase adds":**
  | class | phase | problem | examples |
  |---|---|---|---|
  | **Waves** | pre-boss | survive/clear to REACH the boss | Dragon / IG / FK trash |
  | **Boss-phase adds** | boss phase (with the boss) | manage DURING the boss fight; often tied to a boss mechanic | IG's 2 minions, Spider's spiderlings |
  | **Boss** | boss phase | DPS + survive | Hellrazor, Ice Golem, Skavag |
  Per-dungeon shape differs: Spider = boss + boss-adds (NO pre-boss waves); IG = waves → (boss + 2 minions);
  Dragon = waves → solo boss. (Earlier draft wrongly lumped IG's boss-minions with Dragon's waves — they're
  different: IG has BOTH.)
- **"Add-handling" is a UNIVERSAL, TRANSFERABLE role — but split by class + satisfied per-dungeon:**
  Criodan (AoE dmg + AoE Freeze) helps the WAVE role in Dragon/IG/FK and boss-add LOCK in Spider. BUT the
  requirement varies: **kill vs lock**, **revive?**, timing.
  • Dragon waves → survive/burst through (then solo boss).
  • Spider spiderlings (boss-adds) → LOCK with AoE CC (15+; raw AoE stops clearing) → also starves Skavag.
  • IG boss-minions → keep them DEAD (they REVIVE); ALIVE minions make Frigid Vengeance a DEF-ignoring
    team-wipe, so this defuses the BOSS's kill mechanic. Freeze only buys time; killing/Block Revive is the
    real answer → a champ can cover the wave role yet only PARTIALLY cover the boss-minion role.
  ⇒ model needs SEPARATE needs: `wave_clear` + `boss_add_control` (+ boss DPS/survival), each scored by
  (method: damage vs CC) × (revive?) × (immunity) per dungeon — NOT a per-content average. Spider's per-goal
  build already encodes this.
- **Lesson (again):** I was about to make the model WORSE (lower dragon CC); only domain knowledge + a
  concrete champion caught it. Reinforces: the selector runs in SHADOW and is validated, never trusted a priori.

---

## INS-0009 — Ability economy across SEQUENTIAL waves: cooldowns carry over (Mike, 2026-07-15)
- **Status:** `proposed` — refines INS-0007 (waves) + INS-0008 (coverage sufficiency).
- **Claim:** Dragon has ~3 SEQUENTIAL waves before/including the boss, and **cooldowns CARRY OVER between
  waves** — a skill used on Wave 1 is still on cooldown entering Wave 2. So for any role performed EVERY
  wave (add-clear / add-control), "has the tag" ≠ "handles the waves"; a single cooldown-gated AoE covers
  ~1 wave, then a GAP. The role must be REPEATABLE across the sequence.
- **THE structural reason Criodan > Ninja for waves (beyond affinity/ACC):** Ninja's AoE freeze/stun is a
  COOLDOWN skill → ~1 wave of coverage. Criodan's A1 Frostbark freezes with NO cooldown (A1, every turn) +
  passive Snow Dancer fills his own TM per freeze → he freezes AGAIN → locks ALL 3 waves. Repeatable, not
  just reliable.
- **Modeling:** score per-wave-repeated roles by REPEATABILITY = f(source-skill cooldown vs wave cadence,
  # of independent sources on the team, speed-recycling). Satisfy via a low-CD/A1 specialist, OR multiple
  add-control champs, OR enough SPEED to recycle the CD before the next wave. Another reason turn-economy
  is king: speed makes abilities AVAILABLE more often, not just faster.
- **DATA GAPS:** (1) `champion_skills` HAS cooldowns (`cooldown_base`/`cooldown_booked`) but TAGS are
  champion-level and don't carry which skill/slot/cooldown provides them → need a tag→source-skill link to
  know if an AoE Freeze is a no-CD A1 (repeatable) or a long-CD A3 (one-shot). (2) DB models the wave phase
  as ONE, not N sequential sub-waves → the cooldown-cadence isn't represented.

---

## INS-0008 — Coverage must be RELIABILITY-weighted (shadow-constructor finding, 2026-07-15)
- **Status:** `proposed` — surfaced by the shadow team-constructor run; next build step.
- **Finding:** the shadow constructor (`lib/team-constructor.js` + `tools/shadow-construct.mjs`) builds
  sensible phase-aware teams from DB needs, BUT the Criodan validation exposed that BINARY (and even
  magnitude-based) coverage isn't enough — it must be weighted by RELIABILITY. Concrete: on Dragon-20 the
  built team's wave need reads "covered" because **Ninja (Lv50★5) has AoE Stun (control 1.0)** — yet the
  player keeps DYING in the waves, because at stage 20 Ninja's AoE Stun MISSES (enemy RES > his ACC; the
  mid-game ACC wall). So Criodan (dedicated 45%/hit AoE Freeze specialist) doesn't surface as an upgrade,
  even though he's the real fix — because the model can't see Ninja's coverage is UNRELIABLE.
- **Fix (next):** weight need-coverage strength by reliability. Reliability has FOUR dimensions:
  1. **proc chance** × uptime (booked, INS-0003 for Rares) × `auto_reliable` (migration written).
  2. **ACC vs the stage floor** (`stat_threshold_checks` — already in engine) — does the debuff LAND.
  3. **AFFINITY** (game fact, added 2026-07-15): stage enemy affinity × champion affinity. Off-affinity
     = glancing/weak hits + debuffs resisted → "drastically reduces reliability" (per strategy sources).
     DATA GAP: engine has `champions.affinity` but NO per-stage enemy affinity. Needs the affinity triangle
     (Magic>Spirit>Force>Magic; Void neutral) + per-stage affinity data.
  4. **DEBUFF POTENCY by rarity** (game fact): a Rare's Decrease DEF (~30%) ≠ a Legendary's (~60%). Covering
     a debuff role is NOT binary — the % magnitude matters. We store chance but likely not the debuff VALUE;
     add it (or approximate by rarity) so a weak Rare debuff doesn't read as full coverage.
  A tag "covers" a need only as well as it actually LANDS and how STRONG it is at that stage.
- **VALIDATION (independent strategy source, 2026-07-15 — mechanical facts only, editorial NOT copied):**
  outside guide independently confirms the framework: waves are a distinct escalating challenge (INS-0007);
  strategy shifts with progression — raw damage early, then AoE Decrease ATK OR CC (constraint-responsive);
  team shape 1 damage + 4 support incl. a turn-meter/speed slot (INS-0006 + INS-0005). Wave-survival = FOUR
  alt approaches, stage-dependent: KILL (raw AoE, early) / DECREASE ATK (soften) / CC (deny turns) / SUSTAIN.
- **Good outcome:** the shadow run did its job — instead of forcing the expected answer (Criodan), it
  revealed the missing dimension. Exactly why the constructor runs in SHADOW.

---

## INS-0006 — Team shape: 1–2 damage + 3–4 varied supports (supports multiply, carriers add)
- **Status:** `proposed` (Mike, 2026-07-15) — core calibration for the Layer 3 team-constructor.
- **CORRECTION:** an earlier draft of this concluded "load damage → 3–4 damage + 1–2 utility." That was
  BACKWARDS. The game meta is **1–2 damage dealers + 3–4 supports** (buffs/debuffs/sustain/protection/CC/
  aura). Recorded here as the fix.
- **Claim + why it reconciles with "utility falls off fast":** falloff is fast WITHIN a single role
  (no 2nd healer, no 2nd Decrease DEF) — but there are MANY DISTINCT support roles, each MULTIPLICATIVE
  on the carrier. Key asymmetry: **a support MULTIPLIES the carrier's output (percent, compounds); a 2nd
  carrier only ADDS its own raw output.** With 5 slots, stacking distinct multipliers on 1–2 well-fed
  carriers beats fielding 4 raw carriers who buff nothing and die sooner. So: seat enough damage to KILL,
  then load BREADTH of distinct supports.
- **This is the EMERGENT PROOF of the whole session's thesis:** sustain×turns, speed×turns, debuff×damage,
  Poison Sensitivity×poison, CC×survival — the multiplicative model is *why* the team template is mostly
  supports. The 1–2/3–4 ratio isn't a separate fact; it falls out of the multiplicative structure.
- **Re-frames the "carrier-vs-support distortion":** a support out-ranking a carrier in marginal value is
  often CORRECT (it multiplies; the carrier adds). The real guard is NOT "carriers must outrank supports"
  — it's the **kill-speed constraint** (two-sided confidence): the team must seat ENOUGH damage (≈1–2
  carriers) to kill in budget, then maximize the multiplier stack.
- **Implementation:** constructor ensures ~1–2 damage sources satisfy kill-speed, then fills remaining
  slots by highest-marginal DISTINCT support role. WITHIN-role saturation steep (2nd of a role ≈ ×0.25,
  3rd ≈ ×0.05; DoT via stack-cap `saturationValue`); ACROSS distinct roles, supports keep paying (each a
  new compounding multiplier). Aura best-among-fielded (INS-0005 R2). Nominal — calibrate against outcomes.
- **Lesson:** my a-priori conclusion was wrong and only domain knowledge (or real outcome data) caught it —
  exactly why the selector runs in SHADOW and is validated, not trusted a priori.

---

## INS-0005 — The SPD leader aura is the premier team-turn multiplier; construction must anchor on it
- **Status:** `proposed` (Mike, domain expert, 2026-07-15) — design direction for the Layer 3 selector.
- **Class:** game-mechanic fact + team-construction ordering.
- **Claim:** A SPD leader aura is the best leader skill in the game and the strongest form of the
  turn-economy principle (INS-0002): passive, team-wide, unconditional, active from turn 1, in ALL
  content. Unlike an active [Increase Speed] buff it needs no cast and never drops → a guaranteed
  team-turn multiplier ≈ the aura's SPD%. Team construction should FIRST secure the best SPD aura
  on a content-relevant champion (seat as leader), THEN fill roles (carrier → enablers → sustain → fill).
- **Model gap:** leader is chosen POST-HOC — `selectLeader(team)` runs AFTER `selectTeam` picks the 5,
  so (a) the aura can't influence WHO makes the team, and (b) a strong SPD aura on a champ who misses
  the coverage cut is LOST entirely (silent waste). The contribution composite has no leader-aura term.
- **Fix:** model the team's leader SPD aura as a guaranteed team-turn multiplier (best content-relevant
  SPD aura% among the fielded 5), attributed team-wide; make the Layer 3 team-construction ANCHOR on it
  as step 1 (aura-relevant + contributes), then marginal/saturation-aware role fill.
- **Rule 1 — the best aura relieves the team's BINDING CONSTRAINT for this content+stage (Mike):**
  not a fixed SPD>ACC preference — pick the aura that fixes the tightest bottleneck.
  • Turn economy is the usual bottleneck → **SPD** aura by default (basic dungeons).
  • Mid-game, higher stages: enemy RESIST outpaces gear ACC → debuffs MISS. A debuff/DoT team that
    can't land debuffs does NOTHING, so an **ACC** aura outranks SPD when the team is projected BELOW
    the stage ACC floor. Conditional + saturating: worth a lot at the deficit, ~0 once above the floor.
  • Other auras (CritRate nuke comps, etc.) in specific content.
  DATA IS ALREADY THERE: the aura step reads projected ACC vs `stat_threshold_checks`/`threshold_results`
  (ACC=land YOUR debuffs vs RES=resist boss's, per CLAUDE.md) and switches SPD→ACC on a deficit. Reuse
  `selectLeader`'s `LEADER_TYPE_WEIGHT` as the base, but make the SPD/ACC choice constraint-responsive,
  not static.
- **Rule 2 — aura value is MARGINAL / best-among-fielded / SATURATING (Mike):** only the leader's aura is
  active, so a champ's aura is worth the IMPROVEMENT over the best SPD aura the team already has. Ezio/
  Deacon: with Ezio (SPD aura) already fielded, Deacon's aura adds ~0 here; drop Ezio and Deacon's aura is
  the team's best → he anchors as leader on nearly every team. Same saturation shape as poison stacks / 2nd
  healer, applied to the leader slot. So DON'T add a flat per-champ aura score — score marginal aura vs the
  team-so-far during construction.
- **Deacon Armstrong = the archetype + a Layer-3 validation test case:** strong early/mid BECAUSE his value
  is turn economy — SPD aura (passive) + active turn manipulation (fills ally TM, drains enemy TM, extra
  turn). Post-session the composite ALREADY credits 2 of his 3 turn levers: Increase Turn Meter (INS-0002
  grant) + Decrease TM (INS-0004 control); only the AURA is still uncredited (this insight). TEST: on a
  team lacking a SPD aura the selector should surface Deacon as a strong pick/leader; on a team with Ezio
  it should NOT over-value his aura. Getting both right validates the marginal-aura logic.
- **Evidence:** consistent with INS-0002 (turn economy dominates); corroborated by the current waste —
  a benched best-aura champ contributes nothing. `selectLeader` already weights SPD auras top
  (LEADER_TYPE_WEIGHT spd:1.0) but only AFTER selection — the ordering is the bug.

---

## INS-0004 — Crowd Control is a survival mechanism (the composite is blind to it)
- **Status:** `encoded` (structure + coarse immunity) · magnitude `nominal` — 2026-07-15
- **Class:** game-mechanic fact (survival axis) — twin of §3 (sustain) and §3b (speed).
- **Claim:** Crowd Control (Stun, Freeze, Sleep, Fear/True Fear, Provoke, Petrification, Decrease
  Turn Meter) is survival by DENYING THE ENEMY turns — fewer enemy actions = less incoming
  damage, exactly as sustain extends ally turns and speed buys them faster.
- **IMPORTANT — CC is NOT unhandled by the app; this is a NARROW gap in the NEW composite:**
  The COVERAGE engine handles CC extensively — goal_solutions require AoE Stun (72×), AoE Freeze
  (61×), AoE/Decrease Turn Meter (47+58×), etc.; `checkCCSustain` treats ACC-gated CC as survival;
  the Clan Boss stun matrix models incoming stun. The gap is that the SESSION-NEW contribution/
  watchdog COMPOSITE never got a CC term (CC tags absent from TAG_TO_SOURCE / TAG_TO_MECHANISM /
  MULTIPLIER_DEBUFFS / TURN_MULTIPLIER_TAGS), so it scores a control champ 0 even though coverage
  values them. PLUS a real vocabulary gap: **True Fear and Petrification are required by ZERO
  goal_solutions**, and checkCCSustain only knows 4 CC tags — so Fabian's signature control is
  under-modeled in coverage too.
- **Evidence:** loop flagged **Lord Entertainer Fabian** scoring ~0 in the composite on Ice Golem
  across **11 fielded runs** (mostly wins). Coverage DOES credit his Decrease TM (fielded him);
  the composite zeroes him; reality sides with coverage. On IG he is on-mechanic — his passive
  drops True Fear on REVIVED enemies, countering the minion-revive threat. This is the coverage-vs-
  contribution disagreement of the whole session, with the CONTRIBUTION model in the wrong.
- **BLOCKER before encoding (why not done off the cuff):** CC value is CONDITIONAL on CC-IMMUNITY
  (cf. INS-0001). Many dungeon BOSSES are immune to hard CC (FK "Almighty Immunity" — CC works on
  minions only). A naive "CC = survival" term would over-credit CC vs an immune boss = a NEW error.
  Needs a per-content CC-effectiveness (like sustain THREAT_PROFILES) + structured boss CC-immunity
  (currently only free text in `boss_exceptions`). Also: Decrease TM ≠ hard CC (partial), and CC
  reliability depends on ACC landing (tie to reliabilityFactor).
- **Proposed fix:** add a `control` term to the composite — a CC mechanism set × per-content
  CC-effectiveness (0 where the boss is CC-immune and there are no adds; higher where minions/adds
  matter, e.g. IG). Mirror the sustain-profiles structure. Magnitude nominal until calibrated.
- **Encoded in:** `lib/sustain-profiles.js` §5 — `CC_CONTROL_TAGS` (tag→strength),
  `CC_EFFECTIVENESS` (per-content 0..1, bakes in immunity/adds), `controlStrength()`,
  `ccEffectiveness()`. `lib/watchdog.js` — `control` sub-score in the composite, weighted by
  `W_CONTROL_BASE × ccEffectiveness(content)` (applied as a WEIGHT so immunity survives
  normalization). Narrated via `dominantRole`. Test: `tools/watchdog-test.mjs` §6.
- **Verified:** Fabian-like champ 0 → composite 0.74 on Ice Golem, control sub-score 1.0; only
  0.19 on CC-immune Clan Boss (immunity guardrail holds). Loop re-run: `possible_blindness` items
  went 2 distinct (Fabian ×11, Staltus ×10/×4) → **ZERO** — the whole control-blindness class fixed.
- **Residual (future):** CC_EFFECTIVENESS is per-CONTENT, not per-PHASE — it can't yet distinguish
  "CC the boss" (often immune) from "CC the adds" (works) WITHIN a fight. Structured per-phase boss
  CC-immunity (promote `boss_exceptions` free text to a flag) is the refinement. Magnitudes nominal.
  Also: the coverage vocabulary gap remains (True Fear / Petrification / Sleep required by no goal) —
  a separate content fix (the "fix #2" option), independent of this composite work.

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
