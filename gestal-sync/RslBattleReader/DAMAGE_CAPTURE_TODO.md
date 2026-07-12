# Clan Boss total-damage capture — handoff (start of next session)

## Goal
Auto-capture per-champion / total damage from a battle so the reader emits
`total_damage_dealt` into battle-log entries. This is the ONE unblocker for the CB
chest-outcome pipeline, which is **already built**: `clan_boss_chest_tiers` (seed 26) +
`lib/clan-boss.js` `chestTierFor(damage)` + outcome logging in `tools/upload-battles.js`
(HOLDs when damage absent). Once damage flows, real CB runs resolve to a chest tier.

## What is CONFIRMED (2026-07-12)
- Damage is **NOT in the battleResults file** (searched a labeled Brutal dump for all 15
  result-screen stats across int/u24/fixed-point/float → 0 real hits) and **NOT in the
  combat `StatisticsByHero` dict** (empty post-battle; identity/rounds/HP only).
- Damage **IS in the result-UI view-model in memory**, stable while the result screen is
  open. `--scan <comma-vals>` (MemoryScanner.cs) proved it: on a live Brutal result
  (Don$Gnut, 23.31M total) it found all 5 per-champion values in a **per-hero array,
  0xD0 (208-byte) stride**, damage at the block offset (repeats at +0/+8/+10 = adjacent
  damage sub-fields, likely dealt/toBoss/total).
- Reproduce: with a CB result screen open,
  `RslBattleReader.exe --scan 3179452,9516375,10024039,272191,327442` (those were the
  Brutal per-champion damages; use your own run's numbers).

## THE TASK (#1): stable pointer path
`--scan` finds the array at a RUNTIME address that changes every battle. For auto-capture
we need a **stable pointer chain** from a fixed root (`AppModel`) → the result view-model →
the per-hero damage array, then read damage at the block offset with the 0xD0 stride.

Approach:
1. With a result open, `--scan` to get the cluster base address.
2. Pointer-scan BACKWARD: find pointers in the heap that point at (or near) the cluster;
   walk up toward AppModel / a known UI/result view-model object. (The Il2Cpp navigator
   infra + `ProcessMemory` helpers are already there.)
3. Identify the field offsets on the path; verify the SAME path resolves across multiple
   battles AND a game restart (the known fresh-session fragility — see
   `Il2CppClassResolver.cs`, which already handles the token-vs-class case).
4. Add offsets to `Il2CppOffsets.cs`, read the array in `ReadBattleResult` (BattleWatcher.cs),
   emit `TotalDamageDealt` (+ optional per-hero) on `BattleResultSnapshot` / battle-log.

## Key files
- `MemoryScanner.cs` — `--scan` (the view-model finder; header comment documents the theory).
- `BattleWatcher.cs` — `ReadBattleResult` (BR_Statistics→StatisticsByHero path; has a debug
  probe ~L320 that dumps BattleStatistics slots) and the poll loop.
- `Il2Cpp/Il2CppOffsets.cs` — BR_*, BStats_*, HS_* offsets (dump.cs GameAssembly v11.60.0).
- `Il2Cpp/Il2CppNavigator.cs` — AppModel/BattleResultsCache navigation, dict iteration.
- `tools/find-damage.mjs` — byte-search a raw dump for a value (all encodings). For FILE
  work; damage isn't in the file, so mostly a dead end confirmed.

## Guardrails
- PASSIVE READ ONLY — no injection/hooking (CLAUDE.md boundary; anti-cheat risk).
- Stop any running `RslBattleReader.exe` before `dotnet build` (locks the dll).
- If the game updated, re-verify offsets resolve (read stageId on a battle) before trusting.

## Calibration anchor (for the SEPARATE CB damage ESTIMATOR, not this task)
Brutal 23,319,499 = Narma 10,024,039 / Pelops 9,516,375 / Ezio 3,179,452 /
Tagoar 327,442 / Pallas 272,191. New `clan_boss_stats` seed (boss_spd, boss_hp,
damage_calibration) is in place for the predictive estimator when we build it.
