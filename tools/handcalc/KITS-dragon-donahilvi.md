# DonaHilvi Ezio-Xeno team — verbatim kits (source: champion_skills DB, 2026-08-14)

Clause-by-clause spec for the st20 hand-calc. **Dragon boss (Hellrazor, Magic) is immune to
Stun / Freeze / Sleep / Provoke / Fear / True Fear + Decrease TM / Decrease SPD.** So every CC clause is
INERT vs the boss; the boss phase is a **damage race + Scorch-survival sustain cycle**.

Affinity vs the Magic boss: Spirit champs (Mikey/Ezio/Iudex) deal ×0.7 / take ×1.3; Xeno (Magic) ×1.0;
Hilve (Force) deals ×1.3 / takes ×0.7.

---

## Michelangelo (Spirit) — off-tank
- **A1 Boo-Yah!** (no cd, 2×ATK ×2 hits) — crit → 50% [Increase ATK] self 2t.
- **A2 Express Delivery!** (cd4, 6×ATK) — 75% [Decrease DEF] 60% 2t + 75% [Stun] 1t (STUN INERT vs boss);
  crit → ignore 25% RES; then [Debuff Spread] (single enemy vs boss → no spread).
- **A3 Shell Cyclone** (cd5, 5×ATK AoE) — 75% [Decrease ATK] 50% + [Leech] 2t; **[Taunt] self 2t**.
- **A4 Party Dude [P]** — 15% Evade (30% under [Taunt]); Turtle join-attack (NO other Turtles → inert);
  **[Shield] = 300%·ATK (≈5,838) self for 1t whenever he is hit** — his tank engine (re-shields each hit).

## Xenomorph (Magic) — poison + self-revive
- **A1 Tail Stab** (no cd, 3.9×ATK) — 5% [Poison] 2t (THREE 5% Poison if crit); [Perfect Veil] self 2t.
- **A2 Infestation** (cd4, 5.9×ATK) — [Stun]+[Infest] 2t on target (unresist. under P.Veil; both INERT/capped vs
  boss); [True Fear] all OTHER enemies 1t (none in boss phase). **[P] Revives Xeno 50% HP + 50% TM whenever an
  enemy under [Infest] dies** (wave self-sustain via the Infest chain).
- **A3 Rip and Claw** (cd4, 2 hits, ⚙ base per-hit mult NEEDS CONFIRM — assumed 3×) — +15% dmg per [Poison] on
  target; [Perfect Veil] self 2t.
- **Passive Caustic Blood** — 25% counter-[Poison] when attacked (unresist. if the hit crit); **enemy under
  Xeno's [Poison] → −20% DEF** (boosts the team's ATTACK damage to the boss).

## Ezio Auditore (Spirit) — poison + self-protect
- **A1 Eagle Dive** (no cd, 4×ATK) — 75% [Decrease DEF] 60% 2t (unresist. under Veil).
- **A2 Da Vinci's Design** (cd4, 4×ATK AoE) — 75% two 5% [Poison] + 25% [Poison Sensitivity] 2t; **instantly
  activates all [Poison] on enemies under 4+ debuffs** (early-ticks the boss's poison). (Stone-Skin/Bomb branch N/A.)
- **A3 Hidden Gun** (cd4, 5×ATK) — steal all buffs from target; **ignore 35% DEF + [Shield]/[Strengthen]**.
- **Passive Everything Is Permitted** — enemy HP <25% after any Assassin's damage → bonus dmg ∝ Ezio ATK,
  ignore 100% DEF, no crit (EXECUTE on the boss below 25%).
- **Passive 2 Full Synchronization** — **[Perfect Veil] self 2t at the start of each Round**; 35% nullify a hit
  >50% maxHP to 0; 35% counterattack when attacked. (Veil = single-target immunity; AoE/Scorch pierce it.)

## Hilve / "Hilvi" (Force) — freeze-control + **AoE REVIVE (boss-phase survival engine)**
- **A1 Frostflame Torch** (no cd, 2.6×ATK ×2 hits) — each hit 50% [Decrease DEF] 60% 2t.
- **A2 Embittering Cold** (cd5) — remove ALL buffs from all enemies + [Freeze] all 1t (FREEZE INERT vs boss →
  buff-strip only vs boss); cd cannot be reduced/reset.
- **A3 Ward Of The Glacier** (cd6) — **REVIVES ALL DEAD ALLIES @50% HP + 30% TM; [Block Damage] on ALL allies
  1t + 30% [Increase SPD] all 2t** (buffs land even if none revived; if none revived, +25% TM all). cd cannot be
  reduced/reset. ⭐ **This is how the team eats repeated Scorches: whole team back + Block Damage negates the very
  next hit (Mike witnessed exactly this).**
- **Passive Divine Mission** — on an enemy [Freeze] → steal a buff + [HP Burn] 2t + −10% TM (the WAVE HP-burn
  engine; INERT vs the boss, which can't be frozen).

## Iudex Artor (Spirit) — heal / buff / single-revive
- **A1 Censer Whirl** (no cd, 3.4×ATK AoE) — heal all allies 5% of Iudex maxHP (≈1,400/cast).
- **A2 Incense of Inspiration** (cd5) — **50% [Increase ATK] + 25% [Strengthen] all 2t** (Strengthen = −25% dmg
  taken → the Scorch/Swipe/WoF mitigation, verified: Ezio Scorch 5,841 = 0.25·maxHP·0.75); +15% TM all.
- **A3 Revival Mandate** (cd6) — revive 1 ally @50% HP + 50% TM + 50% [Increase ATK] 1t; then the revived ally
  **casts its default skill at the lowest-HP enemy**.
- **A4 Sentenced to Life [P]** (cd4) — if a revived ally's default skill KILLS an enemy → reset A3 cooldown.

---

## Boss-phase SURVIVAL ENGINE (what I was missing — the whole point)
The team survives repeated **Scorch** (%MaxHP AoE + Stun, pierces veil) via a sustain cycle, NOT by dodging:
1. **Iudex A2 [Strengthen] −25%** on all → every boss hit (incl. Scorch) is ×0.75.
2. **Mikey [Shield] 300%·ATK on every hit** + evade + [Taunt] (draws single-target).
3. **Hilve A3 AoE-revive** (all dead back @50%) + **[Block Damage] all 1t** (negates the next hit) + Inc-SPD.
4. **Iudex A3 single-revive** (+ revived ally acts) and **A1 heal** (5% maxHP all).
5. **Ezio** 35%-nullify big hits + [Perfect Veil] (single-target immunity; boss AoE still hits).
6. **Xeno** self-revives on Infest deaths (waves) → enters boss near full.

## Damage-to-boss engine
- **Xeno [Poison]** (5%·2.31M·×0.70 boss-resist = 81k/stack/tick, DEF-independent) — dominant; +Ezio A2 two
  Poison + Poison Sensitivity + instant-activate; Xeno A3 scales +15%/poison.
- **Direct** (ATK vs boss DEF 3,982, ×0.7/1.0/1.3 affinity) amplified by **Decrease DEF** (Mikey A2, Ezio A1,
  Hilve A1 all place 60%) + **Xeno passive −20% DEF** while poisoned. Ezio A3 ignores 35% DEF. Ezio execute <25%.

## Open (⚙ confirm with Mike as we walk — the 5 questions)
1. Boss rotation order (Swipe / Wall of Fire / Inhale priority).
2. Purple-bar SIZE + clear rule (reality Scorches 3-4× → bar not cleared each cycle).
3. Scorch escalation (0.25→0.5→0.75×maxHP, or flat 0.25×?).
4. # Scorches + boss-phase length in a typical win.
5. Ezio veil down in the boss phase (confirmed — lapses once waves gone). Xeno A3 base multiplier.
