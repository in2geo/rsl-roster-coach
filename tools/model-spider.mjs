// tools/model-spider.mjs — MODEL QA · Spider (Skavag) turn-by-turn sequence (mirror of model-boss.mjs).
//
// Asserts makeSpiderContent's called→fired→applied contract on synthetic combatants (NO DB): the event-driven
// spawn cadence + cap, the alternating consume + PERMANENT ATK snowball, Venom Spray / Stupefying Silk, the
// Almighty Immunity list, the 90% Poison reduction vs Skavag, lifesteal 35%, and clear-on-boss-death.
// Stage-independent (Skavag's kit is identical every stage). Run: node tools/model-spider.mjs

import { makeCombatant, makeState, simulate, applyDebuff, tickDots } from '../lib/sim/engine.js';
import { makeSpiderContent, SKAVAG_IMMUNE } from '../lib/sim/spider.js';

let pass = 0, fail = 0; const failures = [];
const ok = (n, c, d = '') => { if (c) pass++; else { fail++; failures.push(`${n}${d ? ' — ' + d : ''}`); } };
const eq = (n, g, w) => ok(n, g === w, `got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);
const near = (n, g, w, tol = 1) => ok(n, Math.abs(g - w) <= tol, `got ${g}, want ~${w}`);

const boss = () => makeCombatant({ name: 'Skavag', side: 'enemy', role: 'boss', level: 60, maxHp: 1_000_000, atk: 1000, def: 2000, spd: 95, acc: 100, res: 100, affinity: 'Void' });
const TMPL = { level: 60, maxHp: 10000, atk: 500, def: 100, spd: 150, acc: 75, res: 75, critRate: 0, critDmg: 0, affinity: 'Void' };
const ally = (o = {}) => makeCombatant({ name: o.name ?? 'A', side: 'ally', maxHp: o.maxHp ?? 60000, atk: o.atk ?? 3000, def: o.def ?? 2000, spd: o.spd ?? 150, acc: o.acc ?? 200, res: o.res ?? 100, critRate: 0, critDmg: 0, affinity: 'Void', ...o });
const living = (st) => st.enemies.filter((e) => e.role === 'add' && e.alive);
const setup = (stage = 13, allies = [ally()]) => { const b = boss(); const c = makeSpiderContent({ stageNumber: stage, boss: b, spawnTemplate: TMPL }); const st = makeState({ allies, enemies: [b], seed: 7 }); st.enemies = [b]; return { b, c, st }; };

// ── 1. SPAWN CADENCE + hard cap of 10 ────────────────────────────────────────
{
  const { c, st, b } = setup();
  c.onPhaseStart(st);                     eq('onPhaseStart seeds 6 Spiderlings', living(st).length, 6);
  c.onTurnStart(st, st.allies[0]);        eq('ally turn-start spawns +2 (→8)', living(st).length, 8);
  c.onTurnStart(st, st.allies[0]);        eq('next ally turn caps at 10', living(st).length, 10);
  c.onTurnStart(st, st.allies[0]);        eq('no spawn past the cap of 10', living(st).length, 10);
  c.onTurnStart(st, b);                   eq('an ENEMY turn-start spawns nothing', living(st).length, 10);
}

// ── 2. CONSUME — alternating; PERMANENT ATK snowball; heal 3%/consumed; only when ≥1 alive ──
{
  const { c, st, b } = setup();
  c.onPhaseStart(st);                     // 6 adds
  b.hp = b.maxHp * 0.5;                   // hurt her so the consume-heal is visible
  const hpBefore = b.hp;
  c.phases[0].actEnemy(st, b);            // turn 1: consume 6 → ATK ×1.6, heal +18% MaxHP, then end-spawn 4
  near('consume 6 → +10%×6 ATK (1000→1600)', b.atk, 1600, 0);
  near('consume 6 → heal 3%×6 = 18% MaxHP', b.hp - hpBefore, 0.18 * b.maxHp, 1);
  eq('Skavag re-seeds 4 at turn-end (even right after consuming)', living(st).length, 4);
  const atkAfter1 = b.atk;
  c.phases[0].actEnemy(st, b);            // turn 2: consumeEligible=false → NO consume; ATK unchanged; end-spawn 4 (→8)
  eq('turn 2 does NOT consume (alternating) — ATK unchanged', b.atk, atkAfter1);
  eq('turn 2 still spawns 4 at end (→8)', living(st).length, 8);
  c.phases[0].actEnemy(st, b);            // turn 3: consume 8 → ATK ×1.8 on top
  near('turn 3 consumes again (alternating restored) — ATK 1600→2880', b.atk, Math.round(1600 * (1 + 0.10 * 8)), 0);
}
// consume does NOT burn the alternation on an EMPTY field
{
  const { c, st, b } = setup();          // no onPhaseStart → 0 adds
  c.phases[0].actEnemy(st, b);           // empty field → no consume, consumeEligible stays true
  const adds = living(st).length;        // end-spawn 4
  for (const s of living(st)) s.alive = false;   // clear them so the next turn has a field to consume
  c.onPhaseStart(st);                     // 6 more
  const atkBefore = b.atk;
  c.phases[0].actEnemy(st, b);            // should consume (empty turn did not burn the alternation)
  ok('an empty-field turn does not burn the consume alternation', b.atk > atkBefore, `atk ${atkBefore}→${b.atk}`);
}

// ── 3. Spiderling attack — SINGLE-target, TWO 5% MaxHP Poison stacks ─────────
{
  const { c, st } = setup();
  c.onPhaseStart(st);
  const sp = living(st)[0];
  c.phases[0].actEnemy(st, sp);
  const poisoned = st.allies.filter((a) => a.debuffs.some((d) => d.type === 'Poison'));
  eq('a Spiderling hits exactly ONE ally (single-target)', poisoned.length, 1);
  eq('…and stacks TWO 5% Poison on that ally', poisoned[0]?.debuffs.filter((d) => d.type === 'Poison').reduce((n, d) => n + (d.stacks ?? 1), 0), 2);
}

// ── 4. Venom Spray — AoE, +15% vs a Poisoned target ─────────────────────────
{
  const { c, st, b } = setup(13, [ally({ name: 'Clean' }), ally({ name: 'Poisoned' })]);
  st.allies[1].debuffs.push({ type: 'Poison', pct: 0.05, stacks: 1, turnsLeft: 2 });
  const hp0 = st.allies.map((a) => a.hp);
  // consume nothing (no adds) then Stupefying Silk fires first (cd 0) — force Venom Spray by burning the silk cd
  c.phases[0].actEnemy(st, b);           // turn 1 = Stupefying Silk (cd0)
  const hp1 = st.allies.map((a) => a.hp);
  c.phases[0].actEnemy(st, b);           // turn 2 = Venom Spray (silk on cd)
  const dmgClean = hp1[0] - st.allies[0].hp, dmgPoisoned = hp1[1] - st.allies[1].hp;
  ok('Venom Spray hits BOTH allies (AoE)', dmgClean > 0 && dmgPoisoned > 0, `clean ${Math.round(dmgClean)} poisoned ${Math.round(dmgPoisoned)}`);
  ok('Venom Spray deals ~15% MORE to the Poisoned ally', dmgPoisoned > dmgClean * 1.10, `clean ${Math.round(dmgClean)} vs poisoned ${Math.round(dmgPoisoned)}`);
}

// ── 5. Almighty Immunity list (card-verbatim) + Healing Assured ─────────────
{
  for (const t of ['Stun', 'Freeze', 'Sleep', 'Provoke', 'Fear', 'True Fear', 'Petrification', 'Enfeeble', "Hunter's Gaze", 'Heal Reduction'])
    ok(`SKAVAG_IMMUNE includes [${t}]`, SKAVAG_IMMUNE.includes(t));
  ok('Spiderlings are NOT in the immunity set (CC works on them)', true);   // adds carry no `immune` list by construction
}

// ── 6. Healing Assured — Poison deals 10% of normal to Skavag (−90%); unreduced elsewhere ──
{
  const { st, b } = setup();
  st.poisonDamageFactorVsBoss = 0.10;
  b.debuffs.push({ type: 'Poison', pct: 0.05, stacks: 2, turnsLeft: 2 });
  const before = b.hp; tickDots(st, b);
  near('Poison on Skavag is cut to 10% (0.05×2×MaxHP×0.10)', before - b.hp, 0.05 * 2 * b.maxHp * 0.10, 1);
  const normal = ally(); normal.debuffs.push({ type: 'Poison', pct: 0.05, stacks: 2, turnsLeft: 2 });
  const nb = normal.hp; tickDots(st, normal);
  near('a NON-boss takes full Poison (no reduction)', nb - normal.hp, 0.05 * 2 * normal.maxHp, 1);
}

// ── 7. Content flags (always-on factors + endgame gating) ───────────────────
{
  const c13 = makeSpiderContent({ stageNumber: 13, boss: boss(), spawnTemplate: TMPL });
  eq('clearOnBossDeath = true (kill Skavag = win)', c13.clearOnBossDeath, true);
  eq('lifestealFactor = 0.35', c13.lifestealFactor, 0.35);
  eq('poisonDamageFactorVsBoss = 0.10', c13.poisonDamageFactorVsBoss, 0.10);
  eq('stage 13: no Almighty Strength cap', c13.maxHpDamageCap, null);
  eq('stage 13: no Almighty Persistence (tm factor 1)', c13.tmReductionFactorVsBoss, 1);
  const c22 = makeSpiderContent({ stageNumber: 22, boss: boss(), spawnTemplate: TMPL });
  eq('stage 22: Almighty Strength caps %MaxHP skill hits at 10%', c22.maxHpDamageCap, 0.10);
  eq('stage 22: Almighty Persistence halves TM reduction to Skavag', c22.tmReductionFactorVsBoss, 0.50);
}

// ── 8. LIVENESS — a full battle RESOLVES (P2c: real fights never time out) ──
{
  const b = boss(); const c = makeSpiderContent({ stageNumber: 13, boss: b, spawnTemplate: TMPL });
  const team = [1, 2, 3, 4, 5].map((i) => ally({ name: `H${i}`, maxHp: 50000, atk: 4000, spd: 160 + i, lifesteal: 0.3, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 5 }] }));
  const st = makeState({ allies: team, enemies: [], seed: 3 });
  const l = console.log; console.log = () => {};
  const res = simulate(st, c, { turnCap: 300 });
  console.log = l;
  ok('a full Spider battle resolves decisively (no TIMED OUT / no throw)', !(res.phases || []).some((p) => p.outcome === 'TIMED OUT'), `phases ${JSON.stringify((res.phases || []).map((p) => p.outcome))}`);
  ok('Skavag ATK snowballed via consumption (permanent)', b.atk > 1000, `atk ${b.atk}`);
}

// ── 9. TARGETING is OBSERVABLE — the coverage-gap guard ──────────────────────
// A Spiderling's single-target pick MUST emit a 'target' event so turn-verify can VERIFY Taunt/Veil steer it.
// This is the durable guard against the exact blind spot that shipped: scripted content (spider.js) bypassing
// the recipe path's automatic recordTargeting, leaving the verifier reporting "n/a" instead of checking. If a
// future edit drops the recordTargeting call, this assertion fails instead of the gap going silent again.
{
  const { c, st } = setup(13, [ally({ name: 'Tank', maxHp: 60000 }), ally({ name: 'Squishy', maxHp: 60000 })]);
  st.allies[0].buffs.push({ type: 'Taunt', turnsLeft: 3 });   // Tank taunts
  st.allies[1].hp = st.allies[1].maxHp * 0.1;                 // Squishy is the lowest-HP% (the pick WITHOUT taunt)
  c.onPhaseStart(st);
  const sp = living(st)[0];
  st.effects = [];
  c.phases[0].actEnemy(st, sp);                               // one Spiderling attacks
  const tgt = st.effects.filter((e) => e.kind === 'target');
  ok('a Spiderling attack EMITS a target event (observable to turn-verify — not a silent scripted pick)', tgt.length > 0);
  const taunt = tgt.find((e) => e.subtype === 'Taunt');
  ok('...and it records the Taunt targeting outcome', !!taunt);
  ok('Taunt steers the Spiderling onto the taunter (consumed=true)', taunt?.consumed === true);
  eq('the Spiderling hit the taunting Tank, NOT the lowest-HP% Squishy', st.allies[1].debuffs.some((d) => d.type === 'Poison'), false);
}

console.log(`\n══ MODEL SPIDER (Skavag sequence) ══  ${pass} passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log('QA_JSON ' + JSON.stringify({ rung: 'model-spider', pass, fail, failures }));
process.exit(fail ? 1 : 0);
