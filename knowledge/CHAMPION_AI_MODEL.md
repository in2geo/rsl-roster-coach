# Champion AI model — how the sim picks which skill a champion uses

**This is the WHICH-SKILL rule of Phase I (Action) of the Action Verification Model
(`knowledge/ACTION_VERIFICATION_MODEL.md`).** Canonical spec for auto-battle skill selection. The split (Mike, 2026-07-23): the **well-established
behaviours are RULES**; the **community-sourced per-champion claims are a CONFIRM QUEUE** — never applied
to the sim until a real battle backs them. Rules predict; reality confirms.

Source for the rules + the queue: `Raid AI info.docx` (an AI-compiled summary of community knowledge —
Reddit / YouTube / HellHades — **not first-party**), cross-checked against our own recordings.

## The default rule

**Highest available slot first: A4 → A3 → A2 → A1**, skipping any skill on cooldown (A1 is the last
resort). Passives fire automatically on their trigger, independent of the active-skill turn. This is the
original `pickSkill` behaviour — the "AoE-preference" experiment (2026-07-23) was WRONG and is reverted;
what looked like a universal "prefer AoE" rule is actually a per-champion exception (Ezio, below).

## Role-based override RULES (apply by champion role — these are adopted rules)

| # | rule | status in the sim |
|---|---|---|
| 1 | **Healer / Cleanser HOLD** — hold the heal/cleanse until an ally drops below ~75% HP (single) / ~60% (AoE), or there's a debuff/CC to clear; then it jumps to priority 1 | **MODELLED** (`ai.canUseSkill` heal-hoard: `HOARD_SINGLE=0.75`, `HOARD_AOE=0.60`) |
| 2 | **Reviver WAIT + slot target** — a revive never fires unless an ally is dead; a single-target revive picks by team slot (Leader → 2 → 3 → 4) | revive-lock **MODELLED**; slot-based single-target revive **TODO** (engine currently revives all dead) |
| 3 | **Buff / Shield placer TURN-1** — a champion whose job is defensive buffs/shields puts them up on turn 1, even if that's an A2 over an A3 | **TODO** (new rule) |
| 4 | **"Can I kill it?" finisher** — skip a big AoE to execute a low-HP target with A1, saving the long cooldown | **TODO** (lower priority) |
| 5 | **Mythical form-changer** — refuses Metamorphosis on auto; stays in base form, never transforms unless manually forced | **CONFIRMED (Mike, from experience).** A real rule. Not exercised yet (no Mythical in the current fixture); when a Mythical is on a team, model it as: on auto, use only the BASE form's kit — never the alternate-form skills. |

## Player custom-AI model (represent later)

The game lets players override per champion: **Opener** (forced first action), **Priority 1** (use every
time off cd), **Priority 2** (fallback), **Don't Use** (banned on auto). Represent as per-champion
`skillOrder` + a banned-slots set. Not yet implemented beyond `skillOrder`.

## CONFIRMED per-champion exceptions (validated against a real battle — the sim applies these)

- **Ezio Auditore** — opens **A2 (Da Vinci's Design, AoE)** before A3, order **A2 → A3 → A1**. Mechanism:
  his passive puts up [Perfect Veil] at round start, making his A2 debuffs (Poison / Poison Sensitivity)
  unresistable, and the AI opens the AoE in that window. **CONFIRMED 2026-07-23** (our Dragon-16 recording
  + the Plarium-AI writeup). This is the ONLY confirmed exception so far.

## FOLLOW-UP QUEUE — SUSPECTED, UNCONFIRMED (do NOT apply to the sim until confirmed)

Community-sourced (the doc above); status `suspected` until a recording or first-party source confirms it.
The action-oracle flags divergences → confirm each → promote to a CONFIRMED exception or a new category.

- **Turn-1 wasters:** Prince Kymar (A3 cooldown-reset on t1), Pain Keeper, Renegade, Zavia / Elenaril
  (poison-explosion before poisons exist), Lydia the Deathsiren.
- **Conditional blockers:** Royal Guard (A3 only if [Decrease DEF] on target), Coldheart (skips Heartseeker
  if FK shield up), Armanz (refuses A2/A3 vs Stoneskin), Sir Nicholas, Queen of Hearts, Septimus (refuses
  A2 vs bosses).
- **Momentum flips:** Deacon Armstrong / Seeker (A2 speed-boost before A3), Athel (AoE vs a single boss).
- **Targeting exceptions:** Lanakis the Chosen (targets highest-buff enemy).
- **Uncertain "rule":** the doc also claims the default AI "prioritises AoE-setup skills over
  single-target" — this CONFLICTS with the A3→A1 default, so treat as UNCERTAIN and confirm its scope
  (it may be an archetype covering several champions, or just the mechanism behind Ezio's exception).

## Process (rules predict, reality confirms)

Every non-default behaviour carries **provenance + status** (`confirmed` / `suspected`). The action-oracle
(`tools/sim-actions.mjs`) applies the rules + confirmed exceptions and flags any divergence from a real
battle. A flagged divergence is a candidate to confirm a suspected entry, add a champion to a category, or
discover a new rule — the same capture → reconcile → measure loop the project runs on. See
`knowledge/action-verification-review-request.md` for why live confirmation is inevitable.
