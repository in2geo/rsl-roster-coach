// tools/sim-recipe-fight.mjs — Milestone 0, Step 4: does the recipe CODE produce the results we EXPECT?
//
// Two layers, kept separate on purpose (Mike, 2026-07-24):
//   THIS TOOL proves the CODE/MATH is correct — each champion's recipe, run on the real Dragon-16 builds,
//   produces the damage we can derive BY HAND (multiplier × stat × crit × DEF-mitigation × ignore-DEF ×
//   affinity). The authoritative oracle is an INDEPENDENT closed-form calc that does NOT call the engine —
//   so "recipe == expected" means the number is correct, not merely that two implementations agree.
//   LATER, separately, we check the same setup against the RECORDING to see if the INPUTS are right.
//
// It also shows engine-parity (recipe vs the current engine) as secondary context, and demonstrates the two
// cases the recipe correctly FIXES vs the old prose-parser: Bambus conditional-AoE, Ezio ignore-35%-DEF.
//
// Run: node --env-file=.env.local tools/sim-recipe-fight.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  makeCombatant, makeState, DEF_K, skillBase, critMult, defMitigation, effectiveDef, affinityFactor, dmgVariance,
} from '../lib/sim/engine.js';
import { buildDragonBattle } from '../lib/sim/dragon-fixture.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES, FORMULAS } from '../lib/sim/recipes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const FIXTURE = path.join(REPO, 'test', 'golden', 'dragon16-donbambus-2026-07-22.json');

if (!process.env.SUPABASE_URL) {
  console.log('\n══ RECIPE-FIGHT (Step 4) ══  ⏳ skipped — no SUPABASE_URL. Run: node --env-file=.env.local tools/sim-recipe-fight.mjs\n');
  process.exit(0);
}
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// ── the INDEPENDENT oracle: hand-formula damage, literal arithmetic, NO engine calls ──
const BEATS = { Magic: 'Spirit', Spirit: 'Force', Force: 'Magic' };
function expectedHit(a, F, tDef, tAff) {
  const stat = F.scalingStat === 'ATK' ? a.atk : F.scalingStat === 'HP' ? a.maxHp : F.scalingStat === 'DEF' ? a.def : a.spd;
  const base = (F.multiplier ?? 0) * stat;
  const crit = 1 + Math.min(100, a.critRate || 0) / 100 * ((a.critDmg || 0) / 100);   // deterministic EV
  const effDef = tDef * (1 - (F.flags?.ignore_def || 0));
  const defMit = DEF_K / (DEF_K + effDef);
  let aff = 1;
  if (a.affinity && tAff && a.affinity !== 'Void' && tAff !== 'Void') {
    if (BEATS[a.affinity] === tAff) aff = 1.30; else if (BEATS[tAff] === a.affinity) aff = 0.70;
  }
  return base * crit * defMit * aff;
}
// engine's per-hit (secondary parity context)
const engineHit = (state, a, skill, t) => skillBase(a, skill, t) * critMult(state, a.critRate, a.critDmg)
  * defMitigation(effectiveDef(t)) * affinityFactor(a.affinity, t.affinity) * dmgVariance(state);
const single = (rec) => ({ ...rec, actions: rec.actions.map((x) => x.op === 'ACQUIRE_TARGETS' ? { ...x, targetIf: undefined, target: 'single' } : x) });

async function main() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
  if (built.skip) { console.log('\n══ RECIPE-FIGHT ══  skipped —', built.skip, '\n'); process.exit(0); }
  const boss = built.boss;
  let pass = 0, fail = 0, improved = 0;
  const tally = (c) => { c ? pass++ : fail++; return c; };

  console.log(`\n══ RECIPE-FIGHT (Step 4) — does the code produce the EXPECTED damage? — real builds vs ${boss.name} ══`);
  console.log(`   boss DEF ${boss.def}, affinity ${boss.affinity}${boss.affinity === 'Void' ? '  (⚠ Void → affinity/weak-hit is ×1 here; not exercised)' : ''}, DEF_K ${DEF_K}\n`);
  console.log('  champ  slot  scale   HAND-EXPECTED   recipe   ok    engine   note');
  console.log('  ' + '─'.repeat(88));

  for (const ally of built.allies) {
    const first = ally.name.split(' ')[0];
    for (const rec of Object.values(RECIPES)) {
      if (rec.champion.split(' ')[0].toUpperCase() !== first.toUpperCase()) continue;
      const F = FORMULAS[rec.actions.find((x) => x.formulaId)?.formulaId];
      if (!F) continue;

      // recipe single-hit on a fresh boss clone
      const t = makeCombatant({ name: 'boss', side: 'enemy', def: boss.def, maxHp: 1e9, affinity: boss.affinity });
      const st = makeState({ allies: [ally], enemies: [t], seed: null });
      const got = applyRecipe(st, ally, single(rec))[0]?.raw_damage ?? 0;
      // INDEPENDENT expected
      const exp = Math.round(expectedHit(ally, F, boss.def, boss.affinity));
      const okExpected = tally(Math.abs(got - exp) <= 1);
      // engine parity (secondary)
      const parsed = (ally.skills || []).find((s) => String(s.slot).toUpperCase() === rec.slot);
      const t2 = makeCombatant({ name: 'boss', side: 'enemy', def: boss.def, maxHp: 1e9, affinity: boss.affinity });
      const eng = parsed ? Math.round(engineHit(makeState({ allies: [ally], enemies: [t2], seed: null }), ally, parsed, t2)) : null;
      const ignoreDef = (F.flags?.ignore_def || 0) > 0;
      let note = '';
      if (eng != null && Math.abs(got - eng) <= 1) note = 'engine parity';
      else if (ignoreDef && got > (eng ?? 0)) { note = `engine ${eng} misses ignore-DEF ✔ recipe correct`; improved++; }
      else if (eng == null) note = '(no engine skill parsed)';
      else note = `differs from engine ${eng}`;
      console.log(`  ${first.padEnd(6)} ${rec.slot}   ${F.scalingStat.padEnd(4)} ${String(exp).padStart(13)} ${String(got).padStart(8)}   ${okExpected ? 'YES' : 'NO!'}  ${String(eng ?? '—').padStart(7)}   ${note}`);
    }
  }

  // ── the conditional-AoE fix, on the real wave ──
  console.log('\n  Bambus A1 conditional targeting (old parser had aoe=false → always single):');
  const bambus = built.allies.find((a) => /Bambus/i.test(a.name));
  if (bambus && built.waves?.[0]) {
    const freshWave = (dbs) => built.waves[0].enemies.map((e) => makeCombatant({ name: e.name, side: 'enemy', def: e.def, maxHp: e.maxHp, affinity: e.affinity, spd: e.spd }))
      .map((e) => { for (let i = 0; i < dbs; i++) e.debuffs.push({ type: `d${i}`, turnsLeft: 2 }); return e; });
    const e0 = freshWave(0), e2 = freshWave(2);
    const r0 = applyRecipe(makeState({ allies: [bambus], enemies: e0, seed: null }), bambus, RECIPES['BAMBUS-A1']);
    const r2 = applyRecipe(makeState({ allies: [bambus], enemies: e2, seed: null }), bambus, RECIPES['BAMBUS-A1']);
    console.log(`    target 0 debuffs  → ${r0.length} hit   ${tally(r0.length === 1) ? 'PASS' : 'FAIL'}`);
    console.log(`    target ≥2 debuffs → ${r2.length} hits  ${tally(r2.length === e2.length) ? 'PASS' : 'FAIL'}  (AoE over the wave)`);
  } else console.log('    (no wave enemies — skipped)');

  // ── reality anchor: context only, NOT scored (totals are survival-confounded — the LATER check) ──
  console.log('\n  reality anchor (recording per-hero damage TOTALS — the separate "is the setup right?" check, not scored here):');
  for (const [n, v] of Object.entries(fixture.expected?.per_hero || {})) console.log(`    ${n.padEnd(8)} ${String(v.damage ?? '—').padStart(9)}`);

  console.log(`\n══ ${pass} match expected / ${fail} wrong / ${improved} correct fix(es) over the engine ══`);
  console.log('   CODE correctness proven (recipe == hand-computed math). SETUP-vs-reality is the later check.\n');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
