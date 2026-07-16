# Dungeon per-champ damage capture — scoping + recipe

## ✅✅ SOLVED + WIRED 2026-07-15 (live session) — dungeon per-champ damage now auto-captures
- **DONE.** `--dungeondamage` returns exact per-champ damage/def/heal, verified live on an **IG-10
  DEFEAT** (Tholin 280,955 / Tuhanarak 20,886 / Uugo 28,527 / Ezio 28,995 / Ruella 25,496, total
  384,859 — matched the screen). Losses included → the survival-anchor blocker is cleared.
- **Mechanism (CbDamageReader.CaptureDungeon):** the dungeon dialog nests its hero list unlike CB
  (not a UserContextList at a dialog slot — refs run through BaseView/Action bindings). Instead:
  (1) GATE on a live `BattleFinishDungeonDialogContext` instance (result screen open, else stale);
  (2) scan `HeroBattleStatsContext` instances, keep those whose damage/def/heal are all in [0,1e9)
  (stale contexts carry sentinels −1 / 0x120000 / garbage); (3) take the largest CONTIGUOUS run at
  **stride 0x1A0** (the current team's array); (4) reverse it (stored reverse-of-screen) → slot 0 =
  leader. Hero-stat inner offsets are the SAME as CB (+0x090 dmg / +0x098 def / +0x0A0 heal →
  +0x50 LongProperty → +0x28 Int64).
- **WIRED:** `BattleWatcher.TryAttachClanBossDamage` → `TryAttachBattleDamage` — picks the CB dialog
  for Clan Boss, `CaptureDungeon` for the 4 dungeons; emits `TotalDamageDealt` + per-hero `Damage`
  into battle-log for dungeon battles. New reader cmds: `--dungeondamage`, `--dungeoninspect`,
  `--herostats`, `--nsclasses`.
- **STILL OPEN — wave/phase-of-death field (INS-0021):** `--dungeoninspect` did NOT surface an
  obvious current-wave / furthest-point index on the dialog (only 0/1 flag-ints). Needs a separate
  probe (e.g. inspect the battle-setup / stage-progress context, or count boss-vs-wave enemy deaths).
  Damage capture does NOT depend on it. Follow-up.
- **NEXT:** run a few dungeon battles (esp. losses) with the watcher (default mode) to accumulate
  per-champ damage → re-run `tools/reconcile-runs.mjs` → survival/kill calibration with REAL
  per-champ numbers (no longer 0/105).

## Original scoping (superseded by the SOLVED section above) — BREAKTHROUGH 2026-07-15 (live session, game running)
- **CONFIRMED: dungeon result screens expose per-champ damage — for WINS *and* LOSSES.** (IG-8
  victory showed damage/defense/heal bars per champ; Mike confirmed defeat screens show damage too.)
  This closes the one real risk — the loss captures we need for survival WILL carry per-champ damage.
- **Same structure as Clan Boss:** `--scan` on the on-screen damage found the per-hero cluster with
  the **0xD0 stride** (identical to CB), so the dungeon result reuses `HeroBattleStatsContext`.
- **Dungeon dialog class = `BattleFinishDungeonDialogContext`** (found via new `--nsclasses
  Client.ViewModel.Contextes.BattleFinishDialog` — lists all 20 sibling dialog classes; DoomTower/
  Arena/Hydra/etc. also present for later). Namespace + hero-stat classes match CB exactly.
- **BUILT:** `CbDamageReader` generalized (`CaptureFrom(mem, dialogClass, heroListOffset)`); new
  commands `--dungeondamage` (auto-read, tries CB's 0x160 list offset first) and `--dungeoninspect`
  (dumps the dialog's slots to confirm the real hero-list offset + spot a wave/phase field).
- **REMAINING (needs a live dungeon result open):**
  1. Run `--dungeondamage` on a live result — if it prints the 5 damages, 0x160 is correct → done.
     If empty, run `--dungeoninspect` and read the "HERO LIST CANDIDATE" slot → set that offset.
  2. `--dungeoninspect` also flags small-int slots — look for the **wave/phase-of-death field**
     (INS-0021): if the dungeon dialog carries a current-wave / furthest-point index, we solve
     per-champ damage AND the wave-vs-boss capture from the same object.
  3. Wire `BattleWatcher.TryAttachClanBossDamage` → `TryAttachBattleDamage` (select config by battle
     type: CB → AllianceBoss dialog, dungeon → Dungeon dialog). Emit damage for dungeons in battle-log.
- Offsets valid on current game version (v-check: `--whoami`/`--roster` read correctly 2026-07-15).

---


**Why this is the top data unblocker (2026-07-15):** the power model's kill AND survival sides are
now confounded because dungeon battles capture NO per-champ damage (`BattleHero.Damage` null for
**0/105** dungeon battles; populated only for CB). Without it we can't separate "killed slow" from
"died before killing", can't calibrate the DoT land-rate/uptime magnitudes (INS-0019), and can't
calibrate survival at all (INS-0018). Per-champ damage on the LOSS captures is the single highest-
value signal we're missing.

**Boundary:** PASSIVE READ ONLY. No injection/hooking (CLAUDE.md). Everything below reads existing
game state (the result screen the game already renders), same as the solved CB path.

---

## The good news: CB already solved this exact shape — dungeons are very likely a sibling config

`CbDamageReader.cs` reads per-hero damage from the **live result dialog view-model**:

```
BattleFinishAllianceBossDialogContext            (ns Client.ViewModel.Contextes.BattleFinishDialog)
  +0x160 → UserContextList<HeroBattleStatsContext>
    +0x078 → List<HeroBattleStatsContext>  (_items @0x10, _size @0x18)
      element → HeroBattleStatsContext
        +0x090 → HeroBattleStatContext (damage)  → +0x50 LongProperty → +0x28 Int64
        +0x098 → (defense)   +0x0A0 → (healing)
```

"AllianceBoss" = Clan Boss. The dungeon/campaign victory screen ALSO shows per-champion damage bars,
so that data is in an analogous view-model. The hypothesis (high confidence): a **sibling dialog
class in the same namespace** exposes the SAME `UserContextList<HeroBattleStatsContext>` — so only
the **dialog class name** and its **hero-list offset** differ; the whole inner hero→stat→LongProperty
read path (`ReadStat`, the 0x090/0x098/0x0A0 rows) is reusable AS-IS.

---

## Step 0 (cheap, do FIRST): is dungeon damage in the FILE?

CB damage was confirmed NOT in the battleResults file — but the dungeon result payload may differ.
Before any memory work, rule this in/out (much more robust than the transient dialog if it's there):

1. Capture a labeled dungeon battle (note each champ's on-screen damage).
2. `node tools/find-damage.mjs <path-to-dungeon-battleResults-dump> <dmg1,dmg2,...>` (byte-search all
   encodings). If the values are in the file → decode them in `BattleFileParser.cs` and DONE — no
   dialog VM needed, and it works even when no result screen is open.

If not in the file, proceed to the memory path below.

---

## Step 1: find the dungeon result-dialog class name

Needs a fresh `dump.cs` (re-dump process in CLAUDE.md; not committed to this repo). Grep it for the
`BattleFinishDialog` namespace:

```
grep -nE "class .*DialogContext" dump.cs | grep -i "BattleFinish\|Dungeon\|Campaign\|Battle"
```

Candidates to expect (name TBD from the dump): `BattleFinishDialogContext`,
`BattleFinishBattleDialogContext`, `BattleFinishDungeonDialogContext`, or similar. Confirm which one
carries a `UserContextList<HeroBattleStatsContext>` field (that's the hero list; note its offset —
the CB analogue is `+0x160`).

## Step 2: confirm + find the hero-list offset live (the `--scan` proof, exactly as CB was solved)

1. Run a dungeon battle; read each champ's damage off the victory screen.
2. With the result screen OPEN: `RslBattleReader.exe --scan d1,d2,d3,d4` (MemoryScanner.cs). Confirm
   the values cluster in a per-hero array (CB was a 0xD0 stride; the dialog-VM path is cleaner).
3. Anchor on the dialog class from Step 1; find the field offset whose `UserContextList → List` size
   matches the team size and whose elements' `+0x090` stat equals the on-screen damage. That offset
   is the dungeon `Dlg_HeroList`.

## Step 3: generalize the reader (small refactor)

- Parameterize `CbDamageReader` into a shared `BattleResultDamageReader.Capture(mem, dialogClass, ns,
  heroListOffset)` — the CB call becomes one config (`BattleFinishAllianceBossDialogContext`, `0x160`),
  the dungeon call another (`<dungeon dialog>`, `<offset>`). The hero-row read path is shared.
- In `BattleWatcher.TryAttachClanBossDamage` (currently gated `snapshot.Dungeon != "Clan Boss"`):
  generalize to `TryAttachBattleDamage` that selects the config by battle type — CB → AllianceBoss,
  dungeon/campaign → the dungeon dialog. Join per-hero by slot (already screen-order, as CB does).
- `BattleHero.Damage` already exists and is battle-type-agnostic — just update its doc comment (it
  currently says "from the Clan Boss result dialog"). Emit `TotalDamageDealt` for dungeons too.

## Step 4: verify offsets survive a game restart

Same fresh-session fragility as CB (`Il2CppClassResolver` handles the token-vs-class case). Confirm
the path resolves across ≥2 battles AND a restart before trusting; add offsets to `Il2CppOffsets.cs`.

---

## THE risk to verify early: does the DEFEAT screen expose per-champ damage?

The whole point is the LOSS captures (they're the survival/kill anchors — INS-0018/0019). A WIN
victory screen clearly shows damage bars; a **DEFEAT screen may show less** (or a different dialog
class). **Verify Step 2 on a real dungeon LOSS, not just a win.** If defeats don't expose per-champ
damage, that's a hard limit to surface to Mike — we'd have total-team damage at best, or need another
source. Test a loss first; it's the case that matters and the one most likely to disappoint.

## Estimate

If dungeon damage is in the file (Step 0): ~half a day, robust. If it's the dialog VM (Steps 1-4):
~1 day given the CB path is a working template — mostly one live-capture session to nail the class
name + offset, then a mechanical refactor. Gated on a machine with Raid running + admin (can't be
done headless).
