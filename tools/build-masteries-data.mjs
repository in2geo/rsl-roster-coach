// tools/build-masteries-data.mjs — generate data/masteries.json from RAID_All_Masteries_and_Effects.xlsx.
//
// SOURCE OF TRUTH for the mastery layer. Two things live here:
//   1. The 66 masteries verbatim (branch/tier/effect/type/trigger), parsed from the workbook.
//   2. The masteryId decode + a per-mastery `mech` spec (how the SIM consumes it).
//
// ── The masteryId ↔ name decode (CONFIRMED 2026-08-02, Ninja in-game screenshots) ──────────────
// Gestal masteryIds encode `500 <branch> <tier> <node>` where node is a FIXED grid COLUMN (1-4),
// NOT a spreadsheet row index. The map from (branch,tier,node) → name:
//   • tiers 2-6 (4 masteries each): node = spreadsheet position within the tier (1..4).
//       Anchors: Warmaster 500161 (in-game), Heart of Glory 500121, Charged Focus 500324
//       (spreadsheet pos 4 = node digit 4 — the clincher), Keen Strike 500122.
//   • tier 1 (2 masteries, centred in the grid): node = position + 1  (pos1→col2, pos2→col3).
//       Anchors: Deadly Precision 500113, Pinpoint Accuracy 500313, Steadfast → col2.
// This decode maps ALL 66 masteries and leaves ZERO unmapped IDs across all 8 captured accounts.
//
// ⚠ FIXES A PRIOR BUG: lib/masteries.js hardcoded GIANT_SLAYER_ID = 500162. The decode says
//   500162 = Helmsmasher (Ignore-DEF), 500163 = Giant Slayer. Sun Wukong/Alice hold 500162
//   (Ignore-DEF fits attack nukers); Thor Faehammer holds 500163 (Giant Slayer fits a single-hit
//   nuker). The old id mis-credited 500162-holders with boss %maxHP bonus damage they don't have.
//
// ── What the sim consumes (`mech.sim`) ──────────────────────────────────────────────────────────
// FLAT-STAT masteries are ALREADY applied via Gestal bonusesV2.mastery (effective-stats.js) — the
// sim must NOT re-add them, so they carry sim:'stat' as documentation only. The GAP the sim needs
// is the conditional/proc DAMAGE masteries (no statKindId → absent from bonusesV2):
//   • 'damage_mult'      — a conditional multiplier folded into computeRawHit (value, when, cap).
//   • 'ignore_def_proc'  — Helmsmasher: chance to strip a DEF fraction for a hit.
//   • 'boss_bonus_damage'— Warmaster / Giant Slayer: %maxHP DEF-independent bonus (proc + coeffs).
//   • 'stat'             — flat stat, already in bonusesV2 (documentation only).
//   • 'deferred'         — a real mechanic not yet modelled; emitted so it is VISIBLE, never a
//                          silent default (per MODEL_AS_REIMPLEMENTATION.md).
//
// Run:  node tools/build-masteries-data.mjs   (writes data/masteries.json)
// Requires the xlsx to be parsed to JSON first via tools/masteries-xlsx-to-rows.mjs (no xlsx dep in
// Node); this script embeds the parsed rows so it runs standalone and stays reproducible.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

// Parsed verbatim from RAID_All_Masteries_and_Effects.xlsx (Masteries sheet), in spreadsheet order
// within each (branch,tier). [branch, tier, cost, name, effect, effectType, trigger]
const ROWS = JSON.parse(fs.readFileSync(path.join(__dirname, 'masteries-rows.json'), 'utf8'));

const BRANCH_NUM = { Offense: 1, Defense: 2, Support: 3 };

// ── mechanic specs for the masteries the sim models. Keyed by name. Everything not listed here and
// not a flat stat is 'deferred'. Percentages are stored as fractions. `when` is a condition the
// engine evaluates per hit (see engine.masteryDamageMult). ────────────────────────────────────────
const MECH = {
  // Conditional DAMAGE multipliers (the gap). value = +fraction; cap = max total when stacking.
  'Heart of Glory':   { sim: 'damage_mult', value: 0.05, when: 'self_full_hp' },
  'Grim Resolve':     { sim: 'damage_mult', value: 0.05, when: 'self_hp_le_50' },
  'Single Out':       { sim: 'damage_mult', value: 0.08, when: 'target_hp_lt_40' },
  'Ruthless Ambush':  { sim: 'damage_mult', value: 0.08, when: 'first_hit_vs_enemy' },
  'Bring It Down':    { sim: 'damage_mult', value: 0.06, when: 'target_higher_maxhp' },
  'Wrath of the Slain': { sim: 'damage_mult', value: 0.05, when: 'per_dead_ally', cap: 0.10 },
  'Opportunist':      { sim: 'damage_mult', value: 0.12, when: 'target_under_control' },
  'Stoked to Fury':   { sim: 'damage_mult', value: 0.04, when: 'per_self_debuff', cap: 0.12 },
  'Shield Breaker':   { sim: 'damage_mult', value: 0.25, when: 'target_under_shield' },
  'Methodical':       { sim: 'damage_mult', value: 0.02, when: 'per_default_use', cap: 0.10, defaultSkillOnly: true },
  'Kill Streak':      { sim: 'damage_mult', value: 0.03, when: 'per_kill', cap: 0.12 },
  // Ignore-DEF proc (attack damage only; folded into computeRawHit's ignoreDef).
  'Helmsmasher':      { sim: 'ignore_def_proc', chance: 0.50, ignore: 0.25 },
  // Boss %maxHP bonus damage (DEF-independent). procChance × maxHp coeff; champ vs boss coeffs differ.
  // per: 'skill' (once per skill, Warmaster) vs 'hit' (each hit, Giant Slayer). bossHp EV must keep
  // Warmaster at the engine's existing 0.024 (=0.60×0.04) so wired Warmaster fixtures stay identical.
  'Warmaster':        { sim: 'boss_bonus_damage', chance: 0.60, championMaxHp: 0.10, bossMaxHp: 0.04, per: 'skill' },
  'Giant Slayer':     { sim: 'boss_bonus_damage', chance: 0.30, championMaxHp: 0.075, bossMaxHp: 0.03, per: 'hit' },
};

// Flat-stat masteries — ALREADY in bonusesV2.mastery. Listed so the layer is complete and the sim
// can assert it is NOT double-counting. {stat, value, pct?}
const STAT = {
  'Blade Disciple':     { stat: 'atk', value: 75 },
  'Deadly Precision':   { stat: 'crit_rate', value: 5 },
  'Keen Strike':        { stat: 'crit_dmg', value: 10 },
  'Flawless Execution': { stat: 'crit_dmg', value: 20 },
  'Tough Skin':         { stat: 'def', value: 75 },
  'Defiant':            { stat: 'res', value: 10 },
  'Iron Skin':          { stat: 'def', value: 200 },
  'Unshakeable':        { stat: 'res', value: 50 },
  'Steadfast':          { stat: 'hp', value: 810 },
  'Pinpoint Accuracy':  { stat: 'acc', value: 10 },
  'Elixir of Life':     { stat: 'hp', value: 3000 },
  'Eagle-Eye':          { stat: 'acc', value: 50 },
};

const decodeId = (branch, tier, posIdx1) => {
  const node = tier === 1 ? posIdx1 + 1 : posIdx1; // tier-1 masteries sit in grid columns 2 & 3
  return 500000 + BRANCH_NUM[branch] * 100 + tier * 10 + node;
};

const perTier = {};
for (const r of ROWS) {
  const key = `${r.branch}|${r.tier}`;
  (perTier[key] ??= []).push(r);
}

const masteries = [];
for (const [key, rows] of Object.entries(perTier)) {
  rows.forEach((r, i) => {
    const pos = i + 1;
    const id = decodeId(r.branch, r.tier, pos);
    let mech;
    if (MECH[r.name]) mech = MECH[r.name];
    else if (STAT[r.name]) mech = { sim: 'stat', ...STAT[r.name], note: 'already applied via Gestal bonusesV2.mastery — sim must not re-add' };
    else mech = { sim: 'deferred', note: 'real mechanic, not yet modelled — emitted so it is visible' };
    masteries.push({
      id, branch: r.branch, tier: r.tier, node: id % 10, position: pos,
      name: r.name, scroll_cost: r.cost, effect: r.effect, effect_type: r.effectType,
      trigger: r.trigger, mech,
    });
  });
}
masteries.sort((a, b) => a.id - b.id);

const out = {
  _source: 'RAID_All_Masteries_and_Effects.xlsx (Verified 2026-08-02) via tools/build-masteries-data.mjs',
  _decode: 'masteryId = 500<branch><tier><node>; tiers 2-6 node=spreadsheet position, tier 1 node=position+1. Confirmed via Ninja in-game screenshots 2026-08-02.',
  _mech_note: 'mech.sim: stat=already in bonusesV2 (do not re-add) · damage_mult/ignore_def_proc/boss_bonus_damage=modelled in lib/sim/engine.js · deferred=visible, not yet modelled.',
  _count: masteries.length,
  masteries,
};
fs.writeFileSync(path.join(REPO, 'data', 'masteries.json'), JSON.stringify(out, null, 1) + '\n');
console.error(`wrote data/masteries.json — ${masteries.length} masteries`);
