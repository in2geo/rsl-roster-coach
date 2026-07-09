# RSL Coach — Known Gaps

Operational gaps and known-wrong/low-confidence areas. Findable and scannable when
debugging a wrong verdict. Delete entries as gaps close — don't leave stale notes.

Last updated: 2026-07-07 (video-skill-screenshots branch — Dragon affinity rotation corrected).

## Data gaps

### HP/RES floor calibration (medium priority — single data point)
Ice Golem stages 10-13 HP floor was recalibrated 25,000 → **8,000** (seed 19,
commit `8f939fc`), because the DonCobb07 4W/1L Ice Golem 10 clear has team-min HP
9,118 (Kael) — 25,000 was a proven false negative. **8,000 is derived from ONE
run**, so it's preliminary: it's a conservative floor that doesn't exclude the
known clear, not a calibrated value. Refine (and calibrate RES floors similarly)
as more battle-log data points accumulate. RES floors are still original judgment
calls with no battle-log evidence yet.

### Clan Boss chest-tier thresholds (source = screenshots, July 2026)
`clan_boss_chest_tiers` (seed 26) damage→chest thresholds for all six difficulties were
captured from in-game **rewards-screen screenshots in July 2026**, not an official data
source. Plarium periodically rebalances Clan Boss rewards — **re-verify these thresholds
if CB rewards change** (a rebalance would silently mis-tier every scored run). The chest
NAMES are also baked into the `recommendation_outcomes.outcome` CHECK constraint, so a
rename would need a migration too. `captured_at` on each row records when they were taken.

### ascension_required — no automated source; manual from the in-game Index
Per-skill ascension-unlock requirements (`champion_tags.ascension_required`) have **no
compliant automated source** (established 2026-07-02):
- raid.guide doesn't list ascension unlocks (see `scrape-champion-tags.js`).
- The in-game padlock ("Unlocks at Ascension Level N") is only visible on an **owned,
  not-yet-ascended** champion — it disappears once ascended, and unowned champions can't
  be checked at all.
- The game HAS the value, but only in transient UI-context objects (`UnlockOnAscendLevel`
  in `AscendSkillInfoContext`/`HeroSkillInfoContext` — computed, needs ownership + object-
  graph RE) and as effect-condition **formulas** (`ownersAscendLevel>=N`) in the static-
  data (needs DSL decode, partial cache). Plarium's API would have it, but network
  interception is off-limits (no-injection boundary).

So it's captured **manually from the in-game Index** and recorded in
`seeds/31_ascension_overrides.sql` — the durable, growable source of truth (mirrored in
`scrape-champion-tags.js` `ASCENSION_OVERRIDES` for raid.guide-scraped champions). Gated
skills are a minority (mostly passives), so the list grows slowly. A `--skills` memory
reader was prototyped and **shelved** — even working it needs ownership and hit an object-
graph wall (the `ISettableContext<Params>` struct is consumed on set, not heap-scannable).
The nested-class resolver from that effort (`Il2CppClassResolver.ResolveNested`) was kept.

### champion_solo_profiles affinity / stage-label errors in seeds/06 (audit — verify per champion from in-game)
Reference — RAID affinity colour map (icon next to the champion name):
**Magic = blue, Force = red, Spirit = green, Void = purple.** Affinity wheel
(repo-anchored, seed 35 line 65): **Magic > Spirit > Force > Magic; Void neutral**
(Magic strong vs Spirit, Spirit strong vs Force, Force strong vs Magic).

Artak was seeded as Spirit in `seeds/06_solo_carry_proposals.sql` but his in-game icon is
**blue = Magic**. Fixed (seed 41 creates his champions row as Magic; his 7 solo entries in
seed 06 were corrected). Verified from video since then:

- **Ezio Auditore** — icon is **green = Spirit**, so seed 07's `affinity='Spirit'` is
  CORRECT (no change needed; an earlier draft wrongly read the green icon as Force). FIXED
  2026-07-07: (a) faction `Shadowkin` → `Sacred Order` (seed 07 at source + idempotent
  UPDATE in seed 42 for live rows) per the in-game detail screen; (b) seed 06 solo lookups
  `where name = 'Ezio'` → `'Ezio Auditore'` (previously bound to NULL). Ezio proposed tags
  added in seed 42. Only the shared Stage-25 label question below still applies to Ezio.

- **Michelangelo** — icon is **green = Spirit** (not Force as seeded). FIXED 2026-07-07:
  affinity Force→Spirit + faction Shadowkin→Banner Lords (seed 07 + seed 46 UPDATE); solo
  reasoning corrected. Skill tags in seed 46.

Still UNVERIFIED — champion AFFINITY not confirmed from a video (don't trust seed 06's label):
- **Teodor the Savant** (Legendary / "Spirit") — Dragon Stage 25 (~line 415).
- **Richtoff the Bold** (Legendary / "Spirit") — Dragon Stage 25 (~line 575).
  Their Stage-25 entries are now STAGE-correct (25 = Force, confirmed below), so a Spirit
  champion would indeed be advantaged there — but whether these two ARE Spirit is unverified.

### Dragon's Lair Normal affinity rotation — CONFIRMED from in-game (2026-07-07), repo was wrong
Read directly off the in-game stage list. The real rotation is **Magic → Force → Spirit →
Void** for floors 1–19 (i.e. (N−1) mod 4 = 0:M, 1:F, 2:S, 3:V), then **irregular** from 20:

| 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|
| F  | S  | V  | M  | F  | S  | V  | M  | F  | S  | **M** | F | **M** | V | S | **F** |

The repo previously had Force/Spirit **swapped** (it listed 10=Magic, 12=Force, 13=Void…) and
Stage 20 = Force. FIXED 2026-07-07 in **seed 32** (stage notes), **seed 35** (boss_exceptions
notes), and **seed 06** (dungeon_stages notes + the Artak/Michelangelo solo reasoning). Key
corrections: **Stage 20 = Magic** (was Force) and **Stage 25 = Force** (an earlier KNOWN_GAPS
note wrongly said Void — that was based on extrapolating a clean cycle that doesn't hold past
floor 19; the in-game list confirms Force). Floors 1–9 also follow the clean cycle
(1=M,2=F,3=S,4=V…); 6/7 not individually re-read but within the confirmed clean run.
STILL UNVERIFIED: **Dragon HARD-mode** affinities (FLAG-24, Hard Stage 10) — Normal-mode data
above does not necessarily apply to Hard.

### Xenomorph pending-review tag decisions (seed 45)
Xenomorph (Legendary / Magic / Dark Elves, Alien: Earth collab) was seeded in
`seeds/45` with the SOLID tags (Poison, Perfect Veil, Stun, True Fear). Three
effects were deliberately left untagged pending a human decision:

- **Infest** (A2 Infestation) — no tag exists in the vocabulary. Its only
  mechanical hook is Xenomorph's OWN self-revive ("revives this Champion when an
  enemy under [Infest] dies"), so reuse is single-champion and niche. Decision
  needed: create an `Infest` vocab tag, or leave it as flavour/untagged?
- **Self-revive** (A2 passive) — the existing `Revive` tag means reviving a dead
  ALLY. Xenomorph's revive is SELF-only. Tagging `Revive` would wrongly surface
  him as a team reviver in matching. Decision needed: leave untagged (current), or
  add a distinct self-revive/survivability concept?
- **−20% DEF** (Caustic Blood passive) — a PASSIVE, CONDITIONAL DEF reduction that
  applies only to enemies already under a Poison HE placed. Not a placed
  `[Decrease DEF]` debuff. Decision needed: tag it `Decrease Defense` (it is a real
  DEF shred relevant to matching) with a conditional note, or keep `Decrease
  Defense` meaning "placed debuff only" and leave it untagged?

Also noted (not a decision, just a caveat baked into the seed-45 source_note): his
Stun/Infest/True Fear are unresistable ONLY while he is under [Perfect Veil], but
the `True Fear` tag is unconditionally `bypasses_accuracy_check=true`. He self-veils
on A1/A3 so it is usually up; flagged in case the engine over-credits the bypass.

### Michelangelo pending-review tag decisions (seed 46)
Michelangelo (Legendary / Spirit / Banner Lords, TMNT collab) had his affinity
corrected (Force -> Spirit) and faction (Shadowkin -> Banner Lords) in seeds/07 +
seeds/46, and his solo-profile reasoning fixed in seeds/06. Solid tags were seeded
(Decrease Defense, Stun, AoE Damage, Decrease Attack, Provoke, Increase Attack,
Shield). Four effects were left untagged pending a vocabulary decision — no tag
exists for any of them:

- **Leech** (A3 Shell Cyclone) — a real, reasonably common RAID debuff (heals the
  attacker for a % of damage dealt to the leeched enemy). Strongest candidate for a
  new vocab tag; would also apply to other Leech champions.
- **Debuff Spread** (A2 Express Delivery) — takes all debuffs from the target and
  copies them to all enemies. Signature turtle mechanic; niche but distinctive.
  RESOLVED (seed 48): `Debuff Spread` is now a vocab tag and Michelangelo carries it
  (approved).
- **Ally Attack** (Party Dude passive) — when he attacks, ally Leonardo/Donatello/
  Michelangelo/Raphael join the attack. TMNT-set synergy. RESOLVED (seed 57):
  `Ally Attack` is now a vocab tag; Michelangelo carries it (proposed, with his other
  seed-46 tags, pending his review). Fahrakin/Cardiel can migrate to this tag later.
- **Evade** (Party Dude passive) — 15% chance to evade an enemy skill (30% under
  Taunt). Survival mechanic; no tag.

(The seeded self-buffs — Increase ATK, Shield, self-Taunt/Provoke — are tagged but
noted as SELF-only in their source_notes; relevant for solo/survival, not team
support. Reviewer may downgrade if the tag is meant for ally-facing effects only.)

### Kosk of Two Skins pending-review tag decisions (seed 47)
Kosk of Two Skins (Legendary / Force / Lizardmen) was seeded in `seeds/47` with the
SOLID tags (Poison, Poison Sensitivity, Decrease Attack, AoE Damage, ACC Aura — the
last a new vocab tag mirroring seeds/20 RES Aura). Several effects were left untagged
pending a human decision:

- **Increase Turn Meter** (A3 Toxic Vitriol) — the existing tag means "fills an
  ALLY's Turn Meter". Kosk's +20% per [Decrease ATK] placed is SELF-only (self-
  acceleration off his own AoE). Tagging it would wrongly surface him as a team TM-
  booster (cf. Xenomorph self-revive, Michelangelo self-buffs). Decision needed: leave
  untagged (current), or add a self-scoped TM variant?
- **Counterattack** (Imbibed Immunity passive) — the existing tag means "places a
  [Counterattack] BUFF on allies". Kosk's passive is that HE counterattacks any enemy
  that hits him while under a debuff he placed — a self/passive counter, not an ally
  buff. Tagging `Counterattack` would mis-surface him as a Counterattack enabler.
  Decision needed: leave untagged (current), or add a self-counter concept?
- **Increase ACC self-buff** (A2 They Will Regret...) — a 50% [Increase ACC] buff on
  HIMSELF 2t before attacking. RESOLVED (seed 59): `Increase ACC` is now a vocab tag;
  Kosk carries it (approved, with a SELF-only note — feeds his own debuff landing).
- **Debuff Spread** (A2) — takes all [Poison] debuffs and the [Poison Sensitivity]
  debuff from the target and copies them to all other enemies. RESOLVED (seed 48):
  `Debuff Spread` is now a vocab tag and Kosk carries it (approved), alongside
  Michelangelo. (Karnage still worksheet-only — tag him if he enters the repo.)
- **Debuff-duration extension** (A1) and **Poison ACTIVATION/detonation** (A1 & A3) —
  A1 can extend all enemy debuffs by 1 turn / instantly activate Poisons; A3 instantly
  activates all Poisons AoE. Neither is a placed debuff, so no tag fits (cf. Venomage
  Poison-activation, seed 44). Decision: introduce a "detonation/activation" concept?
- **Innate immunity** (passive) — permanent immunity to [Poison], [Stun], and
  [Decrease SPD]. This is NOT the [Block Debuffs] buff (which is placed/temporary), so
  it should not carry that tag. No vocab exists for innate debuff immunities.
- **Damage-dealt increase + Ignore DEF per enemy debuff** (passive) — self damage-
  scaling (+5%/debuff up to 50%, Ignore DEF +3%/debuff up to 30%). No vocabulary; self-
  only. Left untagged.

### Jurojin pending-review tag decisions (seed 50)
Jurojin (Epic / Spirit / Shadowkin, HP-based) was seeded in `seeds/50` with the SOLID
tags (Decrease Attack, Provoke, Shield [self], HP Aura). His champions row was missing
from every committed seed even though `seeds/15` referenced him, so those raid.guide
tags had been silently no-opping — the row is created in seed 50 and the tags asserted
from the primary in-game source.

- **seed-15 mis-tag CORRECTED** — `seeds/15` auto-tagged Jurojin with **Unkillable** and
  **Block Damage** from A3 True Smite's text "will also ignore [Unkillable] and [Block
  Damage] buffs". That is a BYPASS of enemy buffs — he does NOT grant them. Tagging them
  would falsely surface him as an Unkillable/Block-Damage granter and could fool the team
  sustain check. Both seed-15 insert blocks were deleted; seed 50 also defensively rejects
  the rows on any live DB. No decision needed — this is a correction, logged for the trail.
- **Shield is SELF-only** (A2 Fated Duel, 25% of his MAX HP 2t) — tagged `Shield` with a
  self-only note (same treatment as Michelangelo's self-Shield, seed 46). Reviewer may
  downgrade if `Shield` is meant to mean ally-facing shields only.
- **Ignore [Unkillable]/[Block Damage] on enemies** (A3 True Smite) — a notable anti-tank /
  anti-revive tech (also ignores 25% enemy DEF). No vocab exists for "ignores enemy buff
  X". Decision: introduce an anti-buff/penetration concept, or leave as flavour?
- **Smiles at Death** (passive, Ascension 3) — 25% less damage taken when HP ≤ 50%. Self
  damage mitigation; no vocab. Left untagged.
- **Chance discrepancy (reviewer note)** — in-game A1 Monk's Spade shows a **45%**
  Decrease-ATK chance at Level 1 (→ 60% booked); `seeds/15` recorded "30% unbooked (45%
  booked)". The in-game Index is primary; seed 50's note uses 45% → 60%.

### Dark Elhain pending-review tag decisions (seed 52)
Dark Elhain (Epic / Magic / Undead Hordes, Attack; NOT the base High-Elves Elhain) was
seeded in `seeds/52` with the SOLID tags (Decrease Speed, AoE Damage, Increase Attack
[self], Increase C.Rate [self, Ascension 3], Increase C.DMG [self, Ascension 3]). Her
champions row was missing from every committed seed though `seeds/15` referenced her, so
those raid.guide tags had been no-opping — the row is created in seed 52 and the tags
asserted from the primary in-game source. She has **no aura**.

- **seed-15 mis-tag CORRECTED** — `seeds/15` auto-tagged her with **Freeze** from Lethal
  Winter's text "whenever this Champion or an ally RECEIVES a [Freeze] debuff". Her kit
  REACTS to being frozen (TM fill + Veins-of-Ice buff conversion) — she does NOT place
  [Freeze]. Tagging it would falsely surface her as a Freeze/CC champion. Deleted from
  seed 15; seed 52 also defensively rejects it. Correction, logged for the trail.
- **Self-only buffs** — Increase Attack (A2) and the Ascension-3 Veins-of-Ice buffs
  (Increase C.Rate, Increase C.DMG) are all SELF, tagged with self-only + ascension notes
  (cf. Michelangelo self-buffs). Reviewer may downgrade if these tags are meant to be
  ally-facing only. `seeds/15` recorded ascension_required=0 for the C.Rate/C.DMG rows;
  seed 52 corrects them to ascension_required=3.
- **Strengthen** (Veins of Ice, 15% self, Ascension 3) — no `Strengthen` tag exists in
  the vocab. It's a common RSL buff but self-only here. Decision: create the vocab tag
  (would also apply to other Strengthen champions), or leave untagged?
- **Increase Turn Meter** (Lethal Winter) — the tag means "fills an ALLY's Turn Meter";
  hers is SELF (25%, on Freeze). Left untagged (cf. Kosk seed 47).
- **MAX-HP destroy** (A1 Necrotic Bolt, 30% of damage) and **Death's-Majesty
  auto-activation on Freeze** (Lethal Winter) — neither is a placed debuff/standard
  effect; no vocab (cf. Venomage MAX-HP/Poison-activation, seed 44). Left untagged.
- **Chance discrepancy (reviewer note)** — in-game A2 Death's Majesty shows a **50%**
  Decrease-SPD chance at Level 1 (→ 75% booked); `seeds/15` recorded "25% unbooked". The
  in-game Index is primary; seed 52 uses 50% → 75%.

### Ruella notes (seed 54) — no pending decisions
Ruella (Epic / Spirit / Sylvan Watchers, Attack) was seeded in `seeds/54` with an all-
SOLID, team-relevant kit (Decrease Turn Meter, Decrease Defense, Weaken, Decrease Speed,
Increase Turn Meter, Increase C.Rate, ACC Aura). She was absent from every prior seed
(not even `seeds/15`), so there were no mis-tags to reconcile. Reviewer notes only:

- **Ascension-3 gating** — Increase Turn Meter and Increase C.Rate come from Timed
  Offensive, which UNLOCKS AT ASCENSION 3 (`ascension_required=3`). A pre-Asc-3 Ruella
  does not provide the ally TM fill / C.RATE buff — the matching engine should respect
  the ascension gate before crediting these team buffs.
- **Aura placement** — her ACC Aura is DUNGEONS-only (+40), not all-battles; noted in the
  tag source_note (magnitude/placement are not stored on the tag itself).
- **Decrease Turn Meter is conditional** — A1's 5% TM steal triggers only on a critical
  hit (80% chance), not every hit; captured in the source_note.

### Glorious Pallas pending-review tag decisions (seed 56)
Glorious Pallas (Legendary / Magic / Argonites, Support) was seeded in `seeds/56` with a
rich, all-ally-facing SOLID kit (Healer, Cleanse, Block Debuffs, Revive, Increase Speed,
Strengthen, Shield, Increase Turn Meter). She's the first champion whose Shield / Revive /
Increase Turn Meter are genuinely team-facing (contrast the self-only versions on
Jurojin/Michelangelo/Kosk). Open items:

- **Aura RESOLVED** — the original recording used the collection / Total-Stats view (no
  aura panel); Mike confirmed the aura on 2026-07-08: **+50 [RES] to all allies in all
  Battles** (RES Aura, vocab from seeds/20). Added to seeds/56.
- **Ally Attack** (A1 Spear of Serenity — 1 random Argonites ally joins the attack) —
  RESOLVED (seed 57): `Ally Attack` is now a vocab tag; Glorious Pallas carries it
  (approved) and Michelangelo carries it (proposed). Fahrakin/Cardiel (Clan Boss Ally
  Attack, handled via strategy modifiers) are candidates to migrate to this tag later.
- **Fervor** (A2 Gift of Thalass) — RESOLVED (seed 57): `Fervor` is now a vocab tag and
  Glorious Pallas carries it (approved).

### Keberon the Underflame pending-review tag decisions (seed 58)
Keberon the Underflame (Legendary / Force / Argonites, Attack) was seeded in `seeds/58`
with SOLID tags (Decrease Defense, AoE Damage, HP Burn, True Fear). An HP-Burn-centric
nuker with self-sustain. Open items:

- **Aura RESOLVED** — the clip used the collection / Total-Stats view (no aura panel);
  Mike confirmed the aura on 2026-07-09: **+28% [ATK] to all allies in all Battles**
  (ATK Aura, vocab from seeds/01). Added to seeds/58.
- **Increase ACC** (A3 Pyrenei Power — 50% [Increase ACC] on ALL allies 2t) — RESOLVED
  (seed 59): `Increase ACC` is now a vocab tag (paired with `Decrease ACC`); Keberon
  carries it (approved, ally-facing) and Kosk carries it (approved, self-noted).
- **Deathbrand** (A2 Searing Brand) — a unique/signature debuff; no vocab. Decision:
  create the tag or leave untagged?
- **Ignore [Unkillable]/[Shield] + 25% DEF** (A2) — anti-buff/penetration tech; he
  BYPASSES those enemy buffs, does NOT grant them (same pattern as Jurojin's seed-50
  Unkillable/Block-Damage). No vocab. Flagged so any future raid.guide scrape isn't
  mis-tagged as granting Unkillable/Shield.
- **[Delay] cheat-death** (passive Active — Delay on fatal hit), **self-heal** (20% MAX
  HP on HP-Burn activation), and **self Turn-Meter fills** (A2/A3) — all SELF-scoped or
  no-vocab; left untagged (the Healer / Increase Turn Meter tags are ally-facing).

### Sustain gear assumption
The app assumes no player champion runs Lifesteal, Regeneration, or Immortal gear.
All sustain must come from champion skills. This is enforced in the global sustain
check in `match-engine.js` (`checkTeamSustain`), which surfaces a `sustain` result on
every `matchRoster`/`evaluateTeam` output.

Impact: teams with no sustain champion always surface a sustain gap warning regardless
of dungeon. This is intentional.

Limitation: the assumption is binary — a player who does have Lifesteal on one champion
gets the same warning as a player with none. Resolving this requires asking the player
which gear set each champion is using, which adds friction we've chosen not to add at
MVP.

Related gaps:
- **Champion detail UI note NOT built (Part 3 deferred):** the sustain-assumption
  disclosure line ("We assume this champion is using damage or speed gear — not Lifesteal
  or Regeneration. Make sure your team includes a healer.") is specified but the champion
  detail screen itself doesn't exist yet (`app.html` has no gear-tier selector / detail
  sheet). Add the note when that screen is built (see the champion-selection UI spec in
  CLAUDE.md, Screen 3).
- **`champion_team_requirements` rows are `proposed`:** Criodan (healer) and Fahrakin the
  Fat (Clan Boss sustain_any) are seeded but not yet approved, so `checkTeamRequirements`
  doesn't act on them until a human flips them to `approved` (no-auto-merge rule). The
  Heinrich Demondoom row no-ops until that champion is added to `champions`.
- **Pre-existing, unrelated — FIXED:** `CRITICAL_DEBUFFER_TAGS` in `match-engine.js`
  previously used `'Decrease DEF'`/`'Decrease ATK'`, which don't match the seeded tag
  names (`'Decrease Defense'`/`'Decrease Attack'`), so the Clan Boss stun-matrix's
  `is_critical_debuffer` check never matched and `stun_warning`/`reorder_suggestion` never
  fired. Corrected to `['Decrease Defense', 'Decrease Attack', 'Weaken']` (all three
  verified against the `tags` table). Verified via a `buildStunMatrix` harness: a team with
  a Decrease Attack/Defense champion as the predicted stun target now fires both warnings.

## Code gaps

### Clan Boss battle-log outcomes — hero capture + dungeon ID FIXED; only DIFFICULTY still blocks the flag
Clan Boss hero capture is now **5/5** and the run is correctly identified as **Clan
Boss** (no longer mislabeled Dragon's Lair). Three distinct bugs, all found via a real
Clan Boss **Nightmare** capture (2026-07-02), preserved as the regression fixture
`gestal-sync/RslBattleReader/test-fixtures/file_080047.bin`:
1. **typeId high-byte garbage** (fixed earlier): the two bytes before the "h" key
   carry the correct typeId LOW byte but a garbage high byte, so the old full-u16
   match failed. `BattleWatcher.cs` roster filter now matches `heroId + typeId low
   byte` (`(c.TypeId & 0xFF) == (h.TypeId & 0xFF)`).
2. **heroId uint16 skip** (fixed 2026-07-02, `HeroIdentity.cs`): the heroId decoder
   only handled fixint + uint8 (`0xCC`), so any champion with inventory heroId ≥ 256
   (MessagePack uint16 `0xCD`) was silently dropped *at extraction*. The 5-champion
   team came through as 3/5 — Ezio (heroId 321) and Glorious Pallas (heroId 962) skipped.
   Added `0xCD`/`0xCE` handling; re-parsing the fixture now yields 11 candidates →
   filter keeps the 5 allies. Reader rebuilt (0 errors).
3. **CB mislabeled as a dungeon** (fixed 2026-07-02, `stage-signatures.json` +
   `BattleFileParser.cs`): CB carries no in-band encounter id, so `DungeonId` picked
   up a COINCIDENTAL in-band id (222601 == Dragon's Lair 11, which really does appear
   in CB files) and — because it takes precedence over the fingerprint — labeled the
   run "Dragon's Lair Stage 11." Fix: a Clan Boss fingerprint that anchors on the
   demon's own record (map16, fixed uid `u=0x0964D59D`) — verified team/difficulty-
   independent (common to 5 CB dumps across sessions, matches all 21 CB dumps, 0 of
   151 non-CB incl. the real Dragon-11 run 155750). `BattleFileParser` now treats a
   Clan Boss fingerprint as authoritative over `DungeonId`. Validated: the 3 CB dumps
   → "Clan Boss", the real Dragon-11 → still "Dragon's Lair 11", non-CB unaffected.

OUTCOME MODEL BUILT — gated on damage capture (2026-07-02): CB is scored by chest tier
(total damage), not kill/no-kill. `clan_boss_chest_tiers` (seed 26) holds per-difficulty
damage→chest thresholds; `chestTierFor()` in `lib/clan-boss.js` resolves a damage figure
to a chest name (e.g. 11.07M Nightmare → `guardian`). `upload-battles.js` now writes a CB
`recommendation_outcomes` row with `outcome = <chest tier>` when `total_damage_dealt` is
present, and HOLDS the run when it's absent (the old blanket `HOLD_CLAN_BOSS_OUTCOMES`
flag is superseded by this damage gate). `recommendation_outcomes.outcome` CHECK was
widened to allow the 12 chest names; `battle_history` gained `total_damage_dealt`.
Validated: the real 11.07M Nightmare run was backfilled to `outcome='guardian'`.

REMAINING GAP — the reader does NOT capture `total_damage_dealt` yet (it's the deferred
per-hero-stats problem: post-battle stats are computed on-screen, not snapshottable from
the empty StatisticsByHero dict — see the reader memory notes). So every real CB capture
is held today; only manually-backfilled rows (with an injected damage figure) resolve to
a chest tier. Building total-damage capture in the reader is the unblocker.

Difficulty sourcing is now SOLVED (the reason it was ever a blocker): the memory-read
fragility below is fixed, so `stageId` is captured live. `lib/clan-boss.js` maps
**Easy** (4019001), **Brutal** (4019013), and **Nightmare** (4019017, confirmed
2026-07-02 — live capture + "Demon Lord. Nightmare" result screen). Normal/Hard/Ultra-NM
stageIds are still unmapped (add each once a real capture confirms it).

### Memory reads depend on the class already being initialized (metadata-usage fragility) — FIXED 2026-07-02
`--roster` (Hero heap scan), `--gear` (Artifact), and the AppModel/stageId chain used
to read the class pointer straight from its TypeInfo RVA. In a **fresh game session**
that slot still holds the unresolved IL2CPP metadata-usage token (observed: a constant
`0x6000E2F3` for Hero, `0xA000FB8F` for Artifact, that did **not** move when ASLR
relocated the module base — proof it's a token, not a live pointer). `IsValidPointer`
range-checked it as "valid", so navigation silently died one step later and looked
like an offset shift when it wasn't.

Fixed by `Il2Cpp/Il2CppClassResolver.cs`: read the RVA slot; if it isn't a live class
(readability + `element_class == self` + name/namespace match), fall back to scanning
memory for the Il2CppClass by its (name, namespace). The class struct exists as long
as any instance does — the AppModel singleton always does once the game runs — so this
recovers the pointer without waiting for the game to exercise the class. Validated live
(2026-07-02, fresh-session token state): Hero → 99 heroes, Artifact → 1141, AppModel →
resolved. Passive read only. Resolved pointers are cached (`ConcurrentDictionary`; the
watcher resolves AppModel from two threads) and re-validated so a game restart
transparently re-resolves.

Residual (inherent, not the token bug): `--roster` still only sees Hero objects that
are *materialized* on the heap — a partial count until the Champion Collection is
opened (this session: 99 of ~109). The resolver can't conjure data the game hasn't
loaded; that's correct behaviour, and the message now says to open the collection.

### Event Dungeon / Minotaur cross-reference not wired
The reader tags event runs only as `"Event Dungeon"` (stageId prefix 2189) and
Minotaur as `"Minotaur's Labyrinth"` (2109). Neither resolves to a
`dungeon_stage_id` yet: Minotaur isn't seeded, and the event path needs the
`is_event` + `active_until >= current_date` query (specific live event first,
`"Event Dungeon (Generic)"` fallback) rather than exact-name `resolveDungeonStage`.
Note the reader's `"Event Dungeon"` label does not exact-match the DB row
`"Event Dungeon (Generic)"`. See commit `9a7be10`.

## Known accuracy ceilings (effective-stats)

### Mastery/glyph and per-artifact ascension not fully applied
`lib/effective-stats.js` applies set + mastery bonuses via Gestal's pre-resolved
`bonusesV2`, but per-artifact glyph/ascension stats are not summed
(`effective-stats.js` header TODO). Material impact is mainly SPD (Lore of Steel
glyphs); low impact on the ACC/HP/RES threshold checks.

### Champion ascension level — RESOLVED (derived from typeId, July 2026)
The game encodes ascension in the champion typeId: **`ascension = typeId − baseTypeId`**
(0-6). Gestal's `ascensionLevel` field is always 0 and is a red herring; both `typeId`
and `baseTypeId` are already in the Gestal export. Confirmed by a controlled live
ascend — Skeletor's in-memory `Hero.TypeId` went 9330 → 9331 when ascended to level 1 —
plus a roster-wide check (every `typeId − baseTypeId` in 0-6, matching known state:
Pelops 6, Narma/Gnut/Tagoar 3, Skeletor 0). `buildUserChampions.ascensionFromGestal(g)`
computes it; the mapRoster `ascension_required` gate now works from Gestal data alone.

No memory read (Option B) and no override file needed — the interim
`config/ascension_overrides.json` and the Option-B ascension-offset task are both
**retired**. (`DoubleAscendData.Grade` is the *awakening* level, not ascension.)

Verified: Pelops derives ascension 6, so his HP Burn + Petrification (ascension_required
3) now count. NOTE: `ascension_required` itself must still be set per-skill from the
in-game padlock/description (default 0) — see the tagging rule; that's separate from
sourcing the player's ascension level.
