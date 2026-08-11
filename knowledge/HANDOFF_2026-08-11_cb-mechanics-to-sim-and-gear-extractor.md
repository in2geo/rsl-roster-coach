# HANDOFF 2026-08-11 — CB mechanics finished in the hand-calc → ported to the sim; real-gear extractor (Option B) unblocked

## TL;DR — where to resume (pick one)

Three parallel threads are live. The natural resume order:

1. **FINISH THE REAL-GEAR FEED (recommended first — it unblocks validating everything else).**
   The Option B direct gear extractor is ~90% done. This session **SOLVED the ArtifactBonus stat decode**
   (the hard part). Two pieces remain: the **equipped-gear linkage** (which artifact is on which champ)
   and the **rest of the StatKindId enum**. Blind memory-scanning stalled on the linkage — **the efficient
   move is to regenerate `dump.cs`** (Il2CppDumper vs `GameAssembly.dll`, ~30 min routine) and read the
   Hero/Artifact class field definitions directly. Full detail + offsets: `gestal-sync/option-b-roster-extractor-plan.md`.
2. **PORT THE CHAMPION-SIDE CB MECHANICS TO THE SIM.** Boss-side is done (rotation + AoE split, below).
   Remaining in `lib/sim/recipes.js`/`ai.js`: Mikey opens/prioritises A3 Shell Cyclone; Mikey booked
   cooldowns (A3=4/A2=3, ONLY booked champ); verify Mikey-Leech/DecATK + Artor-Strengthen recipes fire.
   ⚠ Can't VALIDATE the sim's absolute damage until thread #1 lands (sim CB fixture uses stale Gestal gear).
3. **COMMIT / DECIDE THE CLEANUP.** ~32 files archived early this session are **staged but NOT committed**
   (git mv into `repo/_archive/2026-08-10-cleanup/`). Two dead API routes were removed to get under the
   Vercel 12-function cap (11 now). Review + commit when ready.

Durable memory for the CB thread: **[[cb-survival-gap-support-buff-uptime-2026-08-10]]** (read it first for CB).

---

## ⚠ UNCOMMITTED WORKING TREE — nothing this session is committed

`git status` is dirty across all three threads. Before more work, review/commit:
- **Cleanup:** `git mv` of ~32 files → `repo/_archive/2026-08-10-cleanup/` (staged). `.vercelignore` rewritten.
  Removed `api/waitlist.js` + `api/parse.js` (+ `lib/parse-roster.js`) → 13→11 serverless functions.
- **Sim:** `lib/sim/clan_boss.js` — (a) CB "optimistic" no-damage survive-mode REMOVED (always models the
  wipe now); (b) rotation FLIPPED to Flesh Wither→Dark Nova→Crushing Force; (c) AoE per-skill SPLIT
  (`FLESH_WITHER_HIT`/`DARK_NOVA_HIT` = CB_BOSS_HIT ×0.749/×2.448; Hard 1843/6022). `tools/sim-clan-boss.mjs`
  usage text updated.
- **Hand-calc:** `tools/handcalc/cb.mjs` — Mikey opens A3 + booked cds (A3=4/A2=3); per-skill AoE split
  mechanism (`FW_HIT`/`DN_HIT`, env-overridable, **default still 2460/2460**, correct = 1843/6022); env
  diagnostics `REALSTATS=1` (inject real screenshot stats) + `XHP=1` (per-boss-turn Xeno HP/mitigation/casts)
  + Strengthen-coverage line. Keep these.
- **Reader (C#):** `ArtifactReader.cs` + `RosterReader.cs` carry RE diagnostics (DUMP_ART, `--hero` list/dict
  dumps). `option-b-roster-extractor-plan.md` updated with the decode.
- **Memory:** new `cb-survival-gap-support-buff-uptime-2026-08-10.md`; `MEMORY.md` compacted (was over the
  read-limit).

---

## THREAD A — CB is now mechanically COMPLETE (hand-calc), at its deterministic ceiling

**Anchor fight:** DonaHilvi CB **Hard**, team Ezio(L45)/Ninja/Mikey/Artor(L44)/Xeno. Reality end-screen:
**14.2M total** (Xeno 6.79M / Ninja 4.79M / Mikey 2.05M / Ezio 0.49M / Artor 0.08M), 8:30, Xeno **33 turns**.

**Method (Mike's, vindicated ~6× this session):** walk the fight action-by-action, every skill broken into
individual clauses, against the video narration + the independent hand-calc (`tools/handcalc/cb.mjs`). Ran with
`REALSTATS=1` (real in-game stats from stat/Set-Info screenshots — see the memory for the exact numbers) because
the Gestal snapshot gear was STALE (this is why we then pivoted to the gear extractor).

**Mechanics discovered/locked this session (all from Mike's turn-by-turn):**
- **Rotation = Flesh Wither (t1) → Dark Nova (t2) → Crushing Force (t3).** (Sim had it backwards.)
- **AoE per-skill split:** t1 Flesh Wither (2 hits)=789 to Xeno; t2 Dark Nova (1 hit)=1,289 → **Dark Nova ≈
  3.27× Flesh Wither per hit.** Old single constant over-credited Flesh Wither, under-credited Dark Nova —
  they masked each other. ⚠ THE SPLIT AND THE MITIGATION UPTIME ARE COUPLED: the correct Dark Nova over-kills
  UNLESS Decrease-ATK+Strengthen stay up (reality keeps them up; deterministic model can't perfectly).
- **Mikey opens + prioritises A3 Shell Cyclone** (Leech + 50% Decrease-ATK + Taunt from t0). Was opening A2.
- **Mikey is BOOKED (only booked champ):** A3 cd 5→**4**, A2 cd 4→**3**. Booked cds lifted Leech/DecATK uptime
  45%→67%.
- **Leech (not lifesteal) is the sustain:** Mikey A3 places [Leech] on the boss → any attacker heals ~18% of
  hit damage. Xeno multi-hits → near-full all fight, no lifesteal gear.
- **Xeno self-veils** (A1/A3 "Also places [Perfect Veil]") → Crushing Force redirects off him (0 dmg every CF).
- **Crushing Force** targets Taunt (Mikey) else lowest-HP; AoE ignores veil (kills via escalating Gathering Fury).
- **Artor kit faithful** (small 5%-MaxHP heal; A2 = 25% Strengthen + 15% TM, cd5; A3 revive cd6).

**Progression (hand-calc, real stats):** baseline 12.28M/Xeno dies t17 → Mikey-opens-A3 12.87M/t19 → +booked cds
**13.32M / t20 (0.94× of 14.2M).** **THE RESIDUAL IS SUPPORT-BUFF UPTIME** (Leech/DecATK/Strengthen lapse late) —
and it's the deterministic EV ceiling. **Mike's key framing:** the hand-calc computes the MEAN; a single real
14.2M battle is one RNG draw; do NOT tune the hand-calc to hit 14.2M exactly (that's fitting to luck). The last
few % is variance → the SIMULATOR's job (Monte-Carlo). **We are AT the hand-calc ceiling — stop calibrating it.**

---

## THREAD B — SIM PORT: boss-side DONE, champion-side remains

Ported to `lib/sim/clan_boss.js` + verified: **rotation flip** and **AoE per-skill split** (`FLESH_WITHER_HIT`
1843 / `DARK_NOVA_HIT` 6022 Hard, ratio 3.27). Sim runs clean; wipes early (split over-kills WITHOUT the
champion-side mitigation — same coupling as the hand-calc, expected).

**Still to port (recipes/ai layer):** Mikey opener + A3-priority; Mikey booked cds; confirm Leech/DecATK
(Mikey A3) + Strengthen (Artor A2) recipes fire. **Validate the sim against the DISTRIBUTION** (does 14.2M fall
in the N-battle spread; is the mean near the hand-calc EV) — NOT a single number. ⚠ blocked on Thread A (real gear).

---

## THREAD C — REAL-GEAR EXTRACTOR (Option B) — the crux is cracked

**Why:** Gestal exports go stale (the Aug-9 snapshot's gear no longer matched the account — it corrupted the
CB speeds all session). Goal: read roster+gear directly from game memory, drop Gestal. Plan +
all offsets: `gestal-sync/option-b-roster-extractor-plan.md`.

**Already validated (prior + this session):** champion reader `--roster` (109/109 clean); gear SCALARS `--gear`
(slot/set/rank/level, reconciles to 1061 owned); root hop solved.

**SOLVED this session — the ArtifactBonus stat decode (was the hard blocker):** verified EXACTLY vs Mikey boots.
`kind` @ ArtifactBonus+0x10; value-ptr @ +0x18 → value obj `isAbsolute` @ +0x10, **Fixed int64 @ +0x18 ÷ 2³²**
(flat→integer, percent→fraction). Subs = List<ArtifactBonus> @ Art+0x58. StatKindId partial: HP=1 ATK=2 SPD=4 CRATE=7.

**Remaining (both unblocked by regenerating `dump.cs`):**
1. **equippedOnHeroId** — NOT on the artifact; Hero near-field lists are skills (0x60, size6) + an unidentified
   size-8 (0x1D0). Read the Hero/Artifact field defs from `dump.cs` instead of blind-scanning.
2. **Rest of StatKindId enum** (DEF/RES/ACC/CDMG) — also a `dump.cs` read.
Then: owned-artifact filter (→1061), wire decode into `--gear` output, `diff-gear` validate, swap
`import-upload.js` off Gestal.

---

## DISCIPLINE (durable, don't relearn)
- **North Star:** the SIMULATOR is the intended stage predictor (`knowledge/NORTH_STAR.md`). Ask "does this move
  sim-suite?" The hand-calc is the OFFLINE ORACLE for finding mechanics; the sim is the product.
- **IMPLEMENT, DON'T FIT.** Every CB value this session came from Mike's video, not tuning. The one "close total"
  (0.94×) was two errors canceling — the per-turn walk exposed it.
- **Reader boundary:** passive memory reads only, NEVER injection (CLAUDE.md hard rule). The gear extractor stays
  passive.
- **CB reader capture is untrustworthy** (per-hero NULL, timeline truncates, phantom owned-champ objects) — use
  the video + end-screen for CB, not the reader.
