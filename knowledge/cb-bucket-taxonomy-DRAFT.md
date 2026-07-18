# Clan Boss BUCKET TAXONOMY — working draft (Mike's rulings, 2026-07-18)

**STATUS: IN PROGRESS — being decided live with Mike. Not authoritative yet, not wired to any code.**
Captured here as we go so the rulings don't die in conversation (tag policy #18: analysis that lives
only in chat is orphaned).

## The model this serves

Replaces the current ORDINAL weights (each need has a weight; a 2nd carrier gets an arbitrary 0.25x
haircut; nothing sums to anything) with a CARDINAL BUDGET: the pool is 100% of what a team can be,
split into shares by how much each job matters on the content. Champions FILL buckets by measurable
amount. Grade = how well actual fill matches the target allocation — "all the parts make a whole."

Why: the 0.25x cliff produced three wrong benchings in one session — a Revive-only champ satisfying
the whole sustain seat; Tagoar priced at 0.25x then MEASURED delivering 28% of team healing; Gnut
(L60 6*, carrying the top-weighted need) discarded because someone else ticked the box first.
A budget also makes over-supply visible: this account healed 2.7x more than it took.

## Top-level buckets (6) — Mike, 2026-07-18

**Mitigation · Sustain · Damage · Amplification · Cleanse · Tempo**

- **Mitigation gets its own spot** (ruled) — on CB it is dual-purpose: cuts incoming damage AND
  extends the fight, and a longer fight multiplies every other bucket. Nesting it under Sustain
  would hide the damage half.
- Sustain keeps an INTERNAL split (absorption / restoration / recovery) — real structure, but one
  level down, so the top level stays six readable numbers.

### Implied allocation of the CURRENT model (weights normalized) — the thing being replaced
| Bucket | Implied share |
|---|---|
| Sustain | 30.4% |
| Amplification | 19.5% |
| Mitigation | 18.3% |
| Damage | 14.7% |
| Cleanse | 11.0% |
| Tempo | 6.1% |

Sustain is the BIGGEST share despite Mitigation carrying the single highest weight — an artifact of
splitting sustain into three roles without looking at the aggregate. Consistent with the measured
2.7x overheal.

### TARGET ALLOCATION — RULED by Mike 2026-07-18
| Bucket | Share | ~Seats (20% = 1 champion) |
|---|---|---|
| Mitigation | 20% | 1.0 |
| Damage | 20% | 1.0 |
| **Tempo** | **20%** | **1.0** |
| Sustain | 15% | 0.75 |
| Amplification | 15% | 0.75 |
| Cleanse | 10% | 0.5 |
| **total** | **100%** | **exactly 5.0** |

Coherent by construction: six jobs fitting five champions, the fractional buckets being the ones
multi-role champions absorb (Pallas alone covers Tempo + all three Sustain sub-mechanisms + Cleanse).

**Tempo at 20% is the headline change** (was 6.1% implied, and Claude first proposed 5%). Mike:
*"speed is the most important stat in the game, top to bottom in all content. The first piece of any
team should be who handles your tempo... which is why High Khatun gets used even for accounts that
have 30 legendary champs."* The share sets the GRADE penalty for lacking tempo; the separate
gear-conditional REQUIREMENT forces the seat in selection. Two mechanisms, two jobs.

**Sustain 15% (was 30.4% implied) is the other big move** — it encodes Mike's read that one good
sustain champion should fill the bucket and a second overflows it. Matches the measured 2.7x overheal
and predicts the build-conditional flip on its own (under-built, Pallas alone does NOT fill 15% so a
second sustain earns the seat; built, she does, and the seat converts to damage).

## Bucket contents

### MITIGATION — reduce the damage that actually reaches your team
`Decrease Attack` · `Decrease C.Rate` · `Decrease C.DMG` · `Decrease ACC` · `Fatigue` ·
**`Taunt`** (RULED) · **`Increase Defense`** (RULED) · **`Increase RES`** (RULED)

**PRINCIPLE established by the Inc DEF / Inc RES ruling:** Mitigation is NOT "debuffs on the boss" —
it is **damage prevention on either side of the exchange**. Lowering his output and raising your
resilience are the same job. Sustain is then strictly about *recovering or absorbing what already got
through*. The clean test: does it act BEFORE the damage lands (Mitigation) or AFTER (Sustain)?
`Increase RES` fits especially well — it stops the boss's debuffs landing at all, and it is the exact
mirror of `Decrease ACC` on the boss, already in this bucket.

### SUSTAIN — keep the team alive
- absorption: `Shield` · `AoE Shield` · `Ally Protection`* · `Block Damage` · `Unkillable` ·
  `Intercept`* · `Stone Skin` · `Magma Shield` · `Life Barrier` · `Total Guard` · `Fortify` · `Immutable`
- restoration: `Healer` · `AoE Heal` · `Continuous Heal` · `Leech`
- recovery: `Revive` · `Revive on Death`

### DAMAGE
- Lane A (DoT, DEF-independent): `Poison` · `HP Burn` · `Poison Cloud` · `Necrosis` ·
  `Enemy Max HP Damage` · `Poison Explosion`
- Lane B (attack + mastery): `Single Target Damage` · `AoE Damage` · `Multi-Hit A1`
- Lane C — **damage on being hit** (RULED: "reflect is real damage"): **`Reflect Damage`**.
  Consequence worth noting: this gives a home to the Pelops mechanic that had none — his passive
  places [HP Burn] on any enemy that attacks him, which is the same shape as Reflect (incoming
  attacks converted into outgoing damage) and currently has NO tag at all. A Taunt champion with a
  damage-on-hit passive is deliberately maximizing this lane, which is why Pelops reads as both
  Mitigation and Damage. Needs a tag before the bucket can actually score it.

### AMPLIFICATION — make EXISTING damage bigger
`Decrease Defense` · `AoE Decrease Defense` · `Weaken` · `Poison Sensitivity` ·
`Increase Debuff Duration` · `Debuff Activation` ·
`Increase Attack` · `Increase C.Rate` · `Increase C.DMG` · **`Increase ACC`** (RULED)

**BOUNDARY (RULED 2026-07-18, prompted by an external review):** Damage **generates** damage;
Amplification **multiplies** it. `Counterattack` and `Ally Attack` MOVED OUT of here into Damage —
they produce attacks rather than scaling them. Counterattack is the same mechanic as `Reflect Damage`
(damage on being hit), already ruled into Damage, so one concept was living in two buckets. The loose
boundary also inflated Amplification (182-220% on every captured team) while starving Damage, which
is the bucket the winning teams actually loaded. Reviewer's wording: "make sure the definition is
tight... if the scorer is putting anything that touches damage here, the boundary will matter when
you're comparing teams." 

**PRINCIPLE established by the Increase ACC ruling:** a champion's OWN ACC stat is a **gate** (build
state, discounts what they deliver); an `Increase ACC` **buff they place** is a contributed
**capability** and belongs in the pool. Stat != buff. Same logic covers the other stat buffs.

### CLEANSE — restore team function
`Cleanse` · `Block Debuffs`

### TEMPO — turns and speed
`Increase Speed` · `Increase Turn Meter` · `Fervor` · `Reset Cooldowns` · **`Decrease Speed`** (RULED
— on the BOSS. Turn economy, not damage reduction: it changes the ratio of your turns to his. Note
this makes Tempo two-sided — buffing your side and slowing his are the same bucket.)

### DEAD ON CB — no bucket, contributes nothing
**RULED dead:** `Buff Strip` · `Steal Buffs` (boss carries no buffs worth removing — note this
zeroes part of Ezio's and Pelops's kits).

**RULED DEAD by Mike 2026-07-18** (was Claude-proposed from general game knowledge; now confirmed —
this list is where a wrong entry does the most damage, since it silently zeroes a real capability):
`Freeze` · `AoE Freeze` · `Sleep` · `AoE Sleep` · `Stun` · `AoE Stun` · `Provoke` · `Fear` ·
`True Fear` · `Sheep` · `Petrification` · `Ensnare` · `Seal` · `Master Seal` · `Hex` ·
`Decrease Turn Meter` · `AoE Decrease Turn Meter` · `Block Revive`

**Consequence — CC is worthless on CB, and that is a big deal for scoring.** It is roughly a third of
Gnut's kit (`Freeze` + `Decrease Turn Meter`) and part of Pelops's (`Stun`, `Provoke`, `Petrification`
— note his passive PLACES Petrification on attackers, which is dead here even though the passive's
HP Burn half is not). Previously these scored zero only by ACCIDENT — they simply were not listed in
any CB need — so the engine got the right answer with no understanding behind it and would mis-handle
the same case on other content. Now it is an explicit rule.

(This list is what would correctly explain Gnut — his `Freeze` + `Decrease Turn Meter` are dead here.)

## CAPABILITY CLASSES WITH NO REPRESENTATION (found via Pelops, 2026-07-18)

Pelops is the account's best CB champion and the two things that make him one are both INVISIBLE to
the tag layer. Read his kit (verbatim, `champion_skills`): Taunt pulls the boss's hits onto him;
`Master of Games [P]` is **immune to [Stun]/[HP Burn]/[Petrification]** and places **[HP Burn] on any
enemy that attacks him (100%)**; then A1's [Decrease ATK] and A2's effects **"cannot be resisted"**
while the target is under that HP Burn. So he converts incoming damage into DoT, and his mitigation
bypasses resistance entirely.

1. **Self-protection / immunity → MITIGATION, at SMALL weight (RULED, Mike 2026-07-18).** It is damage
   prevention, so it belongs in Mitigation — but it protects ONE champion where a team-wide mitigation
   protects five, so it is "a small contributor."

   **THE GENERAL RULE THIS ESTABLISHES — SCOPE SCALES CONTRIBUTION.** The same *kind* of effect is worth
   far less when it is self-only than when it is team-wide. Natural anchor: 1-of-5 seats ~= 0.2 of the
   team-wide equivalent (derived, not ruled). This is NOT immunity-specific — it covers self-heal,
   self-shield, self-veil, self-buff of any kind.

   **It retroactively explains the Gnut case and would have caught it automatically:** Gnut posted the
   day's largest healing (1,392,073) and the team died SOONER with him (177 turns vs 210), because it
   was SELF-healing (A3 heals him 30% of damage dealt, plus Lifesteal gear). A scope multiplier
   discounts that to ~a fifth without anyone noticing by hand. Same principle, different bucket.

   **Still unscorable:** tag policy #10 rejects "immune to [X]" as a placement — correct, but it means
   no tag exists to hang this on. Needs either a new vocab tag or a policy amendment (a #12/#19-style
   "reject the placement, tag the real action" fix) before the bucket can score it.
2. **Damage-on-being-hit → DAMAGE (RULED, Mike 2026-07-18).** Placement settled: it goes in the Damage
   bucket with `Reflect Damage` (Lane C). What is MISSING is a TAG — Pelops's passive places [HP Burn]
   on any enemy that attacks him and nothing in the 108-tag vocab covers "places a debuff on whatever
   attacks me." `Counterattack` is a different mechanic (it makes YOU swing back).

   **Same vocabulary gap as immunity above, and the same shape as policies #12 / #19:** the bracket was
   correctly rejected as a placement and the REAL ACTION was never relocated to a tag of its own. One
   piece of tag work covers both, and until it lands the Damage bucket cannot score the mechanic that
   makes Pelops a Taunt-plus-damage engine rather than just a tank.
3. **Unresistable debuffs (policy #17) are not scored.** The engine discounts every debuff by ACC,
   but Pelops's key Decrease ATK cannot be resisted (via a debuff he self-applies), so his ACC 214 is
   near-irrelevant to his most important contribution. The ACC gate needs a bypass exception.

**DATA BUG (owed as a seed):** every Pelops `champion_skills` row has `ascension_required = 0`,
including the passive — but CLAUDE.md lists him under **yellow-star-screenshot CONFIRMED** as
`Master of Games [P]: ascension_required = 3`. The confirmed ruling never reached the DB. No impact
on Mike's account (his Pelops IS ascended), but on any account with an unascended Pelops the model
credits immunity + the HP Burn engine + the unresistable Decrease ATK that he does not have.

## AURAS — a GAP-FILLER against the binding gate, never a bucket (Mike, RULED 2026-07-18)

**`SPD Aura` does NOT satisfy the Tempo bucket.** Mike: *"speed aura does not satisfy tempo bucket. it
should be used to get the team over the hump if needed. that should be the general strategy for auras.
what are we missing to maximize our score? is it more speed, more accuracy, more resist, more HP."*

**The principle:** an aura boosts a STAT, and stats are GATES, not buckets. So an aura never FILLS a
bucket — it raises the DELIVERY multiplier on buckets already filled. It is therefore chosen LAST, after
the five seats, against whichever gate is actually binding. Consistent with the Increase-ACC ruling
(stat = gate, buff = capability): an aura is a stat, so it is a gate.

**THE GATE ONLY BINDS WHERE A CHAMPION CARRIES GATED CAPABILITY.** Worked live on the Don$Gnut CB team
(Brutal, ACC floor 150) — and this corrected a naive "4 of 5 are below the floor" reading:
| | ACC | Binding? |
|---|---|---|
| Ezio | 85 | **57% land** — gates Decrease Defense, Poison, Poison Sensitivity |
| Narma | 112 | **75% land** — gates Poison, Decrease Attack, Poison Sensitivity |
| Pelops | 214 | 100% — fine |
| Pallas | 30 | **IRRELEVANT** — no live debuffs, pure buffs/heals |
| Tagoar | 47 | **IRRELEVANT** — same |

So the binding constraint is ACC **on Ezio**, and the evidence says it is expensive: Pelops dropped
9.00M → 7.15M when Ezio was swapped out, so ~43% of that amplification is currently resisting off.
Not speed, not RES (115-137, not the limiter), not HP (sustain already 2.7x over-supplied).

**AND THE AURA CANNOT ALWAYS FIX IT — check `aura_area`.** The team's only ACC aura (Narma, 80 ACC) is
**"Dungeons" and does NOT apply on Clan Boss**. Available on CB: Ezio 19% SPD, Pelops 60 RES, Pallas
50 RES, Tagoar 25% HP (all "All Battles"). So the binding gate is unreachable by aura here and the fix
is GEAR. The aura layer must be able to say *"nothing available relieves your binding gate — this is a
gear problem"* rather than silently picking the least-bad option and looking satisfied.

## NOT buckets — gates and constraints (keeps the pool from becoming a junk drawer)
- **Champion's own ACC** — a gate on every debuff bucket. Gnut's ACC 40 vs the Brutal floor 150 is a
  27% discount on what he delivers, not a missing share.
- **Masteries / gear** — multipliers on delivery. (Fahrakin's ally attack is worth ~4x more on a
  mastered team; this account has boss masteries on Pelops ONLY, 1 of 32.)
- **Leader aura** — one slot, team-wide modifier, doesn't trade against the others.
- **The 10-debuff cap** — a CONSTRAINT: a ceiling on how much Amplification + DoT can coexist.

## STILL OPEN — awaiting Mike
1. **The target percentages themselves.** Mitigation gets the biggest chunk (ruled). Rest unset.
2. `Increase Defense` / `Increase RES` — Sustain or Mitigation? (RES stops debuffs landing at all =
   prevention, and is the mirror of `Decrease ACC` on the boss, which IS Mitigation.)
4. ~~Redirect siblings~~ **RULED 2026-07-18: `Ally Protection` and `Pain Link` STAY IN SUSTAIN**
   (`Intercept` was deferred earlier and stays there too). So `Taunt` is the deliberate OUTLIER of the
   redirect family, and the line is: **Taunt controls WHO THE BOSS TARGETS** — it changes the boss's
   behaviour before damage is dealt, which is prevention → Mitigation. Ally Protection / Intercept /
   Pain Link **redistribute damage that is already incoming** — the boss still picks its target and
   still swings; they just move where the hit lands. That is spending a resource on damage that
   arrived → Sustain, same reasoning that kept shields there.
5. ~~The shield boundary~~ **RULED: shields STAY in Sustain.** So the Mitigation/Sustain line is NOT
   simply before-vs-after: Mitigation = change how much damage EXISTS or WHERE IT GOES (Dec ATK, Inc
   DEF/RES, Taunt); Sustain = a RESOURCE you spend absorbing or repairing what arrives (shield, heal,
   revive). A shield is healing paid in advance. Sustain therefore keeps all three sub-mechanisms
   (absorption / restoration / recovery), which matters for its share: 15% (~0.75 seats) only works
   because multi-role champions exist — Pallas alone covers all three.
6. Confirm the PROPOSED-dead list above.
7. Shape past 100%: does a full bucket go FLAT or DECLINE? The Tagoar/Fahrakin case suggests decline
   (an over-full sustain bucket actively cost damage).
