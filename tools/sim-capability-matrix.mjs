// tools/sim-capability-matrix.mjs — THE CAPABILITY BENCHMARK (independent denominator for the team).
//
// WHAT THIS IS AND IS NOT: every cell below is dissected BY HAND from the verbatim in-game card text
// (`champion_skills.skill_summary`, the DB source of truth) — NOT from lib/sim/recipes.js. That
// independence is the whole point: it is the BENCHMARK the recipe list (the sim's implementation) and the
// turn-by-turn trace are measured AGAINST. Building it from the recipes would only ever confirm "what is in
// the sim is in the sim" — a circular check that can never reveal a missing capability.
//
// Each skill is broken into ATOMIC cells, one per card clause, categorized:
//   OFF  offense (direct damage)     DoT  offense over time (Poison / HP Burn)
//   CC   crowd control               DEF- enemy-offense debuff (Dec ATK/SPD/ACC/Enfeeble)
//   HEAL healing / revive            MIT  mitigation (shields, damage-reduction, reflect, Increase DEF)
//   BUFF ally economy (Inc ATK/SPD/ACC/CRate)   UTIL steal/strip/transfer/activate/turn-meter
//   SELF self-mechanic (self-Sleep, Perfect Veil, immunities, counter, execute passive)
//
// Each cell carries the card's COOLDOWN (how often the skill can fire) and the effect DURATION (how long it
// should stay active) — the two cadence facts the user asked to see per cell.
//
// It then reports, per cell, TWO independent comparisons:
//   1. RECIPE  — is this cell implemented in lib/sim/recipes.js?  IMPL / DEFER / MISS
//   2. TRACE   — did it actually fire across N sim seeds?         %seeds it appeared in + fires/fight
//
// Run: node --env-file=.env.local tools/sim-capability-matrix.mjs [N] [dungeon] [stage]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { RECIPES, champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 40);
const DUNGEON = process.argv[3] || "Spider's Den";
const STAGE = Number(process.argv[4] || 13);
const FIXTURE = { "Spider's Den": 'spider13-donbambus-current.json', "Dragon's Lair": 'dragon16-donbambus-current.json' }[DUNGEON];

// ── THE BENCHMARK — hand-dissected from the DB card text (see header). `eng` = the engine subtype string to
// look for in the trace ledger; `dmg`/`heal`/`revive` = match by kind; `op` = the implementing interpreter op
// used ONLY for the recipe-coverage check; `mod` = a continuous incoming-damage modifier (not point-ledgered).
const CH = {
  'Bambus': { key: 'BAMBUS', skills: {
    'A1': { name: 'Bamboo Splinter', cd: 0, cells: [
      { cat: 'OFF',  label: 'damage 3.8×ATK (1 enemy; AoE if target ≥2 debuffs)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'DEF-', label: '[Decrease SPD] 30%', eng: 'Decrease Speed', dur: '2t', chance: '75%' },
      { cat: 'SELF', label: 'self [Sleep] (enables Sleeping Sage sponge)', eng: 'Sleep', dur: '1t', chance: '100%' },
    ]},
    'A2': { name: 'Grovetender', cd: 4, cells: [
      { cat: 'MIT',  label: '[Shield] all allies = 30% caster MaxHP', eng: 'Shield', dur: '2t', chance: '100%' },
      { cat: 'UTIL', label: 'extend all ally buff durations +1t', op: 'EXTEND_EFFECT', dur: '+1t', chance: '100%' },
      { cat: 'OFF',  label: 'damage 5.6×ATK (all enemies)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'UTIL', label: 'decrease all enemy buff durations −1t', op: 'REDUCE_EFFECT_DURATION', dur: '−1t', chance: '75%' },
      { cat: 'MIT',  label: 'boost ally [Shield] +3% per enemy buff cut', op: 'BOOST_SHIELD', dur: '-', chance: '100%' },
      { cat: 'SELF', label: 'self [Sleep]', eng: 'Sleep', dur: '1t', chance: '100%' },
    ]},
    'A3': { name: 'Dream Sight', cd: 4, cells: [
      { cat: 'BUFF', label: '[Increase ACC] 50% all allies', eng: 'Increase ACC', dur: '2t', chance: '100%' },
      { cat: 'BUFF', label: '[Increase ATK] 50% all allies', eng: 'Increase ATK', dur: '2t', chance: '100%' },
      { cat: 'DEF-', label: '[Enfeeble] all enemies (not Bosses)', eng: 'Enfeeble', dur: '2t', chance: '75%' },
      { cat: 'DEF-', label: '[Decrease ACC] 50% all enemies', eng: 'Decrease ACC', dur: '2t', chance: '75%' },
      { cat: 'DEF-', label: '[Decrease ATK] 50% on Bosses (in place of Enfeeble)', eng: 'Decrease Attack', dur: '2t', chance: '75%' },
      { cat: 'SELF', label: 'self [Sleep]', eng: 'Sleep', dur: '1t', chance: '100%' },
    ]},
    'PASSIVE': { name: 'Sleeping Sage', cd: '-', cells: [
      { cat: 'UTIL', label: 'sponge: transfer ally debuffs to self while asleep (excl hard-CC)', op: 'sponge', dur: '-', chance: '75%' },
      { cat: 'UTIL', label: 'dump self debuffs onto highest-RES enemy on wake', op: 'sponge', dur: '-', chance: '100%' },
    ]},
  }},
  'Ezio Auditore': { key: 'EZIO', skills: {
    'A1': { name: 'Eagle Dive', cd: 0, cells: [
      { cat: 'OFF',  label: 'damage 4×ATK (1 enemy)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'DEF-', label: '[Decrease DEF] 60% (unresist under Veil)', eng: 'Decrease Defense', dur: '2t', chance: '75%' },
    ]},
    'A2': { name: "Da Vinci's Design", cd: 4, cells: [
      { cat: 'OFF',  label: 'damage 4×ATK (all enemies)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'DoT',  label: 'two 5% [Poison] (stacks)', eng: 'Poison', dur: '2t', chance: '75%' },
      { cat: 'DEF-', label: '[Poison Sensitivity] 25%', eng: 'Poison Sensitivity', dur: '2t', chance: '75%' },
      { cat: 'UTIL', label: 'instantly activate [Poison] on enemies ≥4 debuffs', op: 'DEBUFF_ACTIVATION', dur: '-', chance: '100%' },
      { cat: 'OFF',  label: '2×[Bomb] 6×ATK vs [Stone Skin] enemies (no Stone Skin on Spider)', eng: 'Bomb', dur: '2t', chance: '75%' },
    ]},
    'A3': { name: 'Hidden Gun', cd: 4, cells: [
      { cat: 'UTIL', label: 'steal all buffs from target', op: 'STEAL_BUFF', dur: '-', chance: '100%' },
      { cat: 'OFF',  label: 'damage 5×ATK, ignore 35% DEF + [Shield]/[Strengthen]', dmg: true, dur: '-', chance: '100%' },
    ]},
    'PASSIVE': { name: 'Everything Is Permitted', cd: '-', cells: [
      { cat: 'OFF',  label: 'execute: bonus dmg when enemy <25% HP (ignore 100% DEF, Assassin trigger)', op: '__none__', dur: '-', chance: 'passive' },
    ]},
    'PASSIVE2': { name: 'Full Synchronization', cd: '-', cells: [
      { cat: 'SELF', label: '[Perfect Veil] self each round start (untargetable)', eng: 'Perfect Veil', dur: '2t', chance: '100%' },
      { cat: 'MIT',  label: '35% chance nullify a hit >50% MaxHP to 0', mod: true, dur: '-', chance: '35%' },
      { cat: 'OFF',  label: '35% counterattack when attacked', op: 'COUNTERATTACK', dur: '-', chance: '35%' },
    ]},
  }},
  'Pelops the Victor': { key: 'PELOPS', skills: {
    'A1': { name: 'Triumphant Blow', cd: 0, cells: [
      { cat: 'OFF',  label: 'damage 0.25×HP (1 enemy)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'DEF-', label: '[Decrease ATK] 50% (unresist if target HP Burn)', eng: 'Decrease Attack', dur: '2t', chance: '75%' },
    ]},
    'A2': { name: "Gorgoa's Bane", cd: 4, cells: [
      { cat: 'OFF',  label: 'damage 0.4×HP, +10%/debuff-turn ≤200%, ignore 50% DEF if HP Burn', dmg: true, dur: '-', chance: '100%' },
      { cat: 'UTIL', label: 'steal all buffs if dmg <50% target MaxHP', op: 'STEAL_BUFF', dur: '-', chance: 'cond' },
      { cat: 'CC',   label: '[Stun] if dmg <50% target MaxHP', eng: 'Stun', dur: '2t', chance: 'cond' },
    ]},
    'A3': { name: "Victor's Bounty", cd: 4, cells: [
      { cat: 'BUFF', label: '[Increase ATK] 50% all allies', eng: 'Increase ATK', dur: '2t', chance: '100%' },
      { cat: 'MIT',  label: '[Magma Shield] all allies = 30% caster MaxHP', eng: 'Magma Shield', dur: '2t', chance: '100%' },
      { cat: 'CC',   label: '[Taunt] self', eng: 'Taunt', dur: '2t', chance: '100%' },
      { cat: 'MIT',  label: 'passive: −20% team damage-taken (while not under Dec DEF)', mod: true, dur: 'cont', chance: '100%' },
    ]},
    'PASSIVE': { name: 'Master of Games', cd: '-', cells: [
      { cat: 'SELF', label: 'immune to [Stun]/[HP Burn]/[Petrification]', op: 'immune', dur: '-', chance: '100%' },
      { cat: 'DoT',  label: '[HP Burn] on attacker (→50% under Dec DEF)', eng: 'HP Burn', dur: '2t', chance: '100%' },
      { cat: 'CC',   label: '[Petrification] on attacker (→25% under Dec DEF)', eng: 'Petrification', dur: '1t', chance: '50%' },
    ]},
  }},
  'Tagoar': { key: 'TAGOAR', skills: {
    'A1': { name: 'Da Magic Stick', cd: 0, cells: [
      { cat: 'OFF',  label: 'damage 1.8×ATK ×2 hits (1 enemy)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'MIT',  label: '[Increase DEF] 60% on lowest-HP ally', eng: 'Increase DEF', dur: '2t', chance: '100%' },
    ]},
    'A2': { name: 'Charge Cant', cd: 5, cells: [
      { cat: 'OFF',  label: 'damage 3.7×ATK (all enemies)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'BUFF', label: '[Increase SPD] 30% all allies', eng: 'Increase SPD', dur: '2t', chance: '100%' },
      { cat: 'HEAL', label: 'heal all allies 15% caster MaxHP', heal: true, dur: '-', chance: '100%' },
    ]},
    'A3': { name: 'Rise And Fight', cd: 7, cells: [
      { cat: 'HEAL', label: 'revive all dead allies @30% HP', revive: true, dur: '-', chance: '100%' },
      { cat: 'MIT',  label: '[Shield] all allies = 20% caster MaxHP', eng: 'Shield', dur: '2t', chance: '100%' },
    ]},
    'A4': { name: 'Aid the Feeble', cd: '-', cells: [
      { cat: 'MIT',  label: 'passive: −10% damage-taken for allies ≤50% HP', mod: true, dur: 'cont', chance: '100%' },
    ]},
  }},
  'Vergis': { key: 'VERGIS', skills: {
    'A1': { name: 'Pierce', cd: 0, cells: [
      { cat: 'OFF',  label: 'damage 3.9×DEF (1 enemy)', dmg: true, dur: '-', chance: '100%' },
      { cat: 'MIT',  label: '[Reflect Damage] 30% on a random ally', eng: 'Reflect Damage', dur: '2t', chance: '40%' },
    ]},
    'A2': { name: 'Aegis', cd: 4, cells: [
      { cat: 'HEAL', label: '[Continuous Heal] 15% on a target ally', eng: 'Continuous Heal', dur: '3t', chance: '100%' },
      { cat: 'BUFF', label: '[Increase SPD] 30% on a target ally', eng: 'Increase SPD', dur: '3t', chance: '100%' },
      { cat: 'MIT',  label: '[Reflect Damage] 30% on a target ally', eng: 'Reflect Damage', dur: '3t', chance: '100%' },
      { cat: 'MIT',  label: '[Ally Protection] 50% all allies except self', eng: 'Ally Protection', dur: '2t', chance: '100%' },
      { cat: 'MIT',  label: '[Increase DEF] 60% self', eng: 'Increase DEF', dur: '2t', chance: '100%' },
    ]},
    'PASSIVE': { name: 'Second Wind', cd: 3, cells: [
      { cat: 'MIT',  label: '[Shield] self = 10% MaxHP when losing ≥10% MaxHP/hit', eng: 'Shield', dur: '2t', chance: '100%' },
      { cat: 'HEAL', label: '[Continuous Heal] 15% self when HP <50%', eng: 'Continuous Heal', dur: '2t', chance: '100%' },
    ]},
  }},
};

// ── RECIPE COVERAGE: does lib/sim/recipes.js implement this cell? IMPL / DEFER / MISS ────────────────
function recipeStatus(key, slot, cell) {
  const rec = RECIPES[`${key}-${slot}`];
  if (!rec) return 'MISS';   // no recipe for this slot at all
  const acts = rec.actions || [];
  const trigActs = (rec.triggers || []).flatMap(t => t.actions || []);
  const allOps = new Set([...acts, ...trigActs].map(a => a.op));
  const allTypes = new Set([...acts, ...trigActs].map(a => a.effect?.type).filter(Boolean));
  const covers = new Set(rec.covers || []);
  const deferredTxt = (rec.deferred || []).join(' | ').toLowerCase();

  if (cell.dmg)   return allOps.has('DEAL_DAMAGE') ? 'IMPL' : 'MISS';
  if (cell.heal)  return allOps.has('HEAL') ? 'IMPL' : 'MISS';
  if (cell.revive) return allOps.has('REVIVE') ? 'IMPL' : 'MISS';
  if (cell.mod)   return (rec.modifiers || []).some(m => m.kind === 'incoming_damage') ? 'IMPL' : 'MISS';
  if (cell.eng)   return (allTypes.has(cell.eng) || covers.has(cell.eng)) ? 'IMPL' : (deferredTxt.includes(cell.eng.toLowerCase()) ? 'DEFER' : 'MISS');
  if (cell.op === 'immune') return (rec.immune || []).length ? 'IMPL' : 'MISS';
  if (cell.op === 'sponge') return rec.sponge ? 'IMPL' : 'MISS';
  if (cell.op === '__none__') return 'MISS';   // benchmark clause with no implementing op by design
  if (cell.op)    return allOps.has(cell.op) ? 'IMPL' : (deferredTxt.includes(String(cell.op).toLowerCase()) ? 'DEFER' : 'MISS');
  return 'MISS';
}

// ── TRACE: aggregate res.effects across N seeds ──────────────────────────────────────────────────────
function main() {
  if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
  const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
  const _cache = new Map();
  const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };
  return run(rest);
}

async function run(rest) {
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
  const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
  if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

  // aggregate: key -> { count, seeds:Set }
  const dmgBySlot = new Map();   // `${key}|${slot}`
  const subByChamp = new Map();  // `${key}|${subtype}`
  const kindByChamp = new Map(); // `${key}|heal|${slot}` , `${key}|revive|${slot}`
  const bump = (map, k, seed) => { const e = map.get(k) || { count: 0, seeds: new Set() }; e.count++; e.seeds.add(seed); map.set(k, e); };
  let wins = 0, totalTurns = 0;

  // ── REALIZED DURATION aggregates (declared vs how long the effect actually stayed active) ──
  // Two independent measures per effect TYPE:
  //   dot:     exact from the ledger — ticks (kind 'dot') per placement (kind 'debuff'). A DoT declared 2t
  //            should tick ~2×; if the consume strips it early it ticks fewer. This is the HP-Burn test.
  //   census:  read-only board sample each turn the BEARER acts (durations are counted in the bearer's OWN
  //            turns) — mean own-turns a placed effect is still present. Works for non-DoT buffs/debuffs.
  const place = {};   // type -> landed placements (kind buff/debuff, consumed !== false)
  const ticks = {};   // type -> dot ticks
  const seen  = {};   // type -> bearer-own-turn sightings (census)
  const addT = (o, t, n = 1) => { o[t] = (o[t] || 0) + n; };

  for (let seed = 1; seed <= N; seed++) {
    const built = await buildBattle({ rest, fixture, repoRoot: REPO });
    applyBattleLayers(built.allies);
    const st = makeState({ allies: built.allies, enemies: [], seed });
    installRecipeRun(st);
    // READ-ONLY census: wrap the interpreter's onTurnStart (does NOT mutate state → golden-safe). Each time a
    // combatant takes its own turn, tally every distinct buff/debuff type currently on it = one own-turn of life.
    const origOTS = st.onTurnStart;
    st.onTurnStart = (s, actor) => {
      origOTS?.(s, actor);
      const types = new Set([...(actor.buffs || []), ...(actor.debuffs || [])].map(e => e.type).filter(Boolean));
      for (const t of types) addT(seen, t);
    };
    const res = simulate(st, built.content, { turnCap: 400 });
    if (res.won) wins++;
    totalTurns += res.turns || 0;
    for (const e of res.effects || []) {
      if (!e.source) continue;
      const k = champKey(e.source);
      if (e.kind === 'damage') bump(dmgBySlot, `${k}|${e.slot}`, seed);
      if (e.kind === 'heal') bump(kindByChamp, `${k}|heal`, seed);
      if (e.kind === 'revive') bump(kindByChamp, `${k}|revive`, seed);
      if (e.subtype) bump(subByChamp, `${k}|${e.subtype}`, seed);
      // realized-duration inputs
      if ((e.kind === 'buff' || e.kind === 'debuff') && e.subtype && e.consumed !== false) addT(place, e.subtype);
      if (e.kind === 'dot' && e.subtype) addT(ticks, e.subtype);
    }
  }

  // realized duration per type: exact tick-ratio for DoTs, census own-turns for the rest
  const declaredTurns = (d) => { const m = /(\d+)t/.exec(String(d)); return m ? Number(m[1]) : null; };
  const realized = (type, isDot) => {
    const p = place[type] || 0; if (!p) return null;
    if (isDot) return ticks[type] ? +(ticks[type] / p).toFixed(1) : 0;
    return seen[type] ? +(seen[type] / p).toFixed(1) : 0;
  };

  // fired lookup for a cell → { pct, perFight } or null
  const fired = (key, slot, cell) => {
    let hit = null;
    if (cell.dmg) hit = dmgBySlot.get(`${key}|${slot}`);
    else if (cell.heal) hit = kindByChamp.get(`${key}|heal`);
    else if (cell.revive) hit = kindByChamp.get(`${key}|revive`);
    else if (cell.eng) hit = subByChamp.get(`${key}|${cell.eng}`);
    else return { unobservable: true };   // continuous modifiers / execute passive: not point-ledgered
    if (!hit) return { pct: 0, perFight: 0 };
    return { pct: Math.round(100 * hit.seeds.size / N), perFight: +(hit.count / N).toFixed(1) };
  };

  // ── PRINT ──────────────────────────────────────────────────────────────────────────────────────
  console.log(`\n═══ CAPABILITY MATRIX — ${DUNGEON} ${STAGE}  (benchmark from DB cards; ${N} seeds) ═══`);
  console.log(`  sim win rate ${(100 * wins / N).toFixed(0)}%  ·  avg fight ${Math.round(totalTurns / N)}t`);
  console.log(`  RECIPE: is the card clause implemented in lib/sim/recipes.js?   TRACE: did it fire in the sim?`);
  console.log(`  ${'—'.repeat(112)}`);
  console.log(`  ${'CAT'.padEnd(5)}${'CLAUSE (dissected from card)'.padEnd(60)}${'DUR'.padEnd(6)}${'CHANCE'.padEnd(8)}${'RECIPE'.padEnd(7)}TRACE`);

  const counts = { IMPL: 0, DEFER: 0, MISS: 0 };
  const fireStats = { fired: 0, silent: 0, unobs: 0 };
  const misses = [], silentButImpl = [], durRows = [];

  for (const [champ, def] of Object.entries(CH)) {
    console.log(`\n  ▉ ${champ}  (${def.key})`);
    for (const [slot, sk] of Object.entries(def.skills)) {
      const cdTxt = sk.cd === '-' ? 'passive' : `cd${sk.cd}`;
      console.log(`    ${slot} · ${sk.name}  [${cdTxt}]`);
      for (const cell of sk.cells) {
        const rs = recipeStatus(def.key, slot, cell);
        counts[rs]++;
        const f = fired(def.key, slot, cell);
        let traceTxt;
        if (f.unobservable) { traceTxt = '— (continuous/passive; not point-ledgered)'; fireStats.unobs++; }
        else if (f.pct > 0) { traceTxt = `✓ ${f.pct}% · ${f.perFight}/fight`; fireStats.fired++; }
        else { traceTxt = '✗ NEVER fired'; fireStats.silent++; if (rs === 'IMPL') silentButImpl.push(`${champ} ${slot}: ${cell.label}`); }
        // realized vs declared duration for timed buffs/debuffs/DoTs
        const decl = cell.eng ? declaredTurns(cell.dur) : null;
        if (decl && f.pct > 0) {
          const rz = realized(cell.eng, cell.cat === 'DoT');
          if (rz != null) {
            // who BEARS the effect decides how to read a short realized-duration:
            //   enemy-borne (debuffs/DoT on mobs) — a short reading is confounded by the bearer DYING/being
            //     consumed before its own turn (real on Spider, but not proof the effect is broken).
            //   self-mechanic (Bambus self-Sleep) — removed by design at his next turn → short is EXPECTED.
            //   ally-borne (buffs/shields/heals on our team) — a short reading is a clean early-expiry signal.
            const ENEMY = new Set(['Decrease Speed', 'Decrease Defense', 'Decrease Attack', 'Decrease ACC', 'Enfeeble', 'Poison', 'Poison Sensitivity', 'HP Burn', 'Petrification', 'Stun']);
            const borne = cell.cat === 'SELF' ? (cell.eng === 'Sleep' ? 'self-byDesign' : 'self') : (ENEMY.has(cell.eng) ? 'enemy' : 'ally');
            const strip = rz < decl * 0.6 && borne !== 'self-byDesign';
            traceTxt += ` · dur ${rz}/${decl}t${strip ? ' ⚠SHORT' : ''}`;
            durRows.push({ champ, slot, type: cell.eng, cat: cell.cat, declared: decl, real: rz, isDot: cell.cat === 'DoT', short: strip, borne });
          }
        }
        if (rs === 'MISS') misses.push(`${champ} ${slot} [${cell.cat}]: ${cell.label}`);
        const rsMark = rs === 'IMPL' ? 'IMPL ' : rs === 'DEFER' ? 'defer' : 'MISS ';
        console.log(`      ${cell.cat.padEnd(5)}${cell.label.slice(0, 59).padEnd(60)}${String(cell.dur).padEnd(6)}${String(cell.chance).padEnd(8)}${rsMark.padEnd(7)}${traceTxt}`);
      }
    }
  }

  const total = counts.IMPL + counts.DEFER + counts.MISS;
  console.log(`\n  ${'═'.repeat(112)}`);
  console.log(`  BENCHMARK COVERAGE  (${total} card clauses total)`);
  console.log(`    RECIPE:  ${counts.IMPL} implemented · ${counts.DEFER} deferred · ${counts.MISS} MISSING`);
  console.log(`    TRACE:   ${fireStats.fired} fired · ${fireStats.silent} silent · ${fireStats.unobs} continuous/unobservable`);

  if (misses.length) {
    console.log(`\n  ✗ MISSING FROM THE RECIPE LIST (card clause with no implementation):`);
    for (const m of misses) console.log(`      - ${m}`);
  }
  if (silentButImpl.length) {
    console.log(`\n  ⚠ IMPLEMENTED BUT NEVER FIRED across ${N} seeds (placed-then-inert, or path never reached):`);
    for (const s of silentButImpl) console.log(`      - ${s}`);
  }

  // ── REALIZED DURATION — declared (card) vs how long the effect actually stayed active ──
  console.log(`\n  ${'═'.repeat(112)}`);
  console.log(`  REALIZED DURATION  (declared = card; DoT = exact ticks/placement; others = mean bearer-own-turns present/placement)`);
  console.log(`    ${'EFFECT'.padEnd(20)}${'SRC'.padEnd(9)}${'KIND'.padEnd(7)}${'DECLARED'.padEnd(10)}${'REALIZED'.padEnd(10)}NOTE`);
  const shorts = [];
  for (const r of durRows.sort((a, b) => (a.short === b.short ? 0 : a.short ? -1 : 1) || a.type.localeCompare(b.type))) {
    const note = r.short ? `⚠ only ${(100 * r.real / r.declared).toFixed(0)}% of declared — stripped/expired early` : 'in band';
    console.log(`    ${r.type.padEnd(20)}${champKey(r.champ).padEnd(9)}${(r.isDot ? 'DoT' : 'buff/deb').padEnd(7)}${(r.declared + 't').padEnd(10)}${(r.real + (r.isDot ? ' ticks' : 't')).padEnd(10)}${note}`);
    if (r.short) shorts.push(r);
  }
  const allyShort = shorts.filter(r => r.borne === 'ally');
  const enemyShort = shorts.filter(r => r.borne === 'enemy');
  if (allyShort.length) {
    console.log(`\n  ⚠ ALLY-BORNE effects expiring early (CLEAN signal — our own buffs/heals not lasting their declared duration):`);
    for (const r of allyShort) console.log(`      - ${r.type} (${r.champ} ${r.slot}): declared ${r.declared}t, realized ${r.real} own-turns`);
  }
  if (enemyShort.length) {
    console.log(`\n  ⓘ ENEMY-BORNE effects reading short (CONFOUNDED — the bearer Spiderling dies/gets consumed before its own turn;`);
    console.log(`     this is the HP-Burn cadence signal, but the tool can't yet split "Skavag consumed it" from "our AoE killed it first"):`);
    for (const r of enemyShort) console.log(`      - ${r.type} (${r.champ} ${r.slot}): declared ${r.declared}t, realized ${r.real}${r.isDot ? ' ticks/placement' : ' own-turns'}`);
  }
  if (!shorts.length) console.log(`\n  ✓ no timed effect is expiring materially early — realized durations track their declared values.`);

  console.log(`\nQA_JSON ${JSON.stringify({ rung: 'capability-matrix', dungeon: DUNGEON, stage: STAGE, seeds: N,
    winRate: +(100 * wins / N).toFixed(0), clauses: total, recipe: counts, trace: fireStats,
    missing: misses, silentButImplemented: silentButImpl,
    realizedDuration: durRows.map(r => ({ type: r.type, src: r.champ, declared: r.declared, realized: r.real, dot: r.isDot, short: r.short })),
    earlyExpiry: shorts.map(r => ({ type: r.type, src: r.champ, slot: r.slot, declared: r.declared, realized: r.real })) })}`);
}

main();
