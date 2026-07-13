# Session Handoff — 2026-07-13

For a fresh Claude Code instance to resume cold. Read alongside `CLAUDE.md` (project rules —
these OVERRIDE defaults) and the persistent memory index (`~/.claude/projects/.../memory/MEMORY.md`).
**Snapshot only — if it disagrees with the code or git, trust the code.** Supersedes the
2026-07-12 handoff.

---

## 1. TL;DR — what this era was about

Built out **dungeon content** so the match engine has real requirements to match against.
**All four core dungeons now have the full Normal 1-25 ladder — built, reviewed, approved, live:**

| Dungeon | Stages | Approved sols | Model | Seeds |
|---|---|---|---|---|
| Fire Knight | 1-25 | 326 | shield 10-hits/round | 112, 120, 121 |
| Spider's Den | 3 tiers (1-14 / 15-20 / 21-25) | 33 | Poison/debuff spread | 117, 118, 119 |
| Ice Golem | 1-25 | 169 | Frigid Vengeance / DoT (don't burst) | 122, 123, 124 |
| Dragon's Lair | 1-25 | 386 | Inhale→Scorch purple-bar | 125, 126 |

- **973 approved solutions, 0 proposed, 4 rejected** — staging is empty, nothing pending review.
- All four **auto-scan for the best clearable stage** (no stage picker) via `scanDungeonStages`
  / `scanSpiderStages` in `lib/match-engine.js`. Engine stage range max = 25.
- Each dungeon was built from an AyumiLove doc (Mike), mirrored to the existing 10-20 model,
  seeded `proposed`, reviewed via a **pasteable Markdown packet** for a virtual/AI reviewer
  (`*_REVIEW.md`), then flipped to approved in a go-live seed.

Process discovery this era: **FK & IG 10-20 base content was ORPHANED** (live in DB, no
committed seed) — a reconstructability bug. Fixed via auto-generated idempotent seed 123
(delete/recreate faithfulness tested). Dragon 10-20 was fine (seeds 32-39).

---

## 2. Git / deploy / running state

- Branch `main`, everything committed + pushed. Latest commit `2b791b6` (Ice Golem + Dragon batch).
  **Seeds committed through 126.**
- **Production = https://rsl-roster-coach.vercel.app** — serving current build (HTTP 200 verified).
  Deploy via authed CLI: `vercel --prod --yes` from repo root.
- **⚠️ DEPLOY TRAP ([[vercel-deploy-cap]]):** `api/` is AT the Vercel Hobby **12-function cap**.
  `.vercelignore` excludes dead `api/analyse.js`. **Adding ANY new `/api/*` route silently
  re-breaks deploys** (build OK, deploy rejected, prod freezes on old code). This era's batch
  added no api routes. Always verify a deploy landed (curl prod / grep live app.js).
- **Local dev:** `preview_start` name `rsl-dev` (node server.js, port 3000) — session-scoped,
  restart if localhost won't load.
- **Battle reader** (RslBattleReader): passive watch mode, attached to Raid. Rebuild requires
  stopping it first (locks the DLL).

---

## 3. What's NOT done — candidate next work (prioritized, none yet requested)

**Dungeon content:**
1. **Hard mode** for all four dungeons (Tainted bosses) — not built. Natural next content push.
2. **Doom Tower** — 24 floor stubs seeded, **zero goals/solutions/thresholds**. Needs boss kits
   + content (120 floors / 12 boss floors / rotation bosses — [[doom-tower-modeling]]).

**Engine trustworthiness / feedback loop (carried forward from prior handoff, still open):**
3. **Auto-trigger feedback analysis on capture** — highest-value piece. Today `tools/whats-missing.mjs`
   (`--ask` for LLM layer) reconciles captured battles vs predictions MANUALLY; no daemon runs it
   per battle. A watcher/post-append hook would make it "every battle." [[engine-feedback-loop]]
4. **Fix `resolveDungeonStage` range matching** (match-engine.js) — matches a stage only when its
   NUMBER appears literally in a `dungeon_stages.label`, so "Stages 7-10" resolves 7/10 but not
   8/9/11-20. Blocks Spider/FK battle reconciliation. Parse "Stages X-Y" ranges (prefer
   content-bearing candidates over empty orphan numbered rows). [[spider-den-coverage]]
5. **Propose Fahrakin the Fat `Ally Attack` tag** — he won FK Stage 12 at predicted 5% because his
   defining team-wide ally-attack (the shield-break mechanic) is UNTAGGED. Also audit whether
   Gnut's Freeze / Pelops' Stun should be AoE-tagged. Human-review per no-auto-merge; reconcile to
   worksheet `DB_Champion_Tags` same session (policy #18). See [[tag-review-queue-2026-07-13]].
6. **Tighten the CB demon-fingerprint** — false-matches Spider Stage 17; a null-stageId Spider run
   mislabels "Clan Boss". [[rslbattlereader-status]]

**Calibration / data quality:**
7. **All dungeon stat floors are CALIBRATION-NEEDED placeholders** (source docs' stat tables are
   images). Recalibrate against real battle-outcome data once it accumulates. Captured data so far
   is n=1 from ONE young account (Don$Gnut) — does NOT generalize to the new-player audience.
8. **~82 stat/constraint goals** mis-modeled as tag-coverage — need a non-tag mechanism
   ([[goal-solution-skeleton-fix]]). **~78 Rare+ champs have no skill text** (capture gap).
9. **explanation_style_notes is not yet read by any code** — explain.js must pull + apply these
   before the many notes we've written (Scorch all-or-nothing, ACC-vs-RES, IG stage-tone, etc.)
   have any effect. Wiring this unlocks a lot of already-authored value.

---

## 4. Hard rules that bit us before (do not relearn the hard way)

- **All content changes go through committed `seeds/*.sql`** — never write content rows directly to
  live DB, not even a quick fix. DB must be reconstructable from seeds (orphan bug above).
- **No auto-merge:** new content lands `status='proposed'`; engine reads only `approved`; a human/
  virtual reviewer approves → flip in a go-live seed.
- **Never scrape YouTube.** Factual game data hand-read from AyumiLove/HellHades is OK
  (`source_type='human_observation'`); their editorial content (tier lists, strategies) is not.
- **Battle reader = passive read only.** No function hooking / injection (anti-cheat signature).
- **Commit/push/deploy only when the user asks.**
- **Reasoning discipline (CLAUDE.md has all 4 rules):** label claims observed / inherited /
  inferred; verify load-bearing facts before building on them (recalled memory can be stale); no
  "that's the answer" on one data point; a single battle can change a champion's kit-tag at most,
  never a model rule (needs ON-SPEC win + computed margin + corroboration). Origin: "Don$Gnut is a
  developed account" was stated as fact, was false (young: 120 heroes, 3 lvl-60, 0 ascensions),
  and skewed a reconciliation.

---

## 5. How to touch the DB / key tooling

- **Apply a seed:** `node tools/apply-seed-pooler.mjs seeds/NNN_name.sql` (writes via aws-1 pooler,
  `SUPABASE_POOLER_URL` in `.env.local`). This is the write path — NOT apply-seeds.js.
- **Validate before applying:** run the seed in a `begin`/`rollback` tx, check rowcounts (write a
  throwaway `tools/_validate_seed.mjs`, run, delete — pattern used all era).
- **Read live:** `tools/live_db_read.mjs` (REST), or a quick `pg.Client` with `SUPABASE_POOLER_URL`.
  Direct host is IPv6-only and fails — always use the pooler. [[supabase-db-access]]
- **Content coverage check** SQL is in CLAUDE.md — run before assuming any dungeon is complete.
- Live champion NAMES can differ from worksheet names — resolve via `champion_aliases`, not exact name.
- Guard: number-range scoping on `dungeon_stages` also matches battle-capture orphan stubs
  ("Hard Stage 4/8") that carry a stage_number — add `ds.label like 'Stage %'` when scoping
  Normal-stage inserts by stage_number. (goals/sols/thresholds are safe — they join `phases`,
  which only Normal stages have.)

---

## 6. Data model quick ref

`dungeons` → `dungeon_stages` (label "Stage N") → `phases` (wave/boss/single) → `goals`
(is_informational flag) → `goal_solutions` (status) → `goal_solution_tags` (AND-of-tags; goal met
if ANY solution's tags all present). Plus `stat_threshold_checks` (formula strings; `evalFormula`
supports bare constant, `stage*N`, `stage*N+M`), `boss_exceptions` (free text),
`explanation_style_notes` (topic + note; not yet wired — item 3.9).

Match engine is deterministic (no LLM). `notReady` = did any stage clear ≥80% confidence;
`verdict` (ready/borderline/not_ready) = goal-coverage completeness. `VERDICT_BAND_CONFIG.
confidenceThreshold = 80` (placeholder). Solo-carry check runs before team recommendation.

Recommend for **AUTO-BATTLE judged by TIME not turns** (~99% of audience runs on auto);
`manualSkillUsed=false` = auto; auto losses mean "doesn't work for the audience".

---

## 7. Memory pointers (most relevant)

Full index: `MEMORY.md`. This era's: [[dragon-full-range-2026-07-13]],
[[ice-golem-full-range-2026-07-13]], [[fire-knight-full-range-2026-07-13]],
[[tag-review-queue-2026-07-13]]. Standing: [[engine-feedback-loop]], [[spider-den-coverage]],
[[vercel-deploy-cap]], [[rslbattlereader-status]], [[goal-solution-skeleton-fix]],
[[supabase-db-access]], [[doom-tower-modeling]], [[synergy-model]], [[leader-aura-selection]].
