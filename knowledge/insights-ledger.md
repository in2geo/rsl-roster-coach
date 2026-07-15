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

## INS-0012 — The calibration blocker is ON-SPEC runs, not data volume (actuator finding)
- **Status:** `proposed` — surfaced by the calibration actuator 2026-07-15; reframes the path to Deep Blue.
- **Finding:** the calibration actuator (loop → `knowledge/calibration-proposals.md`, report-only, guardrailed)
  found only **1 of 76** non-CB runs is ON-SPEC (fielded ≥3 of the recommended 5 AND attempted the recommended
  stage). We have 76 runs across 3 accounts, but players farm THEIR OWN teams at THEIR OWN stages — so ~75/76
  runs test something OTHER than what the model predicts. You cannot calibrate a prediction against runs that
  never made it. (Compounded by gear-tier miscalibration: the engine's recommended STAGE is often off, so even
  a player's "best stage" won't match the engine's number.)
- **CORRECTION (Mike, 2026-07-15):** the divergence between model picks and fielded teams is NOT neutral
  "players farm their own way" — it's that **the model picked BAD teams, so the player fielded their own
  BETTER ones** (coverage benched Brogni, fielded dead-CC Sun Wukong). Consequence: the "agreement with
  winning teams" metric is NOT circular (the player did NOT field the model's picks) — the winning fielded
  teams are INDEPENDENT EXPERT GROUND TRUTH, and the model's low agreement = the model is bad at picking.
  Unflattering read incl. the constructor: coverage agrees with wins 3.68/5, **constructor only 2.59/5** —
  the constructor is currently FURTHER from proven teams, NOT closer. The measurement does not support
  "constructor is better"; possibly the opposite. (Say it plainly — that's what shadow-measurement is for.)
- **REFRAME of the whole Deep Blue data story:** the blocker is NOT volume (corrected from "1 account" → 3)
  and NOT account count — it's model quality measured against the winning human teams we ALREADY have. Those
  ~76 winning teams are a TRAINING TARGET: the model must reproduce (then beat) them. On-spec runs (running
  the model's picks) validate the FIXED picks LATER; they're not needed to start improving.
- **The path to a calibrated/trusted model = DELIBERATE ON-SPEC VALIDATION RUNS:**
  1. the model produces a recommended TEAM + STAGE for a dungeon;
  2. the user runs EXACTLY that (recommended team, recommended stage, auto);
  3. the user reports the outcome (+ AI settings — reader can't capture them, [[ai-settings-manual-entry]]);
  4. the actuator calibrates on those on-spec runs (+ contribution/constructor get validated: their picks
     were actually FIELDED, so agreement→outcome becomes a real signal, not the circular one in model-accuracy).
  Organic version: the app being USED at scale (players run its picks) generates on-spec data for free. To get
  there NOW: deliberate validation runs — high-value, low-volume (a handful per dungeon >> hundreds of farms).
- **This is the last mile:** after all the machinery (knowledge, shadow models, measurement, actuator), what
  promotes the model from shadow→trusted is a simple human-in-the-loop A/B protocol, gated on on-spec runs.

---

## INS-0011 — Ice Golem survival mechanics: Decrease ATK mitigation + trash-wave gap (cross-check)
- **Status:** `proposed` — from a Gemini cross-check 2026-07-15 (mechanical facts extracted; editorial
  champion picks NOT copied). Two VERIFIED content gaps + refinements.
- **VERIFIED GAP 1 — Decrease ATK on the IG BOSS mitigates Frigid Vengeance:** keeping Decrease ATK on
  the boss heavily cuts his DEF-ignoring counterattack damage — a key survival lever. VERIFIED absent:
  ZERO `Decrease Attack` in any IG solution (stages 14-20). Candidate: add a boss-phase "mitigate Frigid
  Vengeance with Decrease ATK" goal (seed + approval). Fits wave-survival's 4 approaches (kill / DECREASE
  ATK / CC / sustain) applied to surviving the BOSS counter, not just waves.
- **VERIFIED GAP 2 — IG pre-boss TRASH WAVES not modeled:** real wave dealers (Seer/Zarala/Terrorbeast)
  precede the boss, distinct from the 2 boss-minions. VERIFIED: every IG "wave phase" goal is about the
  MINIONS ("kill both minions", "kill right minion first") — no trash-wave-clear goal. Confirms the
  content gap flagged in INS-0007: the DB collapses trash waves into the minion need. Candidate: add IG
  trash-wave clear goals (separate from the boss-minion goals).
- **Refinement 3 — Decrease TM UNRELIABLE on the IG boss:** he REGAINS turn meter when minions attack
  (not immune like Dragon, but self-refills). Per-boss caveat → discount AoE Decrease TM on the IG boss
  (it works on adds, not the boss). Model currently would over-credit it.
- **Refinement 4 — Max-HP-Destroy sustain nuance:** the boss permanently shrinks max HP, so SHIELDS +
  continuous-heal + mitigation beat flat/burst heals (flat healing degrades as the pool shrinks). A
  sustain-VALUATION nuance for IG (absorption/continuous > burst-heal), beyond the spike ranking.
- **Refinement 5 — the "babysitter" survival support:** 2-3 of {cleanse/block-debuff, revive, continuous-
  heal/shield, wave-control}, built HIGH RES so they resist the freeze themselves and can cleanse the team,
  + high SPD + tanky. Validates multi-mechanism sustain; RES-for-self-freeze-immunity is the specific.
- **Confirmed already-modeled (cross-check reassurance):** don't-burst, Poison/HP Burn safe damage, Block
  Revive, cleanse freeze, RES advisory, kill-right-minion-first (right minion = Decrease DEF). IG content solid.

---

## INS-0010 — Auto-battle SKILL AI settings (per-skill config + team-level resolver)
- **Status:** `proposed` (Mike design, 2026-07-15) — new feature area; schema can land now, resolver later.
- **Problem:** each skill on a champ+content has an optimal AI setting (always/never/conditional), but the
  optimum is TEAM-DEPENDENT (two Decrease DEF → only one should fire; which depends on speed/reliability/
  cooldown). Team-level problem, not a data lookup. Skill-INTERACTION knowledge (e.g. Xenomorph A2/A3 break
  his Perfect Veil window → never_use) is NOT derivable from tags/reliability — this is where it lives.
- **Layer 1 — `skill_ai_configs` table** (per champion × skill_slot × content_key): recommended_setting
  (always_use|never_use|conditional|default), condition, priority, ai_condition_notes, auto_reliable,
  rationale, validated, confidence_pct. Passives = always `default` (documenting behavior). First data:
  Xenomorph CB — A1 always_use, A2/A3 never_use (Veil window), validated=false until run data.
- **Layer 2 — team resolver** (runs AFTER selection/constructor, BEFORE explanation): resolves conflicts
  → per-champ AI config for THIS team. Conflict types: REDUNDANCY (two same debuff → keep higher
  reliability×uptime, disable other), DEPENDENCY ORDERING (DEF Down before dealers — flag if speed tune
  wrong; can't fix), SATURATION (two poisoners — both needed for stacks?), BUFF-EXTENSION collisions.
- **Layer 3 — validation:** `ai_config_used` (jsonb) on `run_reconciliations` stores the actual settings
  run; compare outcomes across config variants for the same team → promote validated=true. **The battle
  reader CANNOT read in-game AI skill settings (Mike, confirmed 2026-07-15) — so `ai_config_used` is MANUAL
  entry: ASK the user for the AI settings of any run being validated.** Low-volume (only for config-validation
  runs, not every capture), so manual is fine. See [[ai-settings-manual-entry]].
- **Explanation output:** a clean per-champ skill checklist ("Xenomorph: A1 only, disable A2/A3. Kael: all
  enabled, A3 priority 1.").
- **RECONCILIATION with existing work:**
  1. Resolver's "reliability × uptime" = our `reliabilityFactor` + ACC-vs-floor weighting (INS-0008) — reuse.
  2. `auto_reliable`: `champion_skills.auto_reliable` = GLOBAL default (migration written); `skill_ai_configs.
     auto_reliable` = per-content OVERRIDE (null → fall back). No duplication.
  3. `ai_config_used` column is cheap; CAPTURING it (battle reader reading skill-AI toggles) is likely a
     data gap (like durationSeconds was) — confirm feasibility, else can't tell "ran right" from "wrong config".
  4. Loop can DRIVE annotation: flag recommended champs with no `skill_ai_config` for the content = the
     on-demand annotation trigger (same philosophy as the motion surfacing blindness/gaps).
- **Build order (Mike):** (1) schema now [small]; (2) annotate on-demand starting most-used CB champs;
  (3) resolver for the 2 common conflicts (redundant debuffs + skill-disable ≈ 80%); (4) `ai_config_used`.
  Full run-data-backed confidence = 6-12mo data accumulation (data is the long pole, not engineering).

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
- **Status:** `encoded` (ACC-vs-floor dimension) — 2026-07-15; other dimensions still `proposed`.
- **BUILT + VALIDATED:** ACC-reliability weighting in `lib/team-constructor.js` (`accReliability`,
  `coverageReliability` uses the champ's BEST covering method, `needStrength` = max(reliable AoE-clear,
  ACC-gated CC-lock)). Built coverers scored at CURRENT ACC; potential (unbuilt) candidates at built
  potential. RESULT: Criodan the Blue now SURFACES as a wave-control upgrade for Dragon-20 (str 1.2 vs
  built 0.5, because Ninja's AoE Freeze at ACC 48 vs the 225 floor ≈ 21% reliable) AND Spider-18, and
  correctly does NOT surface for Ice Golem (minion need lists AoE Stun/Damage/Block Revive, not Freeze —
  revive → need dead). The 3-dungeon Criodan test passes. `tools/shadow-construct.mjs`.
- **STILL `proposed` (remaining reliability dimensions):** affinity (per-stage enemy affinity — data gap),
  debuff potency by rarity, repeatability across sequential waves (INS-0009, needs tag→skill-cooldown link).
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
