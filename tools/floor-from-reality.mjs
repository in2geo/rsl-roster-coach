#!/usr/bin/env node
// tools/floor-from-reality.mjs — DERIVE stat floors from teams that actually CLEARED a stage,
// then diff them against what the model currently demands.
//
// WHY (Mike, 2026-07-20): "there are no gates in the game... good gear should clear level 20 Dragon
// with the right team. Look at the teams that have cleared level 20 and see what their average stats
// are. Then look at how the model is making the prediction and find where the gap is."
//
// Every survival floor in `stat_threshold_checks` is a hand-set placeholder (CLAUDE.md says so
// explicitly), and each one measured so far is wrong by a MULTIPLE, not a margin:
//   Dragon RES 250-300  vs a ceiling of 119 across six accounts
//   Ice Golem HP 40,000 vs Don$Gnut clearing stage 18 on 15,975
// This tool replaces the guess with a measurement: the observed stat distribution of teams that
// demonstrably cleared, which is also the empirical definition of a gear TIER ("good" = clears 20).
//
// ⚠ TIME CAVEAT: stats come from the CURRENT Gestal snapshot, but the battle may be older, so a
// champion re-geared since then is measured with today's gear. `run_reconciliations` does freeze
// per-champion stats at battle time, but those were computed under the BROKEN stat map (corrected
// 2026-07-20) and are unusable until re-reconciled. Current-snapshot values are the better source
// today; re-check once reconciliation has re-run.
//
// Usage: node --env-file=.env.local tools/floor-from-reality.mjs [stage=20] [dungeonSubstring]
import fs from 'fs';
import { effectiveStats } from '../lib/effective-stats.js';

const STAGE = Number(process.argv[2]) || 20;
const DUNGEON_Q = process.argv[3] ?? null;

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async p => { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { headers: H }); return r.ok ? r.json() : []; };

/* ROLE-AWARE BY RULING (Mike, 2026-07-20): "we can't use blanket stats like avg crit rate is 60
 * because only our attackers are built on crit rate."  A team average mixes a crit-capped nuker
 * with a healer who has 15% base crit and produces a number describing NOBODY. §3.6 already found
 * the same split measuring Attack ATK 1909/CRATE 78 against Support ATK 1092/DEF 1300/CRATE 20.
 *
 * TWO DIFFERENT AXES, deliberately:
 *   • ROLE (the game's own Attack/Defense/Support/HP) drives the BUILD stats — crit, ATK, HP, DEF.
 *   • ACC is NOT role-driven. §3.6: "'is a debuffer' as a champion-level boolean is USELESS — 80 of
 *     96 carry some debuff tag." So ACC is keyed on whether the champion carries a tag that
 *     ACTUALLY needs accuracy to land (is_debuff AND NOT bypasses_accuracy_check) — the same
 *     predicate `landRate` and the engine's carrier-aware ACC check already use. A healer with no
 *     ACC is CORRECT, not under-built, and must not drag the ACC requirement down. */
const champs = await rest('champions?select=id,name,role,champion_tags(status,tags(name,is_debuff,bypasses_accuracy_check))&game_id=eq.raid_shadow_legends&limit=2000');
const aliases = await rest('champion_aliases?select=alias,champion_id&limit=2000');
const idToName = Object.fromEntries(champs.map(c => [c.id, c.name]));
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nameKey = {};
for (const c of champs) nameKey[norm(c.name)] = c.name;
for (const a of aliases) if (idToName[a.champion_id]) nameKey[norm(a.alias)] = idToName[a.champion_id];

/* DoT CARRIER as its own category (Mike, 2026-07-20): "our DoT champs should be built more like
 * supports with accuracy."  Mechanically forced by lib/damage-mechanics.js §1 — Poison, HP Burn and
 * Warmaster scale off the target's MAX HP, so they are DEF-independent AND cannot crit. ATK and
 * C.RATE are dead stats on a pure DoT carrier; what they need is ACC to LAND the debuff and enough
 * bulk to keep re-applying it (sustain is multiplicative, §3). Pooling them into "Attack, crit 83"
 * understates the ACC target and overstates the crit one — the mirror of the Pelops problem.
 *
 * ⚠ THE TAG ALONE IS NOT ENOUGH. Ezio carries Poison but is built 83 crit / 3,045 ATK — he is a crit
 * attacker who also poisons, and classifying him as a DoT carrier would corrupt both buckets. So the
 * test is CARRIES A DoT SOURCE **AND** IS NOT CRIT-BUILT. Xenomorph lands on both sides across
 * accounts (36 crit on DonBrogni -> DoT carrier; 100 on GuapoDonni -> Attack), which is not a bug:
 * it is the same champion genuinely built two different ways, and worth seeing separately.
 *
 * LIMITATION, stated plainly: this describes how champions ARE built, not how they SHOULD be. It is
 * the right instrument for deriving targets from teams that actually cleared; it cannot by itself
 * tell you a given champion is MIS-built. */
const DOT_TAGS = new Set(['Poison', 'HP Burn', 'Necrosis', 'Enemy Max HP Damage']);
const HYBRID_CRIT = 65;
const classify = (role, st, dot) => {
  if (role !== 'Attack' && (st?.crate ?? 0) >= HYBRID_CRIT) return `Hybrid (${role})`;
  if (dot && (st?.crate ?? 0) < HYBRID_CRIT) return 'DoT carrier';
  return role;
};

// role + "needs ACC to do its job" per canonical champion name
const roleOf = {}, needsAcc = {}, isDot = {};
for (const c of champs) {
  roleOf[norm(c.name)] = c.role ?? 'Unknown';
  const approved = (c.champion_tags ?? []).filter(t => t.status === 'approved');
  needsAcc[norm(c.name)] = approved.some(t => t.tags?.is_debuff && !t.tags?.bypasses_accuracy_check);
  isDot[norm(c.name)] = approved.some(t => DOT_TAGS.has(t.tags?.name));
}

/* HYBRID (Mike, 2026-07-20): "champs like Pelops who is HP based but built with high crit will skew
 * the scale." The game's `role` describes what a champion SCALES off, not how the player BUILT them.
 * Pelops is role=HP and carries 102% crit; Underpriest Brogni is role=Support at 99%; Stag Knight
 * role=Support at 70%. Averaging those into "Support crit 32" produces a target no real support is
 * built to, and equally understates the hybrids.
 *
 * The role axis is KEPT (Mike's steer) — a hybrid is reported as its own bucket rather than
 * reclassified, so both the true supports and the crit-built ones stay visible.
 *
 * THRESHOLD IS NOMINAL, chosen from the observed bimodal gap in the Dragon-20 corpus: non-Attack
 * champions cluster at 99/70 then fall to 50/44/38/32, so anything at/above 65 is unambiguously
 * built for damage. Recalibrate when the corpus grows — do NOT treat 65 as a game constant.
 *
 * NB THE CONVERSE ALSO EXISTS and is NOT captured here: a DoT carrier is a damage dealer who does
 * not want crit at all (Xenomorph appears at 36 crit on DonBrogni vs 100 on GuapoDonni — poison is
 * %maxHP and cannot crit). Low crit on a poison carrier is CORRECT, not under-built. Classifying
 * that properly needs the damage-source taxonomy from lib/damage-mechanics.js, not a stat cut. */

// ── the model's declared floors for this stage ──
const dungeons = await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends');
const stages = await rest(`dungeon_stages?select=id,stage_number,dungeon_id&stage_number=eq.${STAGE}&limit=200`);
const phases = await rest('phases?select=id,dungeon_stage_id&limit=3000');
const checks = await rest('stat_threshold_checks?select=phase_id,stat,formula&limit=3000');
const dName = Object.fromEntries(dungeons.map(d => [d.id, d.name]));
const stageIds = Object.fromEntries(stages.map(s => [s.id, dName[s.dungeon_id]]));
const phaseToDungeon = {};
for (const p of phases) if (stageIds[p.dungeon_stage_id]) phaseToDungeon[p.id] = stageIds[p.dungeon_stage_id];
const declared = {};   // dungeon -> stat -> value
for (const c of checks) {
  const d = phaseToDungeon[c.phase_id]; if (!d) continue;
  const v = Number(c.formula); if (!Number.isFinite(v)) continue;
  (declared[d] ??= {})[c.stat] = Math.max(declared[d][c.stat] ?? 0, v);
}

// ── per-account champion stats, on the CORRECTED map ──
const statsByAcct = {};
for (const f of fs.readdirSync('gestal-sync/output').filter(x => x.endsWith('.json') && !/gear-corpus/.test(x))) {
  const s = JSON.parse(fs.readFileSync(`gestal-sync/output/${f}`, 'utf8'));
  const m = {};
  for (const c of s.champions ?? []) {
    const r = effectiveStats(c);
    if (r?.effective) m[norm(c.name)] = r.effective;
  }
  statsByAcct[s.displayName] = m;
}

// ── clears at this stage ──
const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
const battles = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const stageNum = b => { const n = b.stageNumber ?? Number(String(b.stage ?? '').match(/Stage (\d+)/)?.[1]); return Number.isFinite(n) ? n : null; };

const clears = battles.filter(b => b.result === 'Victory' && stageNum(b) === STAGE
  && !/retreat/i.test(b.finishCause ?? '') && (b.heroes ?? []).length === 5
  && (!DUNGEON_Q || String(b.dungeon ?? '').toLowerCase().includes(DUNGEON_Q.toLowerCase())));

const STATS = ['hp', 'atk', 'def', 'spd', 'crate', 'cdmg', 'res', 'acc'];
const byDungeon = {};
const unresolved = new Set();
const perChampion = {};   // dungeon -> role -> stat -> values[]
const seenChamp = new Set();   // dedupe key: dungeon|account|champion
const accCarriers = {};   // dungeon -> { carriers:[], nonCarriers:[] }
for (const b of clears) {
  const acct = statsByAcct[b.displayName]; if (!acct) continue;
  const team = [];
  for (const h of b.heroes) {
    const canonical = nameKey[norm(h.name)];
    const key = acct[norm(h.name)] ? norm(h.name) : (canonical ? norm(canonical) : null);
    const st = key ? acct[key] : null;
    if (!st) { unresolved.add(h.name); continue; }
    team.push(st);
    /* DEDUPE BY (account, champion). Aggregating per APPEARANCE weights whoever is fielded most:
     * Pelops appears in most of Don$Gnut's 36 Dragon-20 clears, which pushed the HP-role median
     * crit to 102 when only THREE distinct HP champions exist (102 / 38 / 15 — true median 38).
     * One champion on one account is one observation, however many times they were run. */
    const canonName = canonical ?? h.name;
    const dedupeKey = `${b.dungeon}|${b.displayName}|${canonName}`;
    if (!seenChamp.has(dedupeKey)) {
      seenChamp.add(dedupeKey);
      const role = classify(roleOf[norm(canonName)] ?? 'Unknown', st, isDot[norm(canonName)]);
      const bucket = ((perChampion[b.dungeon] ??= {})[role] ??= {});
      for (const s of STATS) (bucket[s] ??= []).push(st[s] ?? 0);
      (bucket._who ??= []).push(canonName);
      const ac = (accCarriers[b.dungeon] ??= { carriers: [], nonCarriers: [] });
      (needsAcc[norm(canonName)] ? ac.carriers : ac.nonCarriers).push(st.acc ?? 0);
    }
  }
  if (team.length !== 5) continue;
  const rec = { acct: b.displayName, turns: b.turns, dur: b.durationSeconds };
  for (const s of STATS) {
    rec[`min_${s}`] = Math.min(...team.map(t => t[s] ?? 0));
    rec[`max_${s}`] = Math.max(...team.map(t => t[s] ?? 0));
    rec[`avg_${s}`] = Math.round(team.reduce((a, t) => a + (t[s] ?? 0), 0) / 5);
  }
  (byDungeon[b.dungeon ?? '?'] ??= []).push(rec);
}

const med = a => a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : null;
console.log(`\n══ STAGE ${STAGE} — what teams that ACTUALLY CLEARED look like ══`);
if (unresolved.size) console.log(`  (unresolved champion names, excluded: ${[...unresolved].slice(0, 6).join(', ')})`);

for (const [dungeon, list] of Object.entries(byDungeon)) {
  console.log(`\n── ${dungeon} — ${list.length} clear(s), ${new Set(list.map(l => l.acct)).size} account(s) ──`);
  console.log(`   accounts: ${[...new Set(list.map(l => l.acct))].join(', ')}`);
  const dec = declared[dungeon] ?? {};
  console.log(`\n   stat    TEAM-MIN (median)   TEAM-AVG (median)   MODEL DEMANDS   VERDICT`);
  for (const s of ['hp', 'acc', 'res', 'spd', 'crate', 'cdmg']) {
    const mn = med(list.map(l => l[`min_${s}`]));
    const av = med(list.map(l => l[`avg_${s}`]));
    const d = dec[s];
    let verdict = d == null ? '— no floor declared' : '';
    if (d != null) {
      const ratio = mn / d;
      verdict = ratio >= 1 ? `floor is BELOW reality (${(ratio).toFixed(1)}x)`
              : `⚠ MODEL DEMANDS ${(1 / ratio).toFixed(1)}x MORE THAN REALITY`;
    }
    console.log(`   ${s.toUpperCase().padEnd(6)} ${String(mn).padStart(12)}     ${String(av).padStart(12)}     ${String(d ?? '—').padStart(11)}   ${verdict}`);
  }
  const durs = list.map(l => l.dur).filter(Boolean);
  if (durs.length) console.log(`\n   clear time: median ${Math.round(med(durs))}s  (range ${Math.min(...durs)}-${Math.max(...durs)}s)`);

  // ── PER-ROLE build profile: the number a predictor can actually use ──
  const roles = perChampion[dungeon] ?? {};
  console.log(`\n   ── BY ROLE (median per champion, not per team) ──`);
  console.log(`   ${'role'.padEnd(18)}  n     HP    ATK    DEF   SPD  C.RATE C.DMG    ACC    RES`);
  for (const [role, b] of Object.entries(roles).sort((a, b) => b[1].hp.length - a[1].hp.length)) {
    const q = (s, w = 6) => String(med(b[s] ?? []) ?? '—').padStart(w);
    console.log(`   ${role.padEnd(18)}${String(b.hp.length).padStart(3)} ${q('hp')} ${q('atk')} ${q('def')} ${q('spd', 5)} ${q('crate', 6)} ${q('cdmg', 5)} ${q('acc')} ${q('res')}`
      + `   ${[...new Set(b._who ?? [])].join(', ')}`);
  }

  // ── ACC split by whether the champion actually needs it ──
  const ac = accCarriers[dungeon];
  if (ac && (ac.carriers.length || ac.nonCarriers.length)) {
    console.log(`\n   ── ACC, split by whether the champion carries an ACC-GATED debuff ──`);
    console.log(`   carries one     n=${String(ac.carriers.length).padStart(3)}  median ACC ${String(med(ac.carriers) ?? '—').padStart(4)}   <-- THIS is the number a floor should compare against`);
    console.log(`   carries none    n=${String(ac.nonCarriers.length).padStart(3)}  median ACC ${String(med(ac.nonCarriers) ?? '—').padStart(4)}   (correctly un-built for ACC — must not drag the floor down)`);
    console.log(`   model demands ${dec.acc ?? '—'} of the TEAM MINIMUM, i.e. of the healer too.`);
  }
}
console.log('\nTEAM-MIN is the number the engine compares against (survival floors are team-minimum).');
