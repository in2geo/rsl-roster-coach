# The Team-Building Model — how the app beats content (READ FIRST)

**This is THE product model** — how the app decides which team from a roster clears a piece of
content, and what to build when it can't. Mike's articulation, built and validated live 2026-07-16.
It **supersedes the earlier power/brute-force framing** as the primary approach (that power model is
now just the *survival half* of one problem). Detail + evidence: `insights-ledger.md` INS-0026…0029;
code in `lib/dungeon-mechanics.js`, `lib/team-assembler.js`, `data/keyword-glossary.json`.

## The one line

> Read the content's mechanical **PROBLEMS** → know what each champ's abilities actually **DO** in that
> fight → fill five **ROLE-SEATS** (each built for its job) → run on **AUTO**, judged by **TIME** → let the
> **RESULT** diagnose the weak seat → **RE-SOLVE** it without breaking the roles that already worked.
> Per account, per content.

## The eight principles

**1. Content is a set of PROBLEMS, not a difficulty number.** Every dungeon/boss stops you in specific,
mechanical ways. Fire Knight: break a shield with enough *hits* each turn, survive/deny his AoE-nuke turn,
clear 2 waves first. Ice Golem: don't trigger Frigid Vengeance (it punishes big direct hits → race it with
DoT), stop the reviving minions, outlast. Spider: control the snowballing spiderlings, then kill Skavag.
Clan Boss: a damage race gated behind the debuff kit **and** the Warmaster/Giant Slayer masteries. You beat
content by solving *its* problems — so step one is knowing what they are.

**2. There is never ONE right team — there are many.** THE most important principle. Each problem has a
wide-open solution set. "Break the Fire Knight shield" isn't "own these 3 champs" — it's *anything that
lands enough hits*: multi-hit A1s, multi-hit AoE, Counterattack, Reflect, Ally-Attack. Dozens of a roster's
champions qualify. No human remembers which of their 300 champs fills which role — the app does. **NEVER gate
a dungeon on a fixed/canonical comp.** (INS-0027; `lib/dungeon-mechanics.js` = problems × open ability-sets.)

**3. A champion is a bundle of ABILITIES, and each ability's value is CONTENT-CONDITIONAL.** The same skill
is a hero in one fight and dead weight in another. Poison shreds Ice Golem but can't break Fire Knight's
shield (it *does* damage Fyro once the shield is down). Decrease DEF multiplies an attack team and is
worthless to a poison team (DEF shred only boosts ATTACK damage — `lib/damage-mechanics.js` §1). Provoke is
great on adds and useless on a solo CC-immune boss. **You cannot team-build off tags alone** — tags are a
lossy index; the real reasoning needs the *skill text* (`champion_skills.skill_summary`) + what each keyword
actually does (`data/keyword-glossary.json`, the semantic layer, INS-0028).

**4. Fill FIVE SEATS by role — primary job first, extras are gravy.** A team is five seats. Assign each a
PRIMARY role the content demands (break shield / lock the boss's turn / keep the team alive / clear the waves
/ deal damage) and pick the best champ for that job. Multi-role champs are efficient — a multi-hitter that
also drops Turn Meter covers *break-shield AND lock* in one seat, freeing a seat for luxury. Goal: every
required role covered. (`lib/team-assembler.js` `assembleTeam`.)

**5. The BUILD decides it — champions aren't plug-and-play.** A capability says a champ *can* do something;
gear/stats decide whether they *will*. Need **Accuracy** to land your debuffs (scales ~with stage) and
**Resistance** to shrug off the boss's — two different jobs, never conflate. Even a "cheat-code" champ has
activation conditions: Coldheart hard-locks Fire Knight *only* booked + geared to survive; Alure *only* at
~100% crit; Clan Boss needs Warmaster/Giant Slayer on five. Build each champ *for* its role (a protector
wants DEF/HP; crit is wasted on them). Floors aren't hard gates — below a stat floor you still win, just
*slowly* (grind); the real floor is "clears within the TIME budget" ([[floors-are-not-gates]]).

**6. Build for AUTO, judged by TIME.** ~99% of the audience farms on auto, so the team must work when the AI
fires skills off-cooldown in slot order — a combo needing manual timing is not a real solution. "Beating"
content = clearing inside a sane wall-clock budget (~5 min), not a turn count. An auto loss ≈ "doesn't work
for the audience."

**7. It's a LOOP — the battle tells you what's missing.** The team is a hypothesis; the fight is the test.
The result points at the seat that failed: died in the waves → your wave-clearer; shield never dropped → not
enough hits; boss got a turn and nuked you → your lock or your sustain; won but too slow → your damage; a
champ died first → that seat. Then the hard part: reinforce that ONE seat **without dropping the roles that
already worked** — a constrained swap. Iterate. (`lib/team-assembler.js` `diagnoseShortRole` + `fixTeam`;
capture = RslBattleReader → `battle-log.json`, now trustworthy on identity + survival + per-hero damage.)

**8. It's PER-ACCOUNT.** A deep roster covers every role a dozen ways → it re-solves *fluidly* (swap freely).
A newer roster often *can't* reinforce the weak seat without dropping another → that's not "you're too weak,"
it's a specific **build gap**: "acquire/build a champ that does X." And the right team is usually **NOT your
five most-developed champs** — it's the five that cover the roles. A Rare that solves a mechanic beats a
maxed Legendary that doesn't. (This is the app's edge over a strong player fielding their biggest numbers.)

## The layers, and where each lives

| Layer | What | Where |
|---|---|---|
| Mechanical-problem model | each content = problems × open ability-sets | `lib/dungeon-mechanics.js` (INS-0027) |
| Semantic layer | what each `[keyword]` ability actually DOES | `data/keyword-glossary.json` (INS-0028) |
| Champion abilities | tags = lossy index; skill text = full truth | `champion_tags` + `champion_skills.skill_summary` |
| Team assembler + the loop | 5-seat role selection; diagnose + constrained fix | `lib/team-assembler.js`, `tools/assemble-team.mjs` (INS-0029) |
| Capture (the loop's test) | identity + survival + per-hero damage from real battles | RslBattleReader → `gestal-sync/RslBattleReader/output/battle-log.json` |
| Game-fact rules | DEF-shred/DoT interactions, sustain multiplicative | `lib/damage-mechanics.js` |

## What this supersedes

The older "predict a stat/power ceiling" framing (`POWER_LAYER_SCOPE.md`, the calibrated kill/survival
evaluator) is **not** the product. Brute force is just where a roster stops *before* mechanics take over —
and it moves per account (a new account brute-forces far less than a developed one). The product question is:
**does this roster SOLVE the content's mechanics, which team, and if not, what to build.**
