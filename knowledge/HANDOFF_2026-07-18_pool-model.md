# Session Handoff — 2026-07-18 (evening): the POOL MODEL + the first real CB A/B data

Cold-start doc, SUPERSEDES `HANDOFF_2026-07-18_grading.md` for what to do next (that one is still
right about the grading system being the standing validation tool — that rule holds).

Read order: this → `knowledge/cb-bucket-taxonomy-DRAFT.md` → `insights-ledger.md` **INS-0030…0033**.

---

## ⏩ READ THIS FIRST — state at end of session

The premise **HOLDS**. Seed with your best champions → measure against a budget of jobs → repair what
is short. It lands on known-good teams, separates clears from wipes, and keeps every account's real
carries.

**THE TEST THAT MATTERS — `tools/shadow-grade-clears.mjs` — 14/15 (93%).** On DonBrogni Dragon 20 the
seven clears score 104.3-105.6 and the two wipes 89.2/89.7: a 15-point gap, both failures flagged
unseen. The two SPEED tests (`shadow-grade.mjs`, `shadow-grade-dragon.mjs`) return ~coin-flip and are
kept only for reference — Mike: *"are we trying to get the fastest farming team?"* No. Every Dragon 20
team clears in 184-235s, well inside the ~5-min budget, so ranking them by speed measures a difference
the product does not care about. **Do not re-read those numbers as model failure.**

**Commands:**
```
node --env-file=.env.local tools/pool-select.mjs dragon        # what to field
node --env-file=.env.local tools/pool-select.mjs cb Brutal
node --env-file=.env.local tools/shadow-grade-clears.mjs       # THE test (baseline 14/15)
node --env-file=.env.local tools/watch-reconcile.mjs           # auto-grade while playing
```

**Four corrections Mike made that got it working — all structural, none tuning:**
1. Seed by DEVELOPMENT (not coverage) — the brute force put Seeker (L40) in all 5 top teams and
   dropped Ezio, ranking the real Grandmaster team #90 of 3003.
2. REPAIR GAPS, don't maximise grade — the grade-chasing version traded Xenomorph (measured 13.4M
   carry) for Iudex Artor on two accounts, each labelled "grade improvement".
3. Repairs must come FROM developed champions too — it had benched a maxed 6★ Legendary for a L40
   Epic because the L40 touched two more buckets.
4. Counterattack + Ally Attack → Damage, not Amplification (Damage GENERATES, Amplification
   MULTIPLIES). This single change made the selector bench Gnut instead of Ezio and land on
   Don$Gnut's 23.46M GRANDMASTER team exactly.

**What it CANNOT do (both = the multiplier project, Mike: "a separate project"):**
rank already-working teams against each other, and predict which stage is the limit (no difficulty
axis exists — only a placeholder ACC floor). Use it as a PICKER, then CLIMB to find the limit. Mixed
W/L at a stage = that account's frontier and is the most valuable data in the log.

**NEXT — SUPERSEDED BY INS-0034 (`274525a`), read that first. EFFECT SIZE IS DEMOTED BELOW ALL FOUR
ITEMS BELOW:** it sharpens PICKING only, and picking already works well enough to climb with. The
diagnosis path does not need it at all. The reprioritised order:

1. **DEVELOPMENT verdict — the cheapest item, and it moved from LAST to FIRST.** It sounded like the
   vague one; it is actually a rule over data we have had all along — `level`, `stars`, `gear_tier`,
   `has_boss_mastery` are all already in the roster snapshot and `devScore` computes most of it. No
   reader fix, no capture change, no LLM extraction. **Mike's correction: it is DEVELOPMENT, not
   "masteries and gear"** — *"i have a lot of level 50 5 star champs in the rotation. those need to be
   leveled up to 60. its a big stat increase."* Order by stat gain: **ascension 5★→6★ → levels to 60 →
   masteries → gear.** Measured on Don$Gnut: Pelops L60 6★ +masteries (maxed); Tagoar, Gnut L60 6★ no
   masteries; Ezio **L52**; Pallas, Narma **L50 5★**. Three of five fielded under-developed, 12 of 15
   across the pool, 1 of 31 with boss masteries. **This reframes the Dragon 20 result (11:01, VICTORY):
   not a composition failure — it is what an under-developed roster looks like, which is also why both
   selectors and Mike independently land on the same five. There is nothing left to fix in the lineup.**
2. ~~**Dungeon per-hero capture**~~ ✅ **DONE — the "records ZEROES" claim was already false when
   written (verified against the live log 2026-07-19).** Per-hero `damage` lands on 100% of dungeon
   captures since 2026-07-16; `healing` + `defense` since the 07-18 Release build. The sustain-surplus
   ratio now computes itself — Don$Gnut Dragon 20 (07-19): healing 929,294 vs damage taken 202,208 =
   **4.6× over-supplied** (~2.8× after discounting Gnut's self-heal, INS-0032).
   ✅ **`defense` = DAMAGE TAKEN, CONFIRMED 2026-07-19** (in-game bar legend: red dealt / blue taken /
   green healed). The over-supply rule (item 3) is unblocked — its input is now a measured quantity.
   **RESIDUAL LIMIT = DATA VOLUME (n=5 dungeon captures carry healing), and it CANNOT be backfilled.**
   ⚠ **OPERATIONAL RULE: the reader must be RUNNING during play or the run is ungradeable.** It was not
   running for the 07-19 Tagoar→Vallaryn Dragon 20 swap, so that A/B has no captured baseline and the
   result exists only as recollection. Start reader + `watch-reconcile` BEFORE any test session.
3. **The over-supply rule** — once healing-vs-taken exists it is arithmetic: `healing > N × damage
   taken` → sustain is surplus → name the seat to convert. (Dragon 20: 1,276,944 vs 252,287 = **5.1×**.)
4. **Phase timing** — wave seconds vs boss seconds. Not captured at all; *"the waves are slowing me
   down"* is currently unknowable from the data and Mike had to say it out loud.

Then: (a) benchmark GuapoDonni before climbing — its two most-developed champs are Sun Wukong + Alice,
the pair the ledger records failing at Ice Golem 20; (b) climb with the picks.

**Note for Phase 2** (optimal teams assuming all champs maxed = the POTENTIAL layer, ad-gated): that
phase depends on effect size MORE than Phase 1 does, because it removes the development seed currently
doing the heavy lifting. Demoted ≠ dropped.

---

## TL;DR

1. **Mike defined a new scoring model: the POOL/BUCKET budget** (INS-0030). Six buckets, 100%, allocation
   ruled. It replaces the ordinal weights whose 0.25x saturation cliff produced three wrong benchings.
2. **Two scorer fill rules were built and BOTH FAILED** (INS-0031) — read the failures before rebuilding
   one. The blocker is MAGNITUDE, not structure.
3. **Ran the first real CB A/B on Don$Gnut**, four captured runs. Data below.
4. **The reader now captures healing + defense** per hero (verified against screenshots) — sustain is
   measurable for the first time.
5. **Shipped + PUSHED:** B1 (skill-grounded explanations), A-real (CB chest verdict), `is_booked` from
   Gestal. `origin/main` = `89d48f0`. **NOT deployed to Vercel.**

---

## The empirical data (Don$Gnut, all Brutal unless noted, all graded)

| Team (5th seat varies) | Damage | Chest | Turns |
|---|---|---|---|
| Ezio, Pelops, Narma, Pallas, **Tagoar** | **23.46M** | **GRANDMASTER** (margin 1.081) | 268 |
| Ezio, Pelops, Narma, Pallas, **Fahrakin** | 22.0M *(reported, uncaptured)* | GRANDMASTER | — |
| Ezio, Pelops, Narma, Pallas, **Fahrakin** | 21.54M | master (164k short) | 210 |
| **Gnut**, Pelops, Narma, Pallas, Fahrakin | 20.20M | master | 177 |

**Brutal top chest (Grandmaster) = 21.7M. Nightmare Ultimate = 39.17M** (Nightmare runs all sit ~0.33 —
not the target difficulty). **Top difficulty one-keyable = Brutal.**

**What each comparison establishes:**
- **Tagoar vs Fahrakin:** the Fahrakin team STRADDLES the Grandmaster line (22.0M over, 21.54M under);
  Tagoar cleared with 1.76M headroom, but on ONE run. Tagoar looks the safer pick for banking the top
  chest; it is not a clean win and n is tiny. **The synergy weighting added this session seated Fahrakin
  — i.e. it made the pick worse.**
- **Ezio vs Gnut** (clean captured swap, everything else identical): Ezio +1.33M. Ezio's OWN damage is
  near-identical to Gnut's (2.64M vs 2.39M) — the difference is that **Pelops dropped 9.00M → 7.15M**
  without him. Ezio's value lives in someone else's bar (damage-mechanics §4), which is the case for
  Amplification being its own bucket.
- **CONFOUND, do not ignore:** the Gnut run also swapped the LEADER AURA (Ezio's 19% SPD lead → Gnut's
  ACC lead), and turns fell 210 → 177. Some of that 1.33M is the aura, not the kit. Not separable from
  this data.
- **CONFOUND 2:** Tagoar is 86% booked, Fahrakin 38% (INS-0033). Not separable either.

---

## STATE — what shipped, what didn't

**PUSHED to `origin/main` (public repo), NOT deployed:**
- `2e88fd1` — B1 skill grounding + A-real CB chest verdict + strips the `model-select.js` dead end.
  Verified live: 4 verbatim skills carried for Pelops; verdict returns `top_one_keyable: "Brutal"`,
  grandmaster, `earned_top: true`, margin 1.081 — reproducing by machine the conclusion reached by hand.
- `89d48f0` — `is_booked` derived from Gestal (INS-0033).

**UNCOMMITTED, shadow-only (deliberate):** the sustain split (`cb-shadow-goals.js`), the synergy wiring
(`team-constructor.js` + `shadow-cb.mjs`), the `ally_attack_stack` correction (`synergies.js`), the
quick-battle accounting (`reconcile-runs.mjs`), the reader C# capture, `tools/bucket-score.mjs`.

**⚠ BACK OUT OR RE-JUSTIFY: the synergy weighting. — CORRECTED 2026-07-19: ALREADY DONE.**
`tools/shadow-cb.mjs:53` now reads `CB_SYN_W != null ? Number(...) : 0`, i.e. it **defaults to 0**,
with a comment at :52 noting 0 reproduces pre-synergy selection for A/B. The paragraph below is stale
— nothing to back out, and the shadow selector is NOT seating Fahrakin. The reasoning is retained
because the *justification* half still stands. Original text:

**`shadow-cb.mjs` defaults `CB_SYN_W=0.6`, which
seats Fahrakin over Tagoar — and the captures say that costs a chest tier. It is off by default in
`team-constructor` (`synergyWeight = 0`), so nothing live is affected, but the shadow default should go
to 0 pending a better formulation. Its original justification (an ally-attack "cascade") was also wrong:
Mike — *"both ally attacks would kick in SEPARATELY in the battle"* — they do not chain, and an Ally
Attack is a champion's OWN skill already paid for by `extra_hits`, so crediting it again double-paid it.

---

## OPEN — next steps, in order

1. **Magnitude-based fill** — the one thing blocking everything else. See INS-0031 for the formula shape
   and for the two fill rules already rejected. Cheap interim: land-rate × uptime only (no effect-size
   extraction); that alone separates Pelops (ACC 214) from Gnut (ACC 20) and may be enough to test the loop.
2. **Then the construction loop Mike wants** (his framing, and `lib/team-assembler.js` already has the
   machinery): seed with the BEST-BUILT five → grade against the pool → find the short bucket → who can
   cover it, what do we give up → repeat. `fixTeam()` is exactly the constrained re-solve; the best-built
   seed is the fix for why the assembler was shelved ("naive set-cover, fielded fodder"). **Do not build
   this until the grade discriminates** — the loop needs a gradient and currently every team scores 100.
3. **Confirm the PROPOSED-DEAD list** in the taxonomy draft. Claude is the source on it, not Mike; a wrong
   entry silently zeroes a real capability.
4. **Remaining taxonomy rulings:** `Ally Protection` / `Pain Link` placement; whether shares shift with
   gear tier; where immunity/self-protection lives (see below).
5. **Deploy** — nothing from today is live for users.

---

## Bugs and gaps found today (each is real, none are fixed)

- **Pelops `ascension_required = 0` on every skill row, including the passive** — but `CLAUDE.md` lists
  him under *yellow-star-screenshot CONFIRMED* as `Master of Games [P]: ascension_required = 3`. The
  confirmed ruling never reached the DB. No impact on Mike (his Pelops is ascended); on any account with
  an unascended Pelops the model credits immunity + the HP-Burn engine + the unresistable Decrease ATK he
  does not have. **Owed as a seed.**
- **Capability classes with NO representation** (all found via Pelops, who is the account's best CB
  champion *because* of them): (a) **immunity/self-protection** — tag policy #10 rejects "immune to [X]",
  correct for placement but it makes immunity invisible; (b) **damage-on-being-hit** — his passive places
  HP Burn on anything that attacks him, no tag exists (`Reflect Damage` is the nearest, ruled into
  Damage); (c) **unresistable debuffs are not scored** — his Decrease ATK cannot be resisted while the
  target is under his own HP Burn, so his ACC 214 is near-irrelevant to his key contribution, yet the
  engine discounts every debuff by ACC. The ACC gate needs a bypass exception (policy #17 case).
- **Ezio's `Debuff Activation` is conditionally gated** — A2 activates Poison only on enemies *"under 4
  or more debuffs"*. On a team where four of five are below the ACC floor, that gate may rarely open, so
  the `dot_activation_engine` synergy the model pays him for may not fire. Unverified.
- **Untagged kit healing** — Gnut's A3 heals him 30% of damage dealt with no tag; Pelops posts 389–665k
  healing with no restoration tag. The kit-vs-observed audit flags them but cannot separate "gear
  lifesteal" from "tag gap".
- **Unbuilt champions are gated out of the pool** — `pool.filter(usabilityTier >= 2)` hides every
  under-levelled champion (High Khatun L25, Apothecary L24 on Don$Gnut), so the model can never say
  "level X" even where a bucket IS short. The GAP is real; build FILLED vs FILLABLE (INS-0030).
  **⚠ BUT NOT THE OLD EXAMPLE — CORRECTED by Mike 2026-07-19.** This previously claimed "level High
  Khatun" was *"probably the single most valuable recommendation available"* on Don$Gnut. **Wrong.**
  Mike's statement was CONDITIONAL — *if* the account had no turn-meter manipulator. Don$Gnut has
  several already levelled, and `pool-select` proves it: the Dragon seed showed tempo 40%, the repair
  seated Glorious Pallas, tempo finished **112%**. **An unbuilt champion's value is conditional on the
  bucket being short — never intrinsic.** A correct FILLABLE layer stays SILENT on High Khatun here.
- **`durationSeconds` is 0 on CB captures.** Irrelevant for CB (Mike: time does not matter there — it is
  damage vs threshold) but presumably the same gap on the dungeons, where TIME *is* the judgment.
  **NOTE: `CLAUDE.md` states "judged by TIME not turns" as a blanket principle with no CB exception —
  the doc and the code disagree and the code is right. Turns DO matter on CB and will feed a speed
  assessment.**

---

## Corrections to earlier beliefs (things stated confidently and then disproved)

- **"The 12.3M→34.1M Nightmare spread is same-team variance / a dropped Xenomorph"** — no. Those were
  DIFFERENT TEAMS (Ninja+Thisbe vs Donatello+Duchess). Same-team variance is ~10%.
- **"Gnut is benched because of ACC 40"** — no. Raising him to ACC 200, and removing the ACC gate
  entirely, still does not seat him. It is SATURATION (INS-0031).
- **"All four Brutal captures have zero damage — something is Brutal-specific"** — no. Three predate
  `CbDamageReader` existing (2026-07-12). The one real case is a quick battle, which never opens the
  result dialog the damage is read from. Quick battles are now counted, not silently skipped.
- **"Total damage tracks turns"** — holds across the three Brutal runs, CONTRADICTED at Nightmare
  (153 turns produced more damage than 210). Not a general relationship.
- **"The Fahrakin team does not one-key Grandmaster"** — stated from one capture while ignoring Mike's
  earlier reported 22.0M run. Two runs, straddling the line.
- **"Gestal does not expose book status"** (a comment in our own code) — false, see INS-0033.

---

## Traps

- **Use the grading system; scope every read by `account_id`.** (Still the standing rule.)
- **Do not calibrate sustain off the healing column naively** — it mixes team-heal, self-heal and gear
  lifesteal (INS-0032).
- **Do not rebuild a bucket scorer without reading INS-0031's two rejected fill rules.**
- **Build to what the AUDIENCE can supply**, not what Gestal exposes (INS-0033). This is why booking is
  a boolean.
- ~~The `defense` column's semantics are UNCONFIRMED~~ ✅ **RESOLVED 2026-07-19: `defense` = DAMAGE
  TAKEN**, per the in-game result-bar legend (red = damage dealt · blue = damage taken · green =
  healing). The three conclusions that leaned on it stand.
- ⚠ **NEW, UNRESOLVED — suspicious ZEROS in `healing`/`defense`.** Some reads look dropped rather than
  true: Dragon 17 (153t) has Pelops `defense` 0 AND `healing` 0 while he survived 153 turns as the Taunt
  champion; Dragon 18 has Pallas `healing` 0 though she posts 270k-561k in every other run; Dragon 19
  has Ezio and Pelops both at `healing` 0. If these are failed reads, over-supply ratios are computed on
  partial data and bias LOW — i.e. real over-supply is WORSE than measured. Not confirmed: Pallas
  shields as well as heals, so a genuine 0 is possible. Check on the next capture.
- Repo is PUBLIC and now PUSHED. Nothing is deployed.
