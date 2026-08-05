# Contribution-scoring spec — valued + magnitude + saturation (Clan Boss first)

**Status:** design spec (2026-08-05), from a design session with Mike driven by three real Clan Boss
captures. Not yet built. Supersedes the binary-tag coverage scoring for CB; generalizes to all content.

## 1. Why — the problem this fixes

Today the selector (`tools/bucket-score.mjs`, and `lib/team-constructor.js`) scores teams by **binary tag
presence** mapped into coverage buckets. Three failures, all proven on CB this session:

- **Magnitude blindness (within a tag).** Coldheart and Xenomorph both carry a `Poison` tag, so they fill
  the `damage` bucket **equally** — yet Coldheart has one *conditional* 5% poison (afterthought; she's a
  capped-%maxHP + TM-reduction control champ) and Xenomorph has a multi-source, unconditional, **scaling**
  poison engine. A 5% poison is literally **2×** a 2.5% one (on CB Hard the caps are 40k vs 20k/tick), and a
  60% Decrease DEF ≈ 2× a 30% — none of which the tag encodes.
- **No capability value (across tags).** A champ with Leech + Weaken + Decrease Attack (three needs) should
  outweigh one with only Decrease Defense (one need). Tags are treated as equal checkboxes.
- **Damage treated as coverage, not a race.** CB is a DoT **maximization** race; the model saturated the
  damage bucket at ~one carry and traded away extra poisoners for cleanse. (Partly patched this session with
  a `'stacking'` coverage mode + a CB allocation re-weight; this spec is the principled version.)

**Ground truth (validation anchors), all Demon Lord Hard, DonaHilvi:**
`test/golden/clan-boss-donahilvi-hard-current.json` (pool pick, 6.21M) ·
`…-ezioxeno-current.json` (7.82M) · `…-ezioxeno-artor-current.json` (9.0M). The carries are always the DoT
engines (Ninja HP-Burn ~4–4.9M, Xenomorph Poison ~3.2–3.4M); Coldheart/cleanse are not the win.

## 2. The model (one formula)

For a given **content** `K` and a **team** `T`:

```
teamScore(T, K) = Σ_needs  needValue(need, K) · fill(need, T, K)          [+ synergy terms, §7]
championValue(c, T, K) = teamScore(T, K) − teamScore(T \ {c}, K)          (marginal — used for repair/seed)
```

- A content `K` declares **needs** (like `CB_NEEDS`): each need has a `role`, a `value` (content-weighted),
  and an **aggregation mode** (§4).
- Each champion delivers **capabilities** — one per relevant **skill** (per-skill, §6) — each with a
  **magnitude** and a **reliability**.
- A capability's contribution to a need:

```
contrib(cap, need, K) = baseValue(cap.tag, need, K)          // content- & need-specific value (§5)
                      · magnitudeFactor(cap)                  // big-vs-little curve (§4.2)
                      · reliability(cap, c, K)                // ACC-vs-RES, affinity weak-hit, auto, condition (§5)
```

- `fill(need)` aggregates every champion's `contrib` to that need under the need's **mode** (§4.1), which is
  where **saturation** lives. Full kits win by contributing to **more needs** (breadth) and by **magnitude**
  — never by double-counting a redundant capability.

## 3. Non-negotiable guardrails

1. **Valued marginal contribution that SATURATES — never a raw Σ(tag values).** Raw summation re-creates the
   "fielded fodder / many weak tags out-score a carry" failure the allocation model was built to kill (Mike,
   2026-07-18; amplification ran 182–220% until boundaries were tightened). Saturation is mandatory.
2. **Values are content- AND team-composition-dependent.** Decrease DEF is a top multiplier for a **nuke**
   team and **worthless** for a **DoT** team (`lib/damage-mechanics.js §2`). So `baseValue` is `f(tag, need,
   content, teamDamageType)`, not a global constant.
3. **Magnitude curves cap / diminish — not linear.** CB poison is **capped** (above the cap extra % buys
   nothing); DEF reduction diminishes in the damage formula. `magnitudeFactor` is a curve.
4. **Implement, don't fit.** Magnitudes come from skill text / game facts (the caps, the %s), not from tuning
   to these three keys. The captures VALIDATE direction; they are not a fit target (single-account, 3 keys).
5. **Measure every change.** This is the scoring reimplementation — every step reports whether the CB
   recommendation + the per-champion damage estimate move toward the captures.

## 4. Aggregation modes (where saturation lives)

### 4.1 Mode per need
- **STACKING** (CB `boss_damage` = Poison / HP Burn; extra-hits): champions' throughputs **sum**, capped at a
  content ceiling. CB ceiling = the **10-debuff cap** (poison) and **one-active-burn** (HP Burn). Above the
  ceiling, extra placement = 0.
  - **CONSEQUENCE (Mike 2026-08-05):** you field **2–3 DoT carriers, NOT all of them** — Xeno + Narma + Ezio +
    Venomage individually all score high, but the team saturates, so the 4th poisoner adds ~0 and its seat is
    better spent on amp/sustain/an activator. This is the counterbalance to per-champion throughput: value each
    poisoner high, saturate them collectively. (`STACK_CAP` in bucket-score models this.)
  - **The ceiling is DYNAMIC — an ACTIVATOR raises it.** Ezio's Debuff Activation detonates + cycles the stack,
    freeing debuff slots (INS-0010: the 10-cap binds only WITHOUT an activator). So `STACK_CAP` should be
    `base (~2.5) without a Debuff-Activation champ, higher (~3.5) with one` — which is what makes a **3rd**
    poisoner regain value ONLY when an activator is present (§7). Fixed `STACK_CAP=2.5` today; make it
    activator-aware next.
- **COVERAGE / UPTIME** (Decrease ATK/DEF, Weaken, Cleanse, Block Debuffs): you need it **landed reliably**,
  not stacked. `fill = 1 − Π(1 − rel_i)` (capped) — extra coverers add reliability, not magnitude. But the
  **magnitude of the debuff scales the value of the coverage** (a 60% Decrease DEF coverage is worth ~2× a
  30% one).
- **THRESHOLD → multiplicative** (sustain): enough sustain to survive is a gate; **beyond survival, extra
  survival turns multiply every DoT tick** (`damage-mechanics §3`; capture 3: Artor's heals/revive stretched
  the key to 6:37 → +1.2M). Model sustain as "turns survived," feeding a multiplier on the DoT needs.

### 4.2 magnitudeFactor(cap) — the big-vs-little curve
`magnitudeFactor` maps a skill's parsed parameter to a value multiplier, per tag family:
- **Poison / HP Burn (CB):** use the **absolute cap** directly — `CB_POISON_CAPS[diff][strength] · stacks ·
  (1+PoisonSensitivity)`; a 5% poison = 2× a 2.5% because the cap doubles. HP Burn = `CB_HP_BURN_TICK[rarity]`,
  one active. (`lib/cb-damage-model.js` already computes these.)
- **Stat debuffs (Decrease DEF/ATK, Weaken):** exactly TWO factors, **no saturation/diminishing curve**
  (Mike 2026-08-05):
  (1) **magnitude tier** — the big-vs-little version (60% vs 30% Decrease DEF; same idea as 5% vs 2.5%
      poison), weighted ~linearly (60% ≈ 2× 30%); and
  (2) **UPTIME** — for that version, how many turns the (best) debuff is kept UP on the boss =
      `reliability × min(1, duration ÷ reapplyInterval)`.
  `value = magnitudeTier × uptime`, aggregated across appliers as `1 − Π(1 − rel)` (extra appliers add
  uptime/reliability, NOT magnitude). It does NOT stack, and there is NO curve on the % to tune.
- **Heal/Shield:** `%maxHP` (or amount) normalized to a baseline; feeds the sustain "turns survived."
- Also `· duration/baseDuration · (baseCooldown/cooldown)` — a 3-turn poison on a 1-CD skill ≫ a 2-turn on a
  3-CD skill (throughput = magnitude × frequency × uptime).

## 5. baseValue, reliability, conditionality
- **baseValue(tag, need, K, teamType):** the content-weighted worth of the capability for that need. CB:
  DoT high, DoT-amp (Sensitivity/Activation/DEF-shred-on-the-attack-portion) high, sustain high (extends the
  race), mitigation (Decrease ATK) medium, cleanse/TM-control ~0 (boss TM-immune → already `DEAD_ON_CB`).
- **reliability:** `debuffLandChance(acc, bossRES)` (`lib/formulas.js`) × affinity weak-hit suppression
  (`lib/bucket-magnitude.js affinityPlacementFactor`, engine `affinityMult`) × auto-reliability
  (`auto_reliable`) × **condition factor**.
- **conditionality:** Coldheart's A2 poison needs her own [Heal Reduction] first (self-combo, Tag Policy #1) →
  reliability < 1 (delayed / partial), not 0. An ally-gated condition → 0 unless the ally is on the team.

## 6. Data — PER-SKILL TAGS + magnitude (CHOSEN 2026-08-05: the durable schema, not an interim table)

**Decision (Mike):** do the per-skill tag SCHEMA — the durable foundation — not a throwaway computed table.

**Current schema (introspected 2026-08-05):**
- `champion_tags(id, champion_id, tag_id, status, source_type, source_note, ascension_required,
  champion_form, target_type, chance_unbooked, chance_booked, …)` — **one row per (champion, tag)**; the
  delivering skill appears only inside the free-text `source_note` ("A2 Infestation: …"); **no structured
  skill FK, no magnitude** (%, stacks, duration).
- `champion_skills(id, champion_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked,
  damage_multiplier, multiplier_type, maxhp_effect_kind, maxhp_pct, maxhp_pct_boss, maxhp_pct_cap, …)` — so
  per-skill %maxHP magnitude + caps + cooldowns **already exist** at the skill level; the tag layer just
  doesn't carry the rest.

**The change (CHOSEN 2026-08-05 for durability): a NEW `champion_skill_tags` table** — the proper per-skill
join entity — with `champion_tags` kept as a **roll-up VIEW** for backward compatibility. (Extend-in-place
was the lower-disruption option but conflates per-champion vs per-skill grain and overloads the approval
table; the separate table is the durable choice.)

```
champion_skill_tags(
  id uuid pk,
  champion_id uuid  FK champions,
  skill_id    uuid  FK champion_skills,     -- carries slot, cooldowns, maxhp_% already
  skill_slot  text,                          -- A1/A2/A3/A4/Passive/Aura (denormalized for convenience)
  tag_id      uuid  FK tags,
  magnitude_pct numeric, stacks int, duration_turns int,
  condition   text,                          -- 'self-combo' | 'ally-gated' | 'crit' | null
  chance_unbooked numeric, chance_booked numeric,
  status text, source_type text, source_note text, proposed_by/at, approved_by/at,   -- workflow moves here
  unique (champion_id, tag_id, skill_slot)
)
-- champion_tags  →  VIEW: SELECT DISTINCT champion_id, tag_id, max(status) … FROM champion_skill_tags
--                   (every existing per-champion reader — incl. REST champion_tags?select=… — is unchanged)
```

So Xenomorph gets a Poison row for **A1** AND the **Passive** (2 rows); Coldheart one Poison row for **A2**
with `condition='self-combo(Heal Reduction)'`, `magnitude_pct=5`. Magnitude lives WITH the skill relationship
(FKed to `champion_skills`, which already owns `maxhp_pct`/caps/cooldowns), not bolted onto a per-champion row.

**Population = regenerate from `skill_summary`** (the sanctioned source of truth — Tag Policy: regenerate
from skill text via LLM, human-reviewed, landed as `status='proposed'` → advisor-approved; NOT bracket
scraping). Reuse `lib/multiplier-rank.js parseMultiplier` and the existing `champion_skills.maxhp_*` fields
for magnitude; write via committed `seeds/*.sql` + the worksheet `DB_Champion_Tags` (Tag Policy #18
write-back). **Scope: start with CB-relevant DoT + debuff champions**, then the full Rare+ roster.

## 7. Synergies (already defined, must become load-bearing)
`lib/synergies.js` already encodes **Debuff Activation × Poison/HP-Burn** ("stack-and-detonate DoT engine",
magnitude high; the Xenomorph+Ezio pairing). In this model a synergy is a **team-level multiplier / ceiling
change**, not a per-champ tag: an activator **raises the effective 10-debuff ceiling** (INS-0010: the cap
binds only without an activator) and detonates the stack early. Ezio's own damage bar is tiny; his value is
this multiplier on the poisoners — which per-champion tag scoring can never see, and `bucket-score` currently
ignores entirely.

## 8. CB-first implementation (phased; measure each)

1. **DoT need from the damage model.** Replace the CB `damage` bucket's binary fill with
   `estimateCbDamage` (`lib/cb-damage-model.js`) per champion — capped poison (by parsed strength/stacks),
   capped HP-burn (by placer rarity), mastery procs, capped %maxHP. Sum with the STACKING mode (10-debuff /
   one-burn ceiling). **Check:** Xeno ≫ Coldheart; per-champ estimate ≈ the captures (Ninja ~4–5M, Xeno ~3.2M).
2. **Debuff needs get magnitude.** Scale Decrease ATK/DEF/Weaken coverage by parsed `pct` (§4.2 curve).
3. **Sustain → turns-survived multiplier** on the DoT needs (§4.1 threshold-then-multiplicative).
4. **Activator synergy** as a ceiling-raiser/multiplier on the DoT need (§7) — surfaces Ezio.
5. **Wire into selection.** `championValue` (marginal, §2) replaces `devScore`-seed + bucket-repair for CB, or
   feeds them. Keep `devScore` **gear-free / level-led** (done 2026-08-05) as the tiebreaker among
   comparably-valuable champs — kit value first, development to break ties.

## 9. Validation
- **Recommendation:** does CB now surface a poison-activation team (Ezio + Ninja + Xenomorph + amp/sustain),
  and rank Coldheart as a control champ, not a carry?
- **Magnitude:** does the per-champion CB damage estimate reproduce the three captures' per-hero split and the
  6.21 → 7.82 → 9.0M gradient (once single-HP-Burn is enforced in the sim)?
- **No regression:** other content still scored by their own allocations; `tools/sim-selftest.mjs` green;
  spot-check Dragon/Spider pool picks unchanged.

## 10. Generalization
Everything above is content-agnostic except the **values** and the **caps/ceilings**. Each content supplies
its own `needValue`, aggregation modes, and magnitude curves (Spider: poison stacks + swarm control; nuke
content: Decrease DEF magnitude is top). CB is first because its magnitude half already exists. This is the
`knowledge/contribution model` the project has targeted since INS-0031 / "coverage is binary."

## Open questions for Mike
1. ✅ RESOLVED 2026-08-05 — **per-skill tag SCHEMA** (durable), not an interim table (§6).
2. ✅ RESOLVED 2026-08-05 — poison = hard cap (§4.2); **Decrease DEF/ATK = pure UPTIME** (magnitude × uptime,
   no saturation curve). Still to confirm as they come up: Weaken (uptime, same as Decrease DEF?), and the
   Heal/Shield → "turns survived" mapping.
3. How much should the **activator ceiling-raise** be worth (INS-0010 says it "unbinds the 10-cap" but gives
   no number)? Needs a magnitude from a capture where an activator is added/removed.
4. Cross-account validation beyond DonaHilvi before this drives live recommendations.
