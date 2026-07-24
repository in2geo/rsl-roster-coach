# Phase II slice — verified source skills (Dragon-16 team)

**Source layer / audit trail** for Milestone 0 authoring. Verbatim `skill_summary` + `damage_multiplier` /
`multiplier_type` **pulled from the LIVE DB 2026-07-23** (`champion_skills`). The DB is the authority; this is
a dated snapshot so authoring and review have one stable reference. Re-pull before trusting if the DB changes.

⚠ **Discipline (Mike, 2026-07-23): VERIFY, don't assume, and don't ask for what's in the DB — read it.**
This capture already overturned three inherited "facts" (see the corrections box). Author Step 2 ONLY from
text like this, never from the handoff/memory.

> **Name-resolution gotcha (verified):** the DB `champions.name` values are **`Bambus`**, `Ezio Auditore`,
> `Pelops the Victor`, `Tagoar`, `Vergis`. `Bambus Fourleaf` is an **alias**, not the name — an exact-name
> lookup returns zero rows (the silent-miss trap in CLAUDE.md). Resolve via alias/ilike, per the naming rule.

## Corrections this capture forced
- **Bambus is NOT DoT.** No Poison/HP Burn anywhere in his kit. His damage is spammed ATK-scaling AoE (A1 has
  no cooldown). The golden note `dragon16-donbambus-2026-07-22.json:48` ("DoT-dominated, no coeff") is **stale
  — do not trust it.** His coeffs are A1 3.8 ATK / A2 5.6 ATK.
- **Scaling stat is per-skill and NOT always ATK.** Pelops scales off **HP** (A1 0.25 / A2 0.4), Vergis off
  **DEF** (A1 3.9). Authoring must read `multiplier_type`, never default to ATK.
- **The current regex parser mis-reads Bambus A1.** Its AoE test is `/attacks all enemies/`; A1 says "Will
  **attack** all enemies instead if…", so the live engine treats A1 as always single-target. The recipe
  format fixes this with a real condition. (Concrete example of "prose parsing silently wrong.")

---

## Bambus (Magic) — alias "Bambus Fourleaf"

**A1 — Bamboo Splinter** · `3.8 ATK` · cd none
> Attacks 1 enemy. Has a 75% chance of placing a 30% [Decrease SPD] debuff for 2 turns. Will attack all enemies instead if the initial target is under 2 or more debuffs. This attack has a 75% chance of placing a 30% [Decrease SPD] debuff for 2 turns. Then places a [Sleep] debuff on this Champion for 1 turn. This debuff cannot be blocked or resisted.
- **II-A (author now):** ACQUIRE_TARGETS → `if selected target has ≥2 debuffs: all enemies, else: 1 enemy`; DEAL_DAMAGE 3.8×ATK, hitCount 1.
- **Defer:** 30% Decrease SPD @75% (II-B); self-[Sleep] 1t unresistable (II-D, and see passive).

**A2 — Grovetender** · `5.6 ATK` · cd 4
> Attacks all enemies. Before attacking, places a [Shield] buff on all allies equal to 30% of this Champion's MAX HP for 2 turns. Also increases the duration of all buffs on all allies by 1 turn. After attacking, has a 75% chance of decreasing the duration of all enemy buffs by 1 turn… increases the value of any [Shield] buffs on all allies by 3% for each enemy buff whose duration decreased… Then places a [Sleep] debuff on this Champion for 1 turn (cannot be blocked or resisted).
- **II-A:** ACQUIRE_TARGETS all enemies; DEAL_DAMAGE 5.6×ATK. **Defer:** shield-all (II-C), buff-duration extend (II-C), enemy buff-duration strip (II-C), self-Sleep.

**A3 — Dream Sight** · no mult · cd 4 — no damage term (buffs/debuffs only) → **not in the damage slice.**

**Passive — Sleeping Sage [P]** · no mult
> …75% chance of transferring debuffs placed on an ally to this Champion while under [Sleep]… at start of turn remove [Sleep]… then transfers all debuffs from self to the highest-RES enemy…
- **Identity / survival mechanic (II-D/E):** he is a **debuff sponge + redirect** — part of why the healers stay clean. Named-exception territory. Not damage slice.

---

## Ezio Auditore (Spirit)

**A1 — Eagle Dive** · `4 ATK` · cd none — Attacks 1 enemy; 75% 60% [Decrease DEF] 2t (unresistable under [Veil]/[Perfect Veil]).
- **II-A:** single target, DEAL_DAMAGE 4×ATK. **Defer:** Decrease DEF (II-B); the veil-unresistable clause (II-B).

**A2 — Da Vinci's Design** · `4 ATK` · cd 4 — Attacks all enemies; two 5% [Poison] + 25% [Poison Sensitivity]; **instantly activates all [Poison] on enemies under 4+ debuffs**; [Stone Skin]→[Bomb] branch.
- **II-A:** all enemies, DEAL_DAMAGE 4×ATK. **Defer:** poison/sensitivity (II-B), activation (II-D), Bomb/Stone-Skin (II-E exception).

**A3 — Hidden Gun** · `5 ATK` · cd 4 — Attacks 1 enemy; steals all buffs first; **ignores 35% DEF + [Shield]/[Strengthen]**.
- **II-A:** single target, DEAL_DAMAGE 5×ATK with `ignore_def: 0.35` flag. **Defer:** buff steal (II-C), ignore-shield (II-A later).

**Passive — Everything Is Permitted [P]** · `2 ATK` — execute-style bonus damage when an enemy drops below 25% after Assassin damage; ignores 100% DEF; can't crit. → **II-D trigger (on-damage), defer.**

**Passive 2 — Full Synchronization [P]** — **[Perfect Veil] at start of each Round**; **35% chance to reduce a >50%-MAX-HP hit to 0**; **35% counterattack when attacked**.
- **Survival identity (II-D):** Veil = untargetable (why Ezio's `taken` is ~3,820). The 0-damage nullify + counter are reactive. Defer, but this is a top survival driver.

---

## Pelops the Victor (Spirit) — scales off **HP**

**A1 — Triumphant Blow** · `0.25 HP` · cd none — Attacks 1 enemy; 75% 50% [Decrease ATK] 2t (unresistable/unblockable if target under [HP Burn]).
- **II-A:** single target, DEAL_DAMAGE **0.25×HP**. **Defer:** Decrease ATK (II-B).

**A2 — Gorgoa's Bane** · `0.4 HP` · cd 4 — Attacks 1 enemy; ignore 50% DEF if target [HP Burn]; **+10% dmg per turn remaining on debuffs on self & target (≤200%)**; if dmg <50% target MAX HP → steal buffs + [Stun].
- **II-A:** single target, DEAL_DAMAGE 0.4×HP; conditional `ignore_def: 0.5`. **Defer:** the +10%/debuff-turn dynamic scaler (II-A later / exception), the sub-50% steal+stun branch (II-C).

**A3 — Victor's Bounty** · no mult · cd 4 — **the survival keystone:** Increase ATK + **[Magma Shield] all allies (30% his MAX HP)** + **[Taunt] self**; passive **−20% damage to all allies** while not under [Decrease DEF]. → **II-C/II-D, not damage slice.**

**Passive — Master of Games [P]** — immune Stun/HP Burn/Petrification; **100% [HP Burn] on any enemy that attacks him** (50% if he's under Decrease DEF); 50% [Petrification] on attacker. → **II-D on-attacked (already partly modelled), defer.**

---

## Tagoar (Magic)

**A1 — Da Magic Stick** · `1.8 ATK` · cd none — **Attacks 1 enemy 2 times**; 60% [Increase DEF] on lowest-HP ally.
- **II-A:** single target, DEAL_DAMAGE 1.8×ATK, **hitCount 2**. **Defer:** Increase DEF buff (II-B).

**A2 — Charge Cant** · `3.7 ATK` · cd 5 — Attacks all enemies; Increase SPD all allies; **heal all allies 15% his MAX HP**.
- **II-A:** all enemies, DEAL_DAMAGE 3.7×ATK. **Defer:** Increase SPD (II-B), heal (II-C).

**A3 — Rise And Fight** · no mult · cd 7 — revive all dead 30% HP + [Shield] all allies (20% his MAX HP). → **II-C, not damage slice.**

**A4 — Aid the Feeble [P]** — **−10% damage to allies at ≤50% HP.** → **II-D passive, defer (named survival mechanic).**

---

## Vergis (Spirit) — A1 scales off **DEF**

**A1 — Pierce** · `3.9 DEF` · cd 0 — Attacks 1 enemy; 40% chance 30% [Reflect Damage] on a random ally 2t.
- **II-A:** single target, DEAL_DAMAGE **3.9×DEF**. **Defer:** Reflect buff (II-B/D).

**A2 — Aegis** · no mult · cd 4 — Continuous Heal + Increase SPD + Reflect on a target ally; **50% [Ally Protection] on all allies except self**; Increase DEF self. → **II-C/II-D, not damage slice.**

**Passive — Second Wind [P]** · cd 3 — **[Shield] 10% MAX HP when he loses ≥10% MAX HP from a single hit**; **15% [Continuous Heal] when HP < 50%.** → **II-D reactive trigger (on-hit / on-HP-threshold) — a core survival gap, defer to II-D.**

---

## What the slice actually is for this team
Damage (II-A) is the SMALL part of these kits. Every champion's survival value lives in buffs/shields/heals
(II-B/C) and reactive passives (II-D). This is the survival-gap diagnosis, confirmed against verbatim text:
Ezio Veil+nullify, Pelops Magma-Shield-all+Taunt+team-DR, Tagoar heal/shield/revive+Aid-the-Feeble, Vergis
Second-Wind+Ally-Protection. The slice proves the *architecture* on the damage parts first; the survival
mechanics arrive in II-C/II-D on top of it.
