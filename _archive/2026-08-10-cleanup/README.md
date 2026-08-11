# Cleanup archive — 2026-08-10

Files moved out of the active tree during the "safe cleanup" pass. **Nothing is deleted** —
each file is preserved here and in git history. To restore any file, move it back to the
path shown below (e.g. `git mv _archive/2026-08-10-cleanup/tools/<file> tools/<file>`).

This pass was the low-risk subset only. NOT touched (deliberately): `lib/power-model.js`
(owner deferred), `tools/tag-agent.js` (has an `npm run tag-agent` script), and
`tools/sim-spider-replay-export.mjs` (possible keeper for the visual replay).

## Dead web endpoints (removed to get under Vercel's 12-function cap: 13 -> 11)
- `api/waitlist.js` — orphaned; nothing in the app referenced `/api/waitlist`.
- `api/parse.js` — retired screenshot-to-roster (vision) endpoint. Manual selection replaced it;
  the upload screen is never shown. (See CLAUDE.md: "Vision-based roster parsing is dropped.")
- `lib/parse-roster.js` — the vision helper; was imported ONLY by `api/parse.js`.

## Spider-13 forensic diagnostics (20 one-off bug-hunt scripts, tools/)
sim-spider-a1-aoe, -bambus-casts, -bambus-mitigation, -bambus-picks, -bambus-shieldtrace,
-boss-attribution, -burn-ab, -control-scorecard, -cycle, -fate, -hp-table, -hp-trace,
-opening, -poison-sweep, -protection-lifecycle, -seed-run, -targeting, -taunt, -tmrace, -turnorder.
(Single-run investigation scripts from the late-July Spider fidelity push; not reusable tools.)

## Portrait image tooling (5 scripts, tools/ — finished, run-once)
check-images.js, recover-portraits.js, rehash-portraits.js, upload-portrait.js, verify-hash.js.

## Stale one-off orphans (4 scripts, tools/ — zero references, June/early-July)
diff-gear.mjs, diff-roster.mjs (one-time reader-validation harnesses),
extract-skill-text.mjs (self-labeled "SPIKE / RESEARCH TOOL"),
split-sql.js (generic one-off SQL chunker).

## Still OPEN (needs an owner decision before more can be archived)
1. "Has the Simulator fully replaced the old power model?" -> unlocks ~25 more tool scripts
   (battle-suite / shadow-* / calibrate-*) plus lib/power-model.js.
2. "Which team-builder is the real plan?" -> team-constructor.js vs team-assembler.js
   (plus the archetype selector) — pick one, cut the others.
