# Hand-calc kit spec — DonaHilvi Dragon's Lair Stage 20 (Ezio-Xeno team)

Every clause of every skill, from verbatim `champion_skills`, mapped to **MODEL** (how) / **DEFER** (why).
Format mirrors `KITS.md` (the CB reference). Team: Michelangelo, Xenomorph, Ezio Auditore, Hilvi, Iudex Artor.
Leader = **Michelangelo (ACC aura)**. Built from `cb.mjs` as the code template.

Legend: 🟢 modeled · 🟡 partial · 🔴 deferred · ⚠ = I got this wrong in the patched draft.

---

## Boss — Hellrazor, st20 (confirmed data)
HP **2,314,665** · ATK **11,947** · DEF **3,982** · SPD **100** · RES/ACC **200** · crit 15/50 · **MAGIC**.
Immune to **Stun / Freeze / Sleep / Provoke / Fear / True Fear + Decrease TM / Decrease SPD** → every CC clause
below is INERT vs the boss.

**Kit (DRAGON_REVIEW):**
- **Swipe** — AoE 3×ATK + 50% [Decrease ATK] 2t on all allies.
- **Wall of Fire** (cd3) — AoE 3.4×ATK + two 5% [Poison] 3t + 25% [Weaken] 2t on all allies.
- **Inhale** (cd3) — drains own Turn Meter, arms **Scorch**, turns part of HP purple (the "purple bar").
- **Scorch** (fires next boss turn IF the purple bar was NOT cleared) — %MaxHP AoE + 1-turn [Stun]; clearing the
  bar first → Scorch interrupted, boss turn WASTED (TM→0). ⭐ Scorch pierces [Veil] (it's AoE/%MaxHP).
- ⚙ **OPEN (confirm w/ Mike as we walk):** (1) rotation order Swipe/WoF/Inhale; (2) **purple-bar SIZE** (reality
  Scorches 3-4× → NOT cleared each cycle); (3) Scorch escalation (0.25→0.5→0.75×maxHP or flat 0.25×?);
  (4) # Scorches / boss-phase length.
- **ANCHOR:** Scorch on Ezio (Strengthen up, veil DOWN) = **5,841** = 0.25·maxHP·0.75 ✓.

---

## Cross-cutting mechanics (apply to everyone)
- **Decrease DEF = lasting TEAM-WIDE multiplier** (not per-hit ignore): Mikey A2, Ezio A1, Hilvi A1 each place
  60% (no stack, max 60%, 2t). While up, **every ally's direct-attack damage** rises via `bossDef()`. ⚠ my draft
  did this per-caster.
- **Xeno passive −20% boss DEF while the boss is poisoned** — separate from Decrease DEF, in `bossDef()`. ⚠ missed.
- **Shared 10-debuff cap** — poison + Weaken + Dec-DEF + Leech + Dec-ATK compete for 10 slots. On the boss the
  DoT is POISON only (see below). 🟡 account for it (`room = 10 − dotWeight`).
- **Poison on the boss is CAPPED** (Hellrazor damage-resistance passive): **POISON_TICK = 46,293 per 5%-stack**
  (Mike first-party = 2% of boss maxHP = the 5% poison reduced to 40%). DEF-independent, ticks on the boss's turn,
  ×1.25 under [Poison Sensitivity] (Ezio A2). ⚠ my draft used 81k (5%·maxHP·0.70) uncapped → boss melted 2× fast.
- **NO HP-Burn on the boss** — the team's only HP-Burn source is Hilvi's Divine Mission (triggers on [Freeze]);
  the boss can't be frozen → no HP-Burn. So boss DoT = Xeno/Ezio POISON only.
- **Affinity (boss is MAGIC):** Spirit (Mikey/Ezio/Iudex) deal ×0.7 / take ×1.3; Xeno (Magic) ×1.0; Hilvi (Force)
  deal ×1.3 / take ×0.7. Applies to ATK-based hits only (DoT + %MaxHP Scorch are affinity-independent).
- **DEF-mitigation LEVEL = the DEFENDER's (L60)** both directions here: enemy→champ validated (Crossbowman
  13,200 = L60); champ→boss uses champ L60 (as `cb.mjs` does champ hits at L60). Boss ATK hits on allies use
  `defMit(allyDef, 60)`.
- **Perfect Veil** (Xeno A1/A3 self, Ezio round-start) = untargetable by SINGLE-target only; boss AoE/Scorch hit
  through it. Ezio's lapses in the boss phase (Mike: veil DOWN when Scorch fires).
- ⚙ **Warmaster / masteries** — does Mikey (or anyone) run Warmaster/Giant Slayer on this team? WM = capped
  %MaxHP bonus per attack vs the boss. NEEDS the mastery data + the Dragon WM cap. 🔴 flag.

---

## SURVIVAL ENGINE (why the team lives — waves AND boss)
- **Xeno [Perfect Veil] — ~PERMANENT** (re-applied on A1 Tail Stab AND A3 Rip and Claw, both 2t; he acts
  constantly). Untargetable by single-target → dodges every single-target WAVE attack — why his taken is only
  ~30k and he survives. ⚙ **Does Hellrazor have any SINGLE-TARGET attack?** If yes, Xeno's permanent veil dodges
  it while Ezio's LAPSED veil (boss phase) eats it → the likely reason Xeno lives / Ezio dies.
- **Ezio** — [Perfect Veil] turns 1-2 of each Round but it **LAPSES in the boss phase** (Mike: down when Scorch
  hits); **35% nullify** a >50%-MaxHP hit (EV ×0.65 on qualifying hits).
- **Iudex** — A2 **[Strengthen] −25%** all (Scorch/Swipe/WoF mitigation) + A1 heal 5% + A3 single-revive.
- **Mikey** — **[Shield]=300%·ATK (~5,838) on being hit** + [Taunt] (draws single-target) + evade 15/30%.
- **Hilvi A3** — revive ALL dead + **[Block Damage] all 1t** (negates the next Scorch) + Inc-SPD (the sustain
  engine Mike witnessed).
- **Affinity compounds who dies**: Xeno (Magic) takes ×1.0, Hilvi (Force) ×0.7, the Spirit trio ×1.3.

---

## Michelangelo (Spirit) — off-tank + Dec-DEF
- **A1 Boo-Yah!** (cd0, 2×ATK ×2 hits) 🟢; crit → 50% [Increase ATK] self 2t 🟢.
- **A2 Express Delivery!** (cd4, 6×ATK) 🟢 direct; 75% **[Decrease DEF] 60% 2t** (team-wide) 🟢; 75% [Stun] 🔴 boss
  immune; crit → ignore 25% RES 🟡; [Debuff Spread] 🔴 single enemy.
- **A3 Shell Cyclone** (cd5, 5×ATK AoE→boss) 🟢; 75% 50% [Decrease ATK] on boss 2t (survival, cuts boss ATK) 🟢 +
  [Leech] 2t (team heals 18% of direct) 🟢; **[Taunt] self 2t** 🟢 (draws single-target).
- **A4 Party Dude [P]** — 15% Evade (30% under Taunt) 🟢; **[Shield]=300%·ATK (≈5,838) self on being hit** 🟢;
  Turtle join-attack 🔴 no other Turtles.

## Xenomorph (Magic) — poison engine + self-revive
- **A1 Tail Stab** (cd0, 3.9×ATK) 🟢; 5% [Poison] 2t, **3 if crit** (EV 1+2·critRate) 🟢; [Perfect Veil] self 2t 🟢.
- **A2 Infestation** (cd4, 5.9×ATK) 🟢 direct; [Stun]+[Infest] on boss 🔴 immune/capped; [True Fear] others 🔴 none;
  **[P] self-revive 50% HP/TM when an [Infest]ed enemy dies** 🟢 (WAVES only — boss Infest capped/irrelevant).
- **A3 Rip and Claw** (cd4, 2 hits × ⚙ base mult — CB used 3×; CONFIRM) 🟢 × (1 + 0.15·poison stacks on boss); veil 🟢.
- **Passive Caustic Blood** — **−20% boss DEF while poisoned** 🟢 (in `bossDef()`); 25% counter-poison when hit 🟡.

## Ezio Auditore (Spirit) — poison + self-protect
- **A1 Eagle Dive** (cd0, 4×ATK) 🟢; 75% **[Decrease DEF] 60% 2t** (team-wide; unresist. under Veil) 🟢.
- **A2 Da Vinci's Design** (cd4, 4×ATK AoE→boss) 🟢; 75% two 5% [Poison] + 25% [Poison Sensitivity] 2t 🟢;
  **instantly activates all [Poison] if boss ≥4 debuffs** 🟡 (per CB note: model as persist+normal-tick, no bonus).
- **A3 Hidden Gun** (cd4, 5×ATK) 🟢; **ignore 35% DEF + [Shield]/[Strengthen]** 🟢; steal buffs 🟡.
- **Passive Everything Is Permitted** — execute: boss HP <25% after any Assassin's damage → bonus ∝ Ezio ATK,
  ignore 100% DEF, no crit 🟡 (fires in the boss's final 25% — real damage, model it).
- **Passive 2 Full Synchronization** — [Perfect Veil] self 2t each Round 🟡; **35% nullify a >50%-MaxHP hit** 🟢
  (EV ×0.65 on qualifying hits); 35% counterattack 🔴.

## Hilvi (Force) — freeze-control + **AoE REVIVE** (boss survival engine)
- **A1 Frostflame Torch** (cd0, 2.6×ATK ×2) 🟢; each hit 50% [Decrease DEF] 60% 2t 🟢.
- **A2 Embittering Cold** (cd5) — strip all enemy buffs + [Freeze] all 1t 🔴 (Freeze inert vs boss → buff-strip
  only); passive Divine Mission HP-Burn-on-freeze 🔴 inert vs boss.
- **A3 Ward Of The Glacier** (cd6) — **REVIVE all dead @50% HP + 30% TM; [Block Damage] all 1t + 30% [Inc-SPD]
  all 2t** (buffs land even w/ no revive; if none revived +25% TM all) 🟢. ⭐ the sustain engine (Mike witnessed).
- **Passive Divine Mission** — Freeze→steal+HP-Burn+−10%TM 🔴 inert vs boss.

## Iudex Artor (Spirit) — heal / buff / single-revive
- **A1 Censer Whirl** (cd0, 3.4×ATK AoE→boss) 🟢; heal all allies 5% of Iudex maxHP 🟢.
- **A2 Incense of Inspiration** (cd5) — **50% [Increase ATK] + 25% [Strengthen] all 2t** (Strengthen −25% dmg
  taken = Scorch/Swipe/WoF mitigation, anchor 5,841) 🟢; +15% TM all 🟢.
- **A3 Revival Mandate** (cd6) — revive 1 ally 50% HP/TM + 50% [Inc-ATK] 1t; **then revived ally casts default
  skill at lowest-HP enemy** 🟡.
- **A4 Sentenced to Life [P]** (cd4) — revived ally's default kills → reset A3 cd 🔴 (rare vs boss).

---

## Build order (code, cloning cb.mjs)
1. `build(name)` from DonaHilvi snapshot via `effectiveFromRaw`; confirmed current gear as `REALSTATS` override.
2. Boss block above; affinity Magic; `defMit`/`critEV`/`bossDef()`(Dec-DEF+Xeno−20%)/affinity/POISON_TICK=46293.
3. `actChamp` = the kits above, verbatim.
4. `actBoss` = Swipe/WoF/Inhale/Scorch + purple bar; `incoming()` survival stack (Strengthen/shield/BlockDamage/
   nullify/evade); revives (Hilvi AoE, Iudex single).
5. Walk turn-by-turn; reconcile turns ≈121, WR ≈91%, Scorch count, per-hero taken/dealt, death/revive sequence.
