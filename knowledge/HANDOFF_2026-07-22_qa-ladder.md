# Session Handoff — 2026-07-22 (PM): the QA ladder, and the discipline that governs it

**COLD-START DOC. Read this first**, then the ⭐⭐ memories at the top of `MEMORY.md`
(test-like-deep-blue, video-ground-truth, dragon-purple-bar, trusted-mob-lists-parked). This
**supersedes `HANDOFF_2026-07-22_turn-loop.md`** as the current front (that AM session built the turn
simulator; this PM session built the **QA TOOL** for it).

**All work is on branch `session/turn-loop-2026-07-22`, PUSHED to origin, ~17 commits, NOT merged, no
PR opened. The DB is UNTOUCHED — the migration + seeds 205/206 are files only.**

---

## ⏩ START HERE

1. **Run the QA tool:** `node --env-file=.env.local tools/sim-qa.mjs`
   One scorecard + a classified defect ledger. Current verdict: **SPEC-CONFORMANT** (52 spec + 8884
   invariant + 8 sensitivity checks pass), sim **INCOMPLETE** (recorded, not blocking).
2. **The individual rungs** (each runs standalone and emits a `QA_JSON` line the orchestrator reads):
   `tools/sim-validate-data.mjs` (rung 1, data, needs DB) · `tools/sim-selftest.mjs` (rung 2, spec,
   no DB) · `tools/sim-invariants.mjs` (rung 5, property-based, no DB) · `tools/sim-sensitivity.mjs`
   (rung 6, no DB).
3. **The simulator** (do NOT confuse with the QA tool): `lib/sim/{engine,ai,dragon}.js`; replay =
   `tools/sim-dragon.mjs` (gate 2, `--stage N --trace`, `SIM_WAVES=1` for the wave pilot).

---

## 1. THE HEADLINE — the deliverable is the QA TOOL, not a finished simulator

Mike's correction, mid-session and load-bearing: *"you aren't supposed to be chasing anything. you are
supposed to be building a QA tool for the simulator. How can we test an incomplete simulator?"* I had
drifted into **fixing the sim** (purple bar, Ezio's coeffs, waves). That is a different workstream.

**The answer to "how do you test an incomplete simulator":** test it against **its own spec** (always
possible, regardless of completeness), and against reality **only at the levels it's complete enough to
attempt** — labelling everything else. Completeness is the tool's OUTPUT, not a blocker. A rung is a
test HARNESS, not a passing result: the sim failing a rung is a FINDING, not a reason to stop building.

**THE DISCIPLINE (Mike-agreed) — findings sort into four buckets; ONLY bucket 1 blocks:**
| bucket | what | blocks? |
|---|---|---|
| 1 spec_violation | sim disagrees with its OWN design (rung 2/5/6 fail) | **YES** — fix before any reality comparison |
| 2 unimplemented | a mechanic we know is missing/stubbed | no — sim backlog |
| 3 missing_data | inputs absent/estimated (coeffs, mob lists, waves) | no — sourcing backlog |
| 4 reality_gap | a scoring LEVEL the sim can't yet attempt (clear-rate, run-time) | no — labelled "not scored" |

**So: do NOT reactively fix the sim when QA finds an issue.** Log it (the tool already does) and keep
climbing the ladder. Fixing the sim is a separate, deliberately-prioritised activity.

---

## 2. THE QA LADDER (Simulator QA Protocol.docx = the spec, now committed)

| rung | file | status |
|---|---|---|
| 1 data validator | `sim-validate-data.mjs` | ✅ |
| 2 spec self-test (52) | `sim-selftest.mjs` | ✅ |
| 4 golden battles | `sim-golden.mjs` | ✅ first fixture COMPLETE + RUNNABLE |
| 5 invariants (8884, property-based) | `sim-invariants.mjs` | ✅ |
| 6 sensitivity (8 + carve-outs) | `sim-sensitivity.mjs` | ✅ |
| **orchestrator + 4-bucket ledger** | `sim-qa.mjs` | ✅ |
| 3 toy encounters | (in selftest, Dragon-only) | 🟡 FK/Spider need content modules |
| 7/8 reality scoring at supported levels | declared in sim-qa, not wired | 🟡 |

**⚙ THE TEETH DISCIPLINE — validate the QA model itself.** A rung that cannot fail is worthless. Feed
each a KNOWN-BAD and a KNOWN-GOOD and confirm it discriminates. This caught TWO real problems this
session: the purple-bar drain test failed-then-passed (had teeth), and the rung-5 **speed invariant was
VACUOUS** (a multiline regex counted nothing → 0≥0 passed empty). Every metamorphic test now carries a
non-vacuous guard (`baseline > 0` etc.). Rung 6 encodes GAME FACTS as machine-checked carve-outs — e.g.
**DEF cuts ATTACK damage (9000→4000) but does NOTHING to POISON (2000→2000)**; a naive sensitivity
table would assert a direction the game doesn't have.

**GOLDEN BATTLES (rung 4) — a recording + note session = a fixture.** `test/golden/*.json` holds
hand-verified real fights: exact INPUTS (per-champion builds) + exact OUTPUT (result, per-hero totals,
turn-by-turn timeline w/ confidence). `sim-golden.mjs` validates each fixture's consistency and reports
readiness (RUNNABLE vs PENDING-INPUTS). **The first fixture (`dragon16-donbambus-2026-07-22`) is COMPLETE
+ RUNNABLE** — all 5 exact builds captured from Mike's screenshots (`data/observed-builds/`). The BUILDS
themselves red-penned the model: **Pelops runs LIFESTEAL gear** (app assumes nobody does) and **Vergis
is DEF-scaling** (sim reads his multiplier as ATK) — both discarded/mis-read, both feeding "survival is
the gap." **Video → builds capability:** `imageio-ffmpeg` frames → read the build screens for exact
effective stats (also validates `estimate-stats.js`).

**⭐ TOP NEXT ITEM — close rung 4's loop:** wire the EXACT-STAT RUN into `sim-golden.mjs` — run the sim
on the 5 real builds and score outcome + failure-location vs the golden. Prediction: still fails on
SURVIVAL, now with NO estimation excuse (the real builds are tanky: Bambus 25.7k HP, Pelops 28.5k +
Lifesteal, Tagoar 24.3k + heals). Then wire rung 7/8 (score SUPPORTED reality levels into the
orchestrator). Rung 3 waits on FK/Spider.

---

## 3. THE DOMINANT FINDING — survival, not offense (from a REAL battle video)

Mike screen-recorded a real Dragon-16 clear; I extracted frames (`imageio-ffmpeg`) and read the victory
screen. **This is the biggest steer of the session:**
- Real result: **VICTORY, 150 turns, ALL 5 ALIVE** through both waves to the boss — a POISON/DoT grind
  on massive sustain (Tagoar healed ~92k, Pelops ~45k). The sim (`SIM_WAVES=1`) **WIPES this team on
  wave 1 by turn ~8.** ⇒ **SURVIVAL is the bigger sim error, not offense.**
- **Ezio took ~3,509 damage ALL FIGHT** — his passive keeps him under **[Perfect Veil] (untargetable)**;
  the sim ignores veil-targeting and one-shots him. Bucket-2 mechanic to model in `chooseEnemyTarget`.
- Per-hero damage ground truth: **Bambus ~506k (TOP — and has NO coeff in our data)**, Ezio ~333k,
  Pelops ~259k. Damage is DoT over 150 turns → only works because the team survives.

**Video recordings are now a ground-truth source you can produce on demand** — see
`[[video-recordings-are-ground-truth-2026-07-22]]`. This is rung-4/7-8 fuel and gives the healing/taken
fields the reader only has on ~5 captures.

---

## 4. THE PARKED PROBLEM — trusted data (bigger than it looks)

**Three UI-INVISIBLE data gaps share ONE solution.** Wave-mob composition, enemy stats, AND skill
damage multipliers are all NOT shown in-game, all datamined by community sites (which DRIFT — `seeds/205`
had stage 16 as Spirit; ground truth is Void), and all solved by **Route A: datamine the local game
files** (IL2CPP/asset bundles the reader already dumps — passive, in-bounds). **KEY UNKNOWN to resolve
first: does the composition/multiplier definition live in local files, or only in-battle memory?** grep
the `dump.cs`. Route B (passive reader capture during battle) is the fallback but is blind on frontier
stages you can't clear. See `[[trusted-mob-lists-unresolved-2026-07-22]]`.

**STATS ARE SOLVED (don't re-litigate):** enemy SPD == champion base SPD (exact, free); CR/CD flat
15/50; HP/ATK/DEF = base × level/star curve (~3.2× at L200/6★); RES/ACC are encounter params (Dragon
mobs 100/100, NOT == boss 150/150 — the Spider/IG "mob==boss" rule does NOT extend to Dragon). Boss
stats verified 8/8 exact at st16 → the boss table is transcribed, not synthetic.

---

## 5. SIM CHANGES MADE THIS SESSION (recorded as data/findings, mostly gated OFF)

- **Purple bar = 20% of Hellrazor MaxHP**, flat all Normal+Hard (Mike+Fandom). Wired
  `purpleBarHp = 0.20*boss.maxHp`. 21-25 + all Hard cap %MaxHP skills at 10%/hit (unimplemented).
- **Fixed the 5th "represented but not consumed":** engine never called `onDamageToBoss` (bar never
  drained). Gate-1 test #13.
- **Wave pilot** (`SIM_WAVES=1`, st16 Void waves, real stats): generic `actEnemyMob` in engine. WIPES
  on wave 1 because 4/5 champs have no coeff — same gap as the boss bar, on offense. Gated OFF so it
  doesn't drag the headline.
- **Ezio coeffs — seed 206** (A1 3.8 / A2 3.7 / A3 4.7 ATK; in-game card rounds up to 4/4/5). **NOT
  APPLIED** to the DB; sim reflects it via a `PENDING_MULT` overlay in `sim-dragon.mjs` (delete on apply).
- ⚠ Two damage bugs found, NOT fixed (bucket 2): the sim ignores `multiplier_type` (Vergis A1 is
  DEF-scaling, read as ATK), and Decrease DEF is applied but never consumed in the damage calc.

---

## 6. METHOD THAT WORKED / STATE

- **Build the QA rung, then TEETH-CHECK it** (known-bad fails, known-good passes) before trusting it.
- **Ground truth (Mike's screenshots + video) red-pens the model; mining drifts.** Every mined value
  we checked this session was wrong or imprecise (seed-205 composition; beta multipliers).
- **Commit small + often; keep the DB untouched; only spec violations justify touching the sim.**
- **Env:** `.env.local` present; sim-dragon/validator read the live DB via REST. `imageio-ffmpeg`
  installed for video frames. Worksheet (multipliers/skills) = `RAID Master Database v4.0 MASTER …
  .xlsx` in the RSL-coach ROOT (openpyxl read-only; 38% of skills carry a multiplier).

**RECOMMENDED NEXT:** keep climbing the ladder (rung 4 golden battles from the video, or wire rung 7/8),
and work the classified backlog **deliberately** — starting with what the video flagged as the dominant
error: **survival** (Perfect-Veil-untargetable + why the sim kills a team reality keeps alive). Don't
chase; log, prioritise, then fix.
