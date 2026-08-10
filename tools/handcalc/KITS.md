# Hand-calc kit spec — DonaHilvi CB (Demon Lord) Hard

Every clause of every skill, from the verbatim `skill_summary`, mapped to **MODEL** (how) or **DEFER** (why).
Team: Ezio Auditore, Ninja, Michelangelo (Mikey), Iudex Artor, Xenomorph. Leader = **Mikey (ACC 70 aura)**.
Boss = **Void** this key (neutral → affinity ×1; no weak hits). Base cooldowns unless a champ's books are confirmed.

Legend: 🟢 modeled · 🟡 partially modeled · 🔴 deferred · ⚠ = **I missed this in v1**.

---

## Cross-cutting mechanics (apply to everyone)

- **Decrease DEF on the boss is a LASTING TEAM-WIDE MULTIPLIER, not a per-hit ignore.** Ninja A1 (60%), Mikey A2 (60%), Ezio A1 (60%) all place it; RSL Decrease DEF does **not stack** (max 60%). While it's up, **every ally's direct-attack damage** rises (DoT is DEF-independent, unaffected). ⚠ **v1 modeled these only as ignore-DEF on the caster's own hit — so the team-wide boost to everyone's direct damage was missing.**
- **Xeno passive also decreases boss DEF by 20% while it's poisoned** — separate from Decrease DEF. ⚠ missed in v1.
- **10-debuff cap is SHARED** across all poison + HP-burn + Decrease DEF + Leech + etc. Poison and HP-burn compete for slots. 🟡 (modeled for poison/HP-burn only; the non-DoT debuffs also consume slots — needs accounting).
- **DoT ticks on the boss's turn** (capped: Poison 5%→40k, HP-Burn→75k) + extra ticks from activations. Poison Sensitivity ×1.25 after the cap. 🟢
- **Perfect Veil** → the caster is untargetable by the boss's single-target Crushing Force, AND makes that caster's debuffs unresistable while up. Ezio: **only turns 1–2** (never re-applies in CB). Ninja/Xeno: re-apply on their A1/A2 (self-veil), so ~always up. 🟡

---

## NINJA — Warmaster, Lifesteal 4-set (30%), Magic

**A1 Shatterbolt (cd 0, 3.7×ATK):** "Attacks 1 enemy. Has a 45% chance of placing a 60% [Decrease DEF] debuff for 2 turns. Also fills this Champion's Turn Meter by 15% when used against Bosses."
- 🟢 3.7×ATK ×1 direct + WM proc.
- ⚠🔴→🟢 45% chance 60% **[Decrease DEF] 2t on boss** — lasting team-wide multiplier (v1 ignored it).
- 🟢 +15% own TM vs boss.

**A2 Hailburn (cd 4, 2×ATK ×3):** "Attacks 3 times at random. Each hit 75% [HP Burn] 3t. Places [Perfect Veil] on self 2t. vs Bosses: instantly activate any [HP Burn], including ones placed by this Skill."
- 🟢 3× 2×ATK direct + WM.
- 🟢 per-hit: 75% place HP burn (3t) + instantly activate THAT burn (one tick now); burns persist → tick on boss turns.
- 🟡 [Perfect Veil] self 2t (protection + unresistable) — self-protection modeled loosely; re-ups his veil ~every A2.

**A3 Cyan Slash (cd 5, 3×ATK):** "Attacks all enemies. 75% [Freeze] 1t. vs Boss: only hits Boss, ignore 50% DEF, and −1 to Hailburn cd."
- 🟢 3×ATK ×1 (single vs boss), ignore 50% DEF, WM.
- 🔴 [Freeze] — boss immune.
- 🟢 −1 A2 cd.

**Passive Escalation:** "vs Bosses: +20% ATK (up to 100%) and +10% C.DMG (up to 25%) each time a single enemy is hit by all 3 of Ninja's active skills in a single Round. **Multiplicative**, can occur multiple times."
- 🟡 ATK ramp: v1 does `atkMult += 0.20` (additive, cap 2×) — should be **×1.20 multiplicative** (cap +100%). ⚠ **C.DMG +10%/trigger (cap +25%) not modeled.** Trigger = A1+A2+A3 each land on boss since last trigger.

---

## XENOMORPH — no mastery, Perception 4-set, Magic

**A1 Tail Stab (cd 0, 3.9×ATK):** "Attacks 1 enemy. Places a 5% [Poison] 2t. Places THREE 5% [Poison] if this attack is critical. Places [Perfect Veil] on self 2t."
- 🟢 3.9×ATK ×1.
- 🟢 poison: 1 base, **3 if crit** → EV = 1 + 2×critRate. (5% → 40k cap.)
- 🟡 [Perfect Veil] self 2t (re-ups ~every A1 → poisons unresistable).

**A2 Infestation (cd 4, 5.9×ATK):** "Attacks 1 enemy. Places [Stun] + [Infest] 2t (unresistable if veiled). [True Fear] all other enemies 1t. Passive: revives self at 50% HP/TM when an [Infest]ed enemy dies."
- 🟢 5.9×ATK ×1.
- 🔴 [Stun]/[Infest]/[True Fear] — boss immune; single boss (no "other enemies"). Revive — boss never dies.

**A3 Rip and Claw (cd 4, 3×ATK ×2):** "Attacks 2 times. Deals 15% more damage for each [Poison] on the target. Places [Perfect Veil] self 2t."
- 🟢 2× 3×ATK × (1 + 0.15 × poison stacks on boss).
- 🟡 self-veil.

**Passive Caustic Blood:** "When attacked, 25% to place 5% [Poison] on attacker 2t (unresistable/unblockable on crit). Enemies under this Champion's [Poison] have DEF decreased 20%."
- ⚠🔴→🟢 **−20% boss DEF while it's poisoned** (v1 missed — boosts everyone's direct damage).
- 🟡 counter-poison when attacked (25%) — small extra poison source; boss must attack Xeno.

---

## MICHELANGELO (Mikey) — Warmaster, Spirit, LEADER (ACC 70)

**A1 Boo-Yah! (cd 0, 2×ATK ×2):** "Attacks 1 enemy 2 times. If either hit crit, 50% [Increase ATK] self 2t."
- 🟢 2× 2×ATK + WM.
- ⚠🔴 50% [Increase ATK] self on crit (boosts his own next hits) — not modeled.

**A2 Express Delivery! (cd 4, 6×ATK):** "Attacks 1 enemy. Before attacking, 75% 60% [Decrease DEF] 2t. 75% [Stun] 1t. Ignore 25% RES if crit. Then [Debuff Spread]…"
- 🟢 6×ATK ×1 + WM.
- ⚠🔴→🟢 75% **[Decrease DEF] 60% 2t on boss** (team-wide multiplier).
- 🔴 [Stun] — boss immune. [Debuff Spread] — single boss, nothing to spread to.

**A3 Shell Cyclone (cd 5, 5×ATK):** "Attacks all enemies. 75% 50% [Decrease ATK] + [Leech] 2t. Then [Taunt] self 2t."
- 🟢 5×ATK ×1 + WM.
- 🟢 [Leech] on boss 2t → team heals 18% of direct damage.
- 🟢 [Taunt] self 2t → draws boss Crushing Force onto Mikey.
- 🟡 75% [Decrease ATK] 50% on boss 2t — reduces boss ATK-based damage (survival). ⚠ not modeled (affects `taken`, not the damage race).

**A4 Party Dude:** "15% Evade (30% under Taunt). Ally TMNT join his attacks. [Shield] = 300% ATK on self when hit."
- 🔴 Evade, Shield (survival). No TMNT allies here → no joins.

---

## EZIO — no mastery, Void? (check affinity), Assassin

**A1 Eagle Dive (cd 0, 4×ATK):** "Attacks 1 enemy. 75% 60% [Decrease DEF] 2t (unresistable if veiled)."
- 🟢 4×ATK ×1.
- ⚠🔴→🟢 75% **[Decrease DEF] 60% 2t on boss** (team-wide multiplier; unresistable turns 1–2 only).

**A2 Da Vinci's Design (cd 4, 4×ATK):** "Attacks all enemies. 75% two 5% [Poison] + 25% [Poison Sensitivity] 2t. Instantly activates all [Poison] on enemies under 4+ debuffs. (Stone Skin/Bomb branch — n/a on boss.)"
- 🟢 4×ATK ×1.
- 🟢 place 2 poison (75% EV) + [Poison Sensitivity] 25%; activate all poison if boss ≥4 debuffs (consume).
- 🟡 unresistable only while veiled (turns 1–2); after t2 poisons roll vs boss RES. ⚠ v1 assumed always-land.

**A3 Hidden Gun (cd 4, 5×ATK):** "Attacks 1 enemy. Steal all buffs first (unresistable if veiled). Ignore 35% DEF + [Shield]/[Strengthen]."
- 🟢 5×ATK ×1, ignore 35% DEF.
- 🔴 steal buffs — boss's self-buffs (Dark Nova +25% ATK) could be stolen; minor.

**Passive Everything Is Permitted:** execute <25% HP — 🔴 boss never drops that low.
**Passive 2 Full Synchronization:** "[Perfect Veil] self at start of each Round. 35% nullify a >50%-MaxHP hit. 35% counter when attacked."
- 🟡 **Veil turns 1–2 ONLY** (no round boundaries in CB → fires once). 🔴 nullify/counter (survival).

---

## IUDEX ARTOR — no mastery, Spirit, Support

**A1 Censer Whirl (cd 0, 3.4×ATK):** "Attacks all enemies. Heals all allies by 5% of this Champion's MAX HP."
- 🟢 3.4×ATK ×1 (single boss). 🟢 heal all allies 5% Artor MaxHP (credited to Artor).

**A2 Incense of Inspiration (cd 5):** "50% [Increase ATK] + 25% [Strengthen] all allies 2t. Fills ally TMs 15%."
- 🟢 team +15% TM. ⚠🟡 **50% [Increase ATK] on all allies** — boosts the whole team's direct damage; not modeled. [Strengthen] = survival.

**A3 Revival Mandate (cd 6):** revive an ally + cast their skill.
- 🔴 no deaths in this fight → inactive.

---

## BOSS — Demon Lord Hard (Void this key)

**Crushing Force (A1):** single-target, **%Enemy MAX HP** damage + unresistable [Stun] 1t. 🟢 targets Taunt (Mikey) else Ezio (if unveiled); stuns them.
**Flesh Wither (A2):** 2-hit AoE (ATK-based) + 2.5% [Poison] on allies (Void debuff). 🟡 AoE ATK modeled; the boss-placed ally poison (small self-damage risk) 🔴.
**Dark Nova (A3):** AoE (ATK-based), **1 hit on Void**, no self-buff. 🟢.
**Gathering Fury [P]:** from turn 10 damage ramps; turn 20 more; turn 50 ignores Block Damage/Unkillable. ⚠🔴 **not modeled** — but fights ~this length may cross turn 10, ramping incoming.
**Infernal Resilience [P]:** reduces Poison/HP-Burn/%MaxHP damage (→ the absolute DoT caps) + immune to Stun/Freeze/Sleep/Decrease SPD, MaxHP-destruction, TM-reduction. 🟢 (caps) / 🟢 (immunities).
**Almighty Immunity [P]:** immune to a long CC list. 🟢.

**Boss rotation:** v1 uses a flat A1→A2→A3 cycle. ⚠ **the real per-turn rotation/cooldowns are not confirmed** — needs the video.
