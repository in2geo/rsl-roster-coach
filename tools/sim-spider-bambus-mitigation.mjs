// tools/sim-spider-bambus-mitigation.mjs — is Bambus's MITIGATION STACK actually applying?
//
// Theory #4 (Mike 2026-07-30): Bambus's shield hits 0 (feeding him to the swarm) despite a heavy mitigation
// stack — Ally Protection (Vergis A2, redirects 50% of his incoming to Vergis), Decrease ATK on the boss
// (Bambus A3, −50% AoE), Enfeeble on the spiderlings (Bambus A3, ×0.70 hits), and 3 shield pools. If those
// were live his shield would never drain. This measures PRESENCE + EFFECT of each layer over the fight:
//   • fraction of turns Bambus is under [Ally Protection]
//   • fraction of turns the BOSS is under [Decrease Attack]
//   • fraction of spiderlings under [Enfeeble] at any moment
//   • Bambus shield value over time + how often it is 0
//   • Bambus damage taken split DIRECT (shield-absorbable) vs POISON (bypasses shields)
//   • the Ally-Protection REDIRECT total off Bambus (proves the redirect fires)
//
// Observe-only (onTurnStart + onDamageTaken hooks). Run: node --env-file=.env.local tools/sim-spider-bambus-mitigation.mjs [N=20]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 20);
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const shieldPool = (c) => (c.buffs || []).reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);
const hasBuff = (c, t) => (c.buffs || []).some((b) => b.type === t);
const hasDeb = (c, t) => (c.debuffs || []).some((d) => d.type === t);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const fmt = (n) => n == null ? '—' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
const pct = (x) => Math.round(100 * x) + '%';

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }
const bambusKey = probe.allies.map((a) => champKey(a.name)).find((k) => /bambus/i.test(k));

const agg = { apUptime: [], datkUptime: [], enfShare: [], shieldZeroShare: [], medShield: [], directTaken: [], poisonTaken: [], apRedirect: [], spawnRounds: [] };

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const bam = built.allies.find((a) => champKey(a.name) === bambusKey);

  let ticks = 0, apOn = 0, datkOn = 0, shieldZero = 0;
  const enfShares = [], shieldVals = [];
  const orig = st.onTurnStart;
  st.onTurnStart = (s, actor) => {
    orig?.(s, actor);
    ticks++;
    if (hasBuff(bam, 'Ally Protection')) apOn++;
    const boss = (s.enemies || []).find((e) => e.role === 'boss');
    if (boss && hasDeb(boss, 'Decrease Attack')) datkOn++;
    const adds = (s.enemies || []).filter((e) => e.role === 'add' && e.alive);
    if (adds.length) enfShares.push(adds.filter((e) => hasDeb(e, 'Enfeeble')).length / adds.length);
    const sp = shieldPool(bam);
    shieldVals.push(sp);
    if (sp <= 0 && bam.alive) shieldZero++;
  };
  // damage taken on Bambus, split direct vs poison, via onDamageTaken (direct) + effects (dot)
  let direct = 0;
  st.onDamageTaken = (s, target, attacker, toHp) => { if (champKey(target.name) === bambusKey) direct += Math.max(0, toHp || 0); };

  const res = simulate(st, built.content, { turnCap: 400 });

  // poison taken on Bambus + Ally-Protection redirect off Bambus, from the ledger
  let poison = 0, apRedirect = 0;
  for (const e of (res.effects || [])) {
    const amt = e.amount ?? 0;
    if (champKey(e.target || '') === bambusKey && e.kind === 'dot') poison += amt;
    if (e.kind === 'redirect' && champKey(e.source || e.from || '') === bambusKey) apRedirect += amt;   // best-effort: redirect FROM Bambus
  }

  agg.apUptime.push(ticks ? apOn / ticks : 0);
  agg.datkUptime.push(ticks ? datkOn / ticks : 0);
  agg.enfShare.push(enfShares.length ? enfShares.reduce((s, x) => s + x, 0) / enfShares.length : 0);
  agg.shieldZeroShare.push(ticks ? shieldZero / ticks : 0);
  agg.medShield.push(median(shieldVals) || 0);
  agg.directTaken.push(direct);
  agg.poisonTaken.push(poison);
  agg.apRedirect.push(apRedirect);
}

console.log(`\n═══ BAMBUS MITIGATION STACK — Spider's Den 13  (${N} seeds, medians) ═══`);
console.log(`\n  MITIGATION PRESENCE (should be HIGH if the stack is protecting him):`);
console.log(`    [Ally Protection] on Bambus:      ${pct(median(agg.apUptime))} of turns   (Vergis A2 → −50% of his incoming redirected to Vergis)`);
console.log(`    [Decrease Attack] on the BOSS:    ${pct(median(agg.datkUptime))} of turns   (Bambus A3 → boss AoE roughly halved)`);
console.log(`    [Enfeeble] on the spiderlings:    ${pct(median(agg.enfShare))} of the swarm  (Bambus A3 → their hits ×0.70)`);
console.log(`\n  BAMBUS SHIELD:`);
console.log(`    median shield value:              ${fmt(median(agg.medShield))}`);
console.log(`    fraction of turns at 0 shield:    ${pct(median(agg.shieldZeroShare))}   (high ⇒ exposed → lowest effHP → tunneled)`);
console.log(`\n  BAMBUS DAMAGE TAKEN (split):`);
console.log(`    DIRECT (shield-absorbable):       ${fmt(median(agg.directTaken))}`);
console.log(`    POISON (bypasses shields):        ${fmt(median(agg.poisonTaken))}`);
console.log(`    Ally-Protection redirect off him: ${fmt(median(agg.apRedirect))}   (0 ⇒ the redirect is NOT firing → theory #4 confirmed)`);

console.log(`\n  ▶ READ: any mitigation layer at LOW uptime, or AP-redirect ~0, is an unapplied-mitigation bug (theory #4).`);
console.log(`         If all layers are HIGH and shield still hits 0, the incoming volume itself is the story (spawn/AoE cadence).`);

console.log(`\nQA_JSON ${JSON.stringify({ rung: 'bambus-mitigation', seeds: N,
  allyProtectionUptime: +median(agg.apUptime).toFixed(2), decreaseAtkUptime: +median(agg.datkUptime).toFixed(2),
  enfeebleShare: +median(agg.enfShare).toFixed(2), shieldZeroShare: +median(agg.shieldZeroShare).toFixed(2),
  medShield: Math.round(median(agg.medShield)), directTaken: Math.round(median(agg.directTaken)),
  poisonTaken: Math.round(median(agg.poisonTaken)), apRedirect: Math.round(median(agg.apRedirect)) })}`);
