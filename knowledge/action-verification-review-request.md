# Review request: a "turn-by-turn action verification" idea for a battle simulator — please punch holes in it

*Written 2026-07-23 for an outside second opinion. We built the thing below, we're suspicious of it, and
we want it attacked. Read it cold — no prior context needed.*

## Context

We have a simulator that reimplements a turn-based RPG's combat (Raid: Shadow Legends). We use it to
predict whether a player's team will clear a given piece of content. To trust it, we validate it against
real battles we screen-record.

## The idea we built

In a turn-based game there's a useful split:

- **Results** (how much damage a hit does) vary run-to-run from RNG — crits, damage variance,
  chance-based debuffs.
- **Actions** (which champion acts, which skill they use, which enemy they target) are *determined by
  fixed game mechanics*: turn order = speed; skill choice = the game's AI priority rules; target = the
  targeting rules. No randomness — "it is what it is."

So we built an **action oracle**: encode the game's action rules independently of the sim, run the sim
deterministically, and at each turn compare the sim's chosen action to the rule-derived *expected*
action. It stops at the first mismatch and gives a resolution checklist (is the **sim** wrong, or is our
encoded **rule** wrong?). On the first run it caught a real bug (enemy mobs used the wrong skill-selection
logic); after we fixed it, the tool reported **"108/108 actions match the rules."** That green light is
exactly what we're suspicious of.

## Our two misgivings — please pressure-test these and find more

1. **Circularity — how do we know the rules are right?** "108/108 match" only proves the sim matches the
   rule *we encoded*. If our rule is wrong, the sim matching a wrong rule still shows green — a false pass.
   We've validated only a handful of rules against authoritative sources (game docs); the rest —
   especially *enemy* AI behavior — are our assumptions. (The "fix" above applied an AI-priority rule
   documented for a *player* champion to *enemy* mobs, without confirming enemy AI works the same way.)

2. **Completeness — blind to omissions.** The check is driven by the *sim's* action stream, so it only
   grades actions that *happened*. It's structurally blind to actions that *should* happen but don't
   (e.g. a passive that should trigger and never fires). And those missing actions are exactly our known
   weak spot — the mechanics that keep the team alive. The sim can do everything it does correctly and
   still be missing half of what should occur, and the check stays green.

Both holes point to the same escape hatch: the **real recorded battle is the only ground truth** for
*whether the rules are right* and *whether all actions are present*. But recording + hand-decoding battles
action-by-action is slow, manual, and you need many runs to capture the RNG variance.

## What we want from you

- **How would you validate this — both that the expected-action rules are correct AND that no expected
  actions are missing — *without* relying on recording and hand-decoding real battles?** What oracles,
  cross-checks, or testing strategies would give confidence? Assume we have: the game's published skill
  descriptions, the ability to run the sim unlimited times, and general knowledge of the documented
  mechanics — but limited appetite for transcribing videos.
- **Attack the core premise itself:** "actions are deterministic, so verify them separately from results."
  Where does it break down? (e.g. actions that depend on RNG'd *state* — targeting "lowest-HP%" when who
  is lowest depends on prior random damage; speed ties; conditional branches gated on chance-based
  effects landing.)

Give us the strongest case for why this approach is insufficient or self-deceiving, and what you'd do
instead.

## Reference: current state of the code (for anyone who wants to look)

- Sim engine: `lib/sim/engine.js` (turn loop, skill resolution, AI selection).
- The action oracle: `tools/sim-actions.mjs` (encodes the rules, runs the sim, compares per turn).
- Human battle reviews (ground truth today): `test/reviews/*` ; machine fixtures: `test/golden/*.json`.
- Per-turn inspection tool: `TURNLOG=lo-hi node --env-file=.env.local tools/sim-trace.mjs`.
- The broader QA harness (spec / invariants / sensitivity / mutation / snapshot / reality-oracle):
  `tools/sim-qa.mjs`, and `knowledge/HANDOFF_2026-07-23_wave-engine-and-survival.md` for the full state.
