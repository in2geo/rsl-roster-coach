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

### AMPLIFICATION — multiply others' output
`Decrease Defense` · `AoE Decrease Defense` · `Weaken` · `Poison Sensitivity` ·
`Increase Debuff Duration` · `Debuff Activation` · `Counterattack` · `Ally Attack` ·
`Increase Attack` · `Increase C.Rate` · `Increase C.DMG` · **`Increase ACC`** (RULED)

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

**PROPOSED dead, NOT yet confirmed by Mike** — stated from general game knowledge, NOT from anything
in this repo, so treat as unverified. This list is where a wrong entry does the most damage: it
silently zeroes a real capability.
`Freeze` · `AoE Freeze` · `Sleep` · `AoE Sleep` · `Stun` · `AoE Stun` · `Provoke` · `Fear` ·
`True Fear` · `Sheep` · `Petrification` · `Ensnare` · `Seal` · `Master Seal` · `Hex` ·
`Decrease Turn Meter` · `AoE Decrease Turn Meter` · `Block Revive`

(This list is what would correctly explain Gnut — his `Freeze` + `Decrease Turn Meter` are dead here.)

## CAPABILITY CLASSES WITH NO REPRESENTATION (found via Pelops, 2026-07-18)

Pelops is the account's best CB champion and the two things that make him one are both INVISIBLE to
the tag layer. Read his kit (verbatim, `champion_skills`): Taunt pulls the boss's hits onto him;
`Master of Games [P]` is **immune to [Stun]/[HP Burn]/[Petrification]** and places **[HP Burn] on any
enemy that attacks him (100%)**; then A1's [Decrease ATK] and A2's effects **"cannot be resisted"**
while the target is under that HP Burn. So he converts incoming damage into DoT, and his mitigation
bypasses resistance entirely.

1. **Self-protection / immunity.** Tag policy #10 rejects "immune to [X]" — right for PLACEMENT, but
   it leaves immunity unrepresentable. A champion who cannot be stunned is genuinely worth more on
   content that stuns; the pool cannot say so.
2. **Damage-on-being-hit.** HP Burn-on-attack has no tag. `Counterattack` is a different mechanic.
3. **Unresistable debuffs (policy #17) are not scored.** The engine discounts every debuff by ACC,
   but Pelops's key Decrease ATK cannot be resisted (via a debuff he self-applies), so his ACC 214 is
   near-irrelevant to his most important contribution. The ACC gate needs a bypass exception.

**DATA BUG (owed as a seed):** every Pelops `champion_skills` row has `ascension_required = 0`,
including the passive — but CLAUDE.md lists him under **yellow-star-screenshot CONFIRMED** as
`Master of Games [P]: ascension_required = 3`. The confirmed ruling never reached the DB. No impact
on Mike's account (his Pelops IS ascended), but on any account with an unascended Pelops the model
credits immunity + the HP Burn engine + the unresistable Decrease ATK that he does not have.

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
4. `Intercept` — **DEFERRED by Mike ("leave for now")**; stays in Sustain/absorption meanwhile.
   Still open: `Ally Protection`, `Pain Link`.
5. ~~The shield boundary~~ **RULED: shields STAY in Sustain.** So the Mitigation/Sustain line is NOT
   simply before-vs-after: Mitigation = change how much damage EXISTS or WHERE IT GOES (Dec ATK, Inc
   DEF/RES, Taunt); Sustain = a RESOURCE you spend absorbing or repairing what arrives (shield, heal,
   revive). A shield is healing paid in advance. Sustain therefore keeps all three sub-mechanisms
   (absorption / restoration / recovery), which matters for its share: 15% (~0.75 seats) only works
   because multi-role champions exist — Pallas alone covers all three.
6. Confirm the PROPOSED-dead list above.
7. Shape past 100%: does a full bucket go FLAT or DECLINE? The Tagoar/Fahrakin case suggests decline
   (an over-full sustain bucket actively cost damage).
