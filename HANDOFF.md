# Session Handoff — 2026-07-12 (evening)

For a fresh Claude Code instance to resume where we left off. Read alongside `CLAUDE.md`
and the persistent memory files (`~/.claude/projects/.../memory/`, indexed by `MEMORY.md`).
This is a snapshot; **if it disagrees with the code or git, trust the code.** Supersedes the
old 2026-07-06 handoff.

---

## 0. Context for the parallel TAG-REVIEW session

Mike is **reviewing and revising ALL champion tags in a separate session.** The most
important things that session should know from tonight:

- **The feedback loop is now a SOURCE of tag corrections.** Tonight, reconciling one real
  Fire Knight battle surfaced a concrete missing tag (below). Tag review should fold in what
  the loop finds, not just re-read skill text in isolation.
- **CONCRETE FINDING — Fahrakin the Fat is missing the `Ally Attack` tag.** He won Fire
  Knight Stage 12 at a *predicted 5% confidence* despite 2 "unmet" goals; the reason is his
  team-wide ally-attack (his defining skill) is the 10-hits/round **shield-break** mechanic,
  but he carries no `Ally Attack` tag (his tags: Decrease Defense, HP Burn, Increase C.DMG,
  Increase C.Rate, Poison). CLAUDE.md even lists "Ally Attack" as a valid Fire Knight
  shield-break solution — so the goal is satisfiable; Fahrakin just isn't tagged for it.
  **Also check:** should Gnut's `Freeze` / Pelops' `Stun` be tagged **AoE** (Fire Knight
  wave goal 1 wants AoE CC)? Their single-target CC tags left goal 1 "unmet" too.
- **The tag-vs-synergy line we nailed down (Mike's definition):** a **tag** = what one
  champion does ALONE, unconditionally → Fahrakin's ally attack is a TAG. A **synergy** =
  an emergent benefit needing 2+ specific champions together (a conditional ally-attack that
  only fires with a named partner/faction). So during tag review: an **unconditional**
  ally-attack → tag it; a **conditional** one (Glorious Pallas' Argonite ally-attack,
  Donatello's TMNT ally-attack) → do NOT tag, it lives in `lib/synergies.js` instead. See
  [[synergy-model]] and CLAUDE.md tag policy #15.
- **Pallas & Donatello have UNCONDITIONAL missing tags too** (separate from their
  conditional ally-attacks): Glorious Pallas — Revive + Increase Turn Meter; Donatello —
  death-prevention. Those are legit tags to propose.
- Tag rules are canonical in **CLAUDE.md → "Tag Review Policies" (#1–#19)**. Reconcile any
  ruling back to the master worksheet `DB_Champion_Tags` in the SAME session (policy #18).

---

## 1. TL;DR — what tonight was about

Tonight was about **making the match-engine trustworthy and getting its output to the live
app**, plus fixing the battle-capture pipeline that feeds it. Five threads, all landed:

1. **Leader-skill (aura) recommendation** — built + deployed. The app now recommends which
   champion to lead (whose aura to run) AND folds that aura into the stat/threshold checks.
2. **Team-composition synergy layer** (`lib/synergies.js`) — built + deployed.
3. **Level/stars stat scaling** — fixed a ~3.3× over-estimation of under-leveled champs.
4. **Spider's Den scan ceiling** — was hard-capped at Stage 10; now climbs to 20.
5. **Battle reader** — fixed a capture-killing hang, and fixed dungeon **mislabeling**
   (Spider & Fire Knight were logging wrong / unknown).

And the big operational discovery: **the live app had been frozen on stale code for a while**
because Vercel deploys were silently failing (12-function cap). Fixed.

---

## 2. Git / deploy / running state

- Branch `main`, everything committed + pushed. Key commits tonight: leader-aura + synergy +
  level-scaling (`0263f02`), Spider ceiling (`8a86bec`), reader hang (`fb2774b`), Spider
  prefix (`1d2866f`), Fire Knight prefix (`de1bc06`), `.vercelignore` deploy fix (`b954085`).
- **Production = https://rsl-roster-coach.vercel.app** — NOW serving tonight's code (verified
  the live app.js). Deploy via authed Vercel CLI: `vercel --prod --yes` from repo root.
- **⚠️ DEPLOY TRAP (see [[vercel-deploy-cap]]):** the app has **12 serverless functions in
  `api/` — exactly the Vercel Hobby cap.** It WAS 13; deploys silently failed on every push
  (build OK, deploy rejected), freezing prod on old code — this is why Mike's screenshots kept
  showing pre-change behavior. Fixed by `.vercelignore` excluding dead `api/analyse.js`.
  **Adding ANY new `/api/*.js` route re-breaks deploys the same silent way.** ALWAYS verify a
  deploy landed by grepping the live `app.js` (current ≈ 30.3 KB, has `leader-note`; stale was
  ≈ 28.8 KB). SW is network-first, so one PWA reload pulls new assets.
- **Local dev server:** `preview_start` name `rsl-dev` (node server.js, port 3000). It's
  session-scoped and gets torn down between sessions — restart it if localhost won't load.
- **Battle reader** running in background (watch mode), attached to Raid, healthy. Rebuild
  requires stopping it first (locks the DLL): stop → `dotnet build -c Debug` in
  `gestal-sync/RslBattleReader` → restart the exe from `bin/Debug/.../win-x64/`.

---

## 3. THE FEEDBACK LOOP — state + what's outstanding (Mike asked to detail this)

**What Mike expected:** every battle automatically feeds the model and improves it.
**What actually exists:** a **manual** pipeline with a fragile capture step. Two halves:

- **CAPTURE (automatic, when the reader is healthy):** RslBattleReader passively reads the
  game's `battleResults` file + memory → appends to `gestal-sync/RslBattleReader/output/
  battle-log.json` (result, stage, turns, per-hero survival, team). This works now.
- **ANALYSIS (MANUAL — nothing auto-fires it):** `tools/whats-missing.mjs` (+ `--ask` for the
  LLM layer) reconciles captured battles vs the engine's predictions via `lib/battle-gaps.js`
  / `lib/assumption-audit.js` / `lib/gap-review.js`. **No daemon runs this per battle.** So a
  captured battle sits unanalyzed until someone runs the tool. Proven tonight: running it by
  hand on the Fire Knight battle produced the Fahrakin missing-tag finding (§0).

**Three things needed to make it genuinely "every battle" (priority order):**
1. **Auto-trigger analysis on new capture** — a watcher / post-append hook that runs the
   reconciliation + audit whenever a battle lands. THIS is the "loop for every battle" Mike
   wants. Not built.
2. **Fix Spider/Fire Knight stage reconciliation.** `resolveDungeonStage` (match-engine.js
   ~L1116) matches a stage only when its NUMBER appears literally in a `dungeon_stages.label`
   — so "Stages 7-10" resolves 7 and 10 but NOT 8/9/11-20. Spider clears at stage 14/17 don't
   reconcile. Fix = parse "Stages X-Y" ranges (watch: empty orphan numbered rows would shadow
   a range match — prefer content-bearing candidates). See [[spider-den-coverage]].
3. **Reader reliability** — the FAST-poll hang is FIXED (change-detection gate on file
   last-write-time), but the deeper **CB-fingerprint false-positive** is NOT: the Clan Boss
   demon-signature false-matches Spider Stage 17, so when the stageId read is null (racy) a
   Spider run still mislabels "Clan Boss". Tighten the CB signature. See [[rslbattlereader-status]].

**Feedback-loop design principles already established** (don't relitigate — [[engine-feedback-loop]]):
- Two layers: **STRUCTURAL fixes first** (logic/data/tags, human-reviewed), THEN **NUMERIC
  calibration** (`tools/calibrate-engine.mjs`, guardrailed). Calibrating over a structural bug
  bakes it in.
- **DATA-SOURCE BIAS guardrail:** all captured data is from ONE developed account (Don$Gnut).
  The audience is NEW players. A win under-spec (grind) or way over-spec (overpower) does NOT
  generalize — `lib/battle-gaps.js` classifies won-despite-gap by spec margin; only ON-SPEC
  wins imply a missing tag. `won_below_spec_synergy` credits generalizable combos.

---

## 4. What shipped tonight (detail)

- **Leader aura** ([[leader-aura-selection]]): `selectLeader()` in match-engine scores each
  fielded champ's aura for the content (SPD/floored-stat weighted; Clan Boss ≠ Dungeons area);
  `applyLeaderAura()` folds it into `estimated_stats` BEFORE threshold checks (ACC/RES flat;
  SPD/ATK/DEF/HP = %-of-base — added base stats to the mapRoster shape). Attached to all 3
  engine paths + `api/match.js` + rendered in `app.js` (Leader badge + note). Verified: Spider
  leader = Gnut (+80 ACC), which advances the Spider target 6→14 (Ezio 65 base ACC +80 = 145).
- **Synergies** ([[synergy-model]]): `lib/synergies.js` `detectSynergies(team)`; 3 seeded
  combos (2+ Ally Attack, Pallas+Argonite, Donatello+TMNT); surfaced in recs + the below-spec
  guardrail. NOT a DB table yet (code-defined).
- **Level scaling** ([[stat-estimator-accuracy]]): `levelStatScale()` in formulas.js applied
  in estimate-stats.js (hp/atk/def only; SPD/ACC/RES/crit are level-independent).
- **Spider ceiling** ([[spider-den-coverage]]): `SPIDER_SCAN_GROUPS` extended to reuse the
  "Stages 7-10" content across stages 11-20 (ACC floor stage×10 scales). Lands Stage 14 for
  the reference roster. NOT done: a proper 11-20 seed + a RES threshold (the ~300 rule).
- **Reader dungeon labels** ([[rslbattlereader-status]]): added stageId prefixes **2099 =
  Spider's Den**, **2089 = Fire Knight's Castle** (both user-confirmed). Relabeled 8 mislabeled
  Spider + 1 Fire Knight entries in the local log. **Correction to earlier claims:** Mike's
  Spider runs were NEVER lost — they were captured but mislabeled "Clan Boss" (I was wrong
  twice about "lost"; the mislabel hid them).

---

## 5. Outstanding / next steps (prioritized)

1. **Auto-trigger the feedback analysis on capture** (§3 item 1) — the highest-value piece;
   turns clean capture into automatic engine improvement.
2. **Fix `resolveDungeonStage` range matching** (§3 item 2) — unblocks Spider/FK reconciliation.
3. **Propose the Fahrakin `Ally Attack` tag** + audit Gnut/Pelops AoE-CC tagging (feeds Mike's
   tag session). Human-review per no-auto-merge.
4. **Tighten the CB demon-fingerprint** so null-stageId Spider runs can't mislabel (§3 item 3).
5. **Proper Spider 11-20 content seed + RES threshold** (currently reusing 7-10).
6. **Numeric credit for synergies + leader aura in confidence** (calibration-guarded; after
   structural work).
7. **Config-ify VERDICT_BAND_CONFIG / GEAR_TIERS to DB** so `calibrate-engine.mjs` can write them.

**App readiness (Mike asked "is it ready"):** it's a working, deployed prototype — NOT
launch-ready. The blocker is accuracy: stat multipliers are placeholders calibrated on n=1
(a developed account), while the audience is new players; and content skips low stages (1-9)
where beginners live. Ready to *show*, not to *ship*. Launch needs: real-audience calibration
data, low-stage content, and the closed feedback loop.

---

## 6. Key pointers

- Live DB read: `tools/live_db_read.mjs` (REST). Seeds applied via aws-1 pooler (see
  [[supabase-db-access]]). Content changes go through committed `seeds/*.sql` (CLAUDE.md hard rule).
- Roster: `readGestalRoster()` (newest snapshot). Engine entry: `matchRoster(userChampions,
  contentKey, options)` (api/match.js). `evaluateTeam(team, dungeon, stage, difficulty)` for
  reconciliation.
- Memory index: `MEMORY.md`. Most relevant tonight: [[engine-feedback-loop]],
  [[rslbattlereader-status]], [[spider-den-coverage]], [[leader-aura-selection]],
  [[synergy-model]], [[vercel-deploy-cap]], [[stat-estimator-accuracy]], [[goal-solution-skeleton-fix]].
