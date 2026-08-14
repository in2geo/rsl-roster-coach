// tools/handcalc/scaffold.mjs — HAND-CALC SCAFFOLD GENERATOR.
//
// Does the from-scratch SETUP that must never be skipped or approximated: pulls the team's kits VERBATIM from
// the DB, the enemy stat blocks + affinity, and writes (1) a KITS-<dungeon>-<stage>.md clause-by-clause spec and
// (2) a runnable starter <dungeon>-<stage>.mjs that imports the shared engine — enemy blocks filled from data,
// team stats and unknowns left as explicit ⚙ ASK slots (NOT knobs to fit), kits as fill-in stubs.
//
// This makes "from scratch" = "run the scaffold, then author the kits + walk the video" — the correct path is
// now the fast path. Run:  node --env-file=.env.local tools/handcalc/scaffold.mjs <dungeon> <stage> Name1,Name2,...
//   e.g.  node --env-file=.env.local tools/handcalc/scaffold.mjs "Dragon's Lair" 20 Michelangelo,Xenomorph,Ezio Auditore,Hilvi,Iudex Artor
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [,, dungeonArg, stageArg, teamArg] = process.argv;
if (!dungeonArg || !stageArg || !teamArg) {
  console.error('usage: node --env-file=.env.local tools/handcalc/scaffold.mjs "<Dungeon>" <stage> Name1,Name2,...');
  process.exit(1);
}
const stage = Number(stageArg);
const team = teamArg.split(',').map(s => s.trim());
const q = s => String(s).replace(/'/g, "\\'");   // escape apostrophes for JS single-quoted string literals
const slug = dungeonArg.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('needs SUPABASE_URL + SUPABASE_SERVICE_KEY (run with --env-file=.env.local)'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = async p => { const r = await fetch(`${BASE}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };

// ── pull team kits verbatim ──
const inList = team.map(n => `"${n.replace(/"/g, '')}"`).join(',');
const champs = await rest(`champions?select=id,name,affinity,type_id&name=in.(${inList})`);
const byName = Object.fromEntries(champs.map(c => [c.name, c]));
const missing = team.filter(n => !byName[n]);
if (missing.length) console.error(`⚠ champions not found (check exact names): ${missing.join(', ')}`);

const kitOf = {};
for (const c of champs) {
  kitOf[c.name] = await rest(`champion_skills?select=slot,skill_name,skill_summary,cooldown_base,damage_multiplier,multiplier_type&champion_id=eq.${c.id}&order=slot`);
}

// ── pull the stage's enemies + affinity ──
const dun = (await rest(`dungeons?select=id,name&name=eq.${encodeURIComponent(dungeonArg)}&limit=1`))[0];
let enemies = [], stageAff = '?';
if (dun) {
  enemies = await rest(`dungeon_stage_enemies?select=enemy_name,enemy_role,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.${dun.id}&stage_number=eq.${stage}`);
  const aff = await rest(`dungeon_stage_affinities?select=affinity&dungeon_id=eq.${dun.id}&stage_number=eq.${stage}&limit=1`);
  stageAff = aff[0]?.affinity ?? '?';
} else console.error(`⚠ dungeon "${dungeonArg}" not found — enemy blocks left as ⚙ stubs`);
const boss = enemies.find(e => e.enemy_role === 'boss');
const waves = enemies.filter(e => e.enemy_role !== 'boss');

// ═══ write KITS-<slug>-<stage>.md ═══
const kitMd = [];
kitMd.push(`# Hand-calc kit spec — ${dungeonArg} Stage ${stage} (${team.join(' / ')})`);
kitMd.push(`\nEvery clause → **MODEL** (how) / **DEFER** (why). Format per tools/handcalc/KITS.md. Boss = **${stageAff}** affinity.`);
kitMd.push(`\n## Cross-cutting reminders (fill in per the fight)`);
kitMd.push(`- **Decrease DEF = lasting TEAM-WIDE multiplier** (60%, no stack) via engine \`enemyDef\` — not per-caster.`);
kitMd.push(`- **DoT on a boss is CAPPED** (absolute per-stack value, e.g. Dragon 46,293/stack) — ⚙ ASK: the per-tick value on THIS boss.`);
kitMd.push(`- **Warmaster** on the boss is a real damage source — ⚙ ASK: proc value + which champs run it (game import masteryIds).`);
kitMd.push(`- **Affinity** (boss ${stageAff}): weak/neutral/strong per the wheel; DoT + %MaxHP are affinity-independent.`);
kitMd.push(`- **DEF-mit level**: enemy→champ uses champ L60; champ→boss is CALIBRATED per boss (⚙ from a known hit).`);
for (const name of team) {
  const c = byName[name]; if (!c) { kitMd.push(`\n## ${name} — ⚠ NOT FOUND IN DB`); continue; }
  kitMd.push(`\n## ${name} (${c.affinity})`);
  for (const s of kitOf[name] || []) kitMd.push(`- **[${s.slot}] ${s.skill_name}** (cd ${s.cooldown_base ?? '-'}, mult ${s.damage_multiplier ?? '-'} ${s.multiplier_type ?? ''}) — 🟡 MODEL/DEFER:\n  ${(s.skill_summary||'').replace(/\s+/g,' ').trim()}`);
}
kitMd.push(`\n## Boss / enemies (from dungeon_stage_enemies)`);
if (boss) kitMd.push(`- **BOSS ${boss.enemy_name}:** HP ${boss.hp} · ATK ${boss.atk} · DEF ${boss.def} · SPD ${boss.spd} · RES ${boss.res} · ACC ${boss.acc}. Kit + rotation ⚙ from ${slug.toUpperCase()}_REVIEW.md + the video walk.`);
for (const w of waves) kitMd.push(`- wave ${w.enemy_name}: HP ${w.hp} ATK ${w.atk} DEF ${w.def} SPD ${w.spd}`);
if (!enemies.length) kitMd.push(`- ⚙ no enemy rows in dungeon_stage_enemies — pull wave data from data/${slug}-wave-data.json or a screenshot.`);
kitMd.push(`\n## ⚙ OPEN QUESTIONS FOR MIKE (answer as we walk — do NOT fit knobs)`);
kitMd.push(`1. Boss rotation order + cooldowns. 2. Any %MaxHP / bar mechanic size. 3. DoT cap per-tick on the boss.\n4. Warmaster proc value + rate. 5. Champ→boss direct: one known hit (value + crit/normal + buffs) to pin the DEF curve.\n6. The turn-by-turn video walk (boss actions + HP% + deaths/revives).`);
const kitPath = path.join(REPO, 'tools', 'handcalc', `KITS-${slug}-${stage}.md`);
fs.writeFileSync(kitPath, kitMd.join('\n') + '\n');

// ═══ write <slug>-<stage>.mjs starter ═══
const enemyLit = e => `makeEnemy({ name:'${q(e.enemy_name)}', aff:'${stageAff}', level:60/*⚙*/, hp:${e.hp}, atk:${e.atk}, def:${e.def}, spd:${e.spd}, res:${e.res}, acc:${e.acc}, cr:${e.crit_rate}, cdmg:${e.crit_dmg}${e.enemy_role==='boss'?', isBoss:true':''} })`;
const js = `// tools/handcalc/${slug}-${stage}.mjs — INDEPENDENT ${dungeonArg} st${stage} hand-calc (generated by scaffold.mjs).
// Imports the SHARED engine; supply ONLY team stats + enemy blocks + verbatim kits (KITS-${slug}-${stage}.md).
// ⚙ = ASK MIKE / calibrate against the video — NEVER a knob to fit. Run: TRACE=1 node tools/handcalc/${slug}-${stage}.mjs
import { makeChampion, makeEnemy, makeState, hit, placePoison, detonatePoison, dealToAlly, enemyTarget,
  runPhase, report, aliveT, aliveE, lowestHpE, F, log, dotWeight, tickBuffs } from './engine.mjs';

// ═══ ⚙ KNOBS — confirm each with Mike (KITS-${slug}-${stage}.md §OPEN) ═══
const knobs = {
  champHitL: 150,        // ⚙ champ→boss DEF-mit level (calibrate from ONE known hit: value + crit/normal + buffs)
  poisonTickBoss: 0,     // ⚙ capped poison per-stack on this boss (0 = none until confirmed)
  wmValue: 0, wmProc: 0.45,  // ⚙ Warmaster proc value + rate (from the game import; 0 = no WM champs)
  debuffCap: 10, arena: 1.06, turnCap: 600,
};

// ═══ TEAM — ⚙ REPLACE with CONFIRMED CURRENT GEAR (node --env-file=.env.local tools/build-from-sync.mjs --memory "${team.join(',')}").
// wm:true for Warmaster champs. Survival config: evade / evadeUnderTaunt / nullifyOverHalfMaxHp / shieldOnHitPctAtk. ═══
const ROSTER = [
${team.map(n => `  { name:'${q(n)}', aff:'${byName[n]?.affinity||'?'}', hp:0/*⚙*/, atk:0, def:0, spd:0, cr:0, cdmg:0, acc:0, res:0, ls:0 },`).join('\n')}
];
const st = makeState(ROSTER.map(s => makeChampion(s, knobs.arena)), knobs);

// ═══ ENEMIES (from dungeon_stage_enemies) ═══
${boss ? `const BOSS = () => ${enemyLit(boss)};` : `// ⚙ no boss row found — define BOSS() with the real stat block.`}
${waves.length ? `const WAVE = () => [\n${waves.map(w => '  '+enemyLit(w)+',').join('\n')}\n];` : `// ⚙ no wave rows — define WAVE() from data/${slug}-wave-data.json if this dungeon has waves.`}

// ═══ TEAM KITS — author from KITS-${slug}-${stage}.md, clause-by-clause. Use hit(st,c,e,coeff,hits,ignoreFrac),
// placePoison(st,c,e,ev), detonatePoison(st,e). tgt = lowestHpE(st). ═══
function actChamp(st, c){
  ['A1','A2','A3'].forEach(s=>c.cd[s]=Math.max(0,(c.cd[s]||0)-1)); tickBuffs(c);
  const tgt = lowestHpE(st); const n = c.name;
  // ⚙ TODO: one 'if (n===...) { ... }' block per champion, verbatim from the kit spec.
  if (tgt) hit(st, c, tgt, 1);   // placeholder A1
}

// ═══ BOSS / MOB KITS — author from the *_REVIEW.md + the video rotation. ═══
function actBoss(st, boss, bs){
  boss.cd.a = Math.max(0,(boss.cd.a||0)-1);
  for (const c of aliveT(st)){ const raw = boss.atk*3*/*⚙ skill mult*/1*(boss.decAtk>0?0.5:1); dealToAlly(st, boss, c, raw, false, boss._skill='Swipe'); }
}
${waves.length ? `function actMob(st, m, bs){ const t = enemyTarget(st); if(!t) return; /* ⚙ author mob kits */ }` : ''}

// ═══ RUN — ⚙ set the phase order for this dungeon (waves then boss, or boss-only). ═══
const REAL = { /* ⚙ paste the victory-screen per-hero: Name:{taken,dealt,healed,died} */ };
${waves.length ? `runPhase(st, WAVE(), { label:'WAVE', actChamp, actEnemy: actMob });` : ''}
${boss ? `runPhase(st, [BOSS()], { label:'BOSS', isBoss:true, actChamp, actEnemy: actBoss });` : ''}
report(st, REAL, '${q(dungeonArg)} st${stage}');
`;
const jsPath = path.join(REPO, 'tools', 'handcalc', `${slug}-${stage}.mjs`);
if (fs.existsSync(jsPath)) { fs.writeFileSync(jsPath + '.new', js); console.log(`  (exists — wrote ${path.relative(REPO, jsPath)}.new so the authored file isn't clobbered)`); }
else fs.writeFileSync(jsPath, js);

console.log(`\n✅ scaffolded ${dungeonArg} st${stage}:`);
console.log(`   • ${path.relative(REPO, kitPath)}  (verbatim kits + open questions)`);
console.log(`   • ${path.relative(REPO, jsPath)}  (starter using engine.mjs)`);
console.log(`\nNEXT: (1) fill ROSTER with confirmed gear (build-from-sync --memory), (2) author actChamp/actBoss from the KITS spec,`);
console.log(`      (3) walk it against Mike's video, answering each ⚙ — do NOT fit knobs to the totals.`);
