// tools/handcalc/engine.mjs — SHARED hand-calc engine (dungeon-agnostic core).
//
// The reusable half of the DUNGEON_TEMPLATE: formulas, the TM scheduler, capped/per-placer DoT, the champ→enemy
// and enemy→champ damage functions, targeting, and the report-vs-reality harness. Extracted from cb.mjs +
// dragon.mjs (two worked instances). A per-dungeon file supplies ONLY the team stats, enemy stat blocks, and the
// verbatim kits (actChamp / actEnemy). Imports NOTHING from lib/sim — clean-room by construction.
//
// State-based: every function takes `st` (from makeState) so multiple fights don't share globals.
// Champion-specific SURVIVAL is data, not hardcoded names — set on the combatant: evade, evadeUnderTaunt,
// nullifyOverHalfMaxHp, shieldOnHitPctAtk. Champion-specific OFFENSE (Warmaster) is the `wm` flag.

// ═══ AFFINITY — Magic beats Spirit, Spirit beats Force, Force beats Magic ═══
export const BEATS = { Magic:'Spirit', Spirit:'Force', Force:'Magic' };
export const aff = (a, d) => (!a||!d||a==='Void'||d==='Void') ? 1 : (BEATS[a]===d ? 1.30 : BEATS[d]===a ? 0.70 : 1.0);

// ═══ FORMULAS ═══
// DEF mitigation — retained fraction. L drives the curve (see the per-direction notes in each dungeon file:
// enemy→champ uses the champ's L60; champ→boss is calibrated per boss — a high-L boss barely mitigates).
export const defMit = (def, L=60) => 1 - 0.85 * (1 - Math.exp(-2 * Math.max(0, def) / (50 * L)));
export const critEV = c => 1 + (c.cr/100) * (c.cdmg/100);

// ═══ COMBATANTS ═══
// makeChampion: `s` = a flat stat block {name,aff,hp,atk,def,spd,cr,cdmg,acc,res,ls,wm, evade?, nullify?, ...}.
export function makeChampion(s, arena=1.06) {
  return { ...s,
    maxHp: Math.round(s.hp*arena), hp: Math.round(s.hp*arena), atk: Math.round(s.atk*arena), defv: Math.round(s.def*arena),
    ls: s.ls||0, wm: !!s.wm, side:'ally',
    evade: s.evade ?? 0, evadeUnderTaunt: s.evadeUnderTaunt ?? s.evade ?? 0,
    nullifyOverHalfMaxHp: s.nullifyOverHalfMaxHp ?? 0, shieldOnHitPctAtk: s.shieldOnHitPctAtk ?? 0,
    alive:true, tm:0, cd:{}, dealt:0, taken:0, healed:0, acts:0, deaths:0, buffs:{} };
}
// makeEnemy: `s` = {name,aff,level,hp,atk,def,spd,cr,cdmg,acc,res, isBoss?}.
export function makeEnemy(s) {
  return { ...s, aff: s.aff||'Magic', maxHp:s.hp, side:'enemy', isBoss:!!s.isBoss,
    alive:true, tm:0, cd:{}, poison:[], poisonBy:null,
    decDef:0, decAtk:0, incAtk:0, incSpd:0, weaken:0, leech:0, freeze:0, trueFear:0, infest:0, psens:0,
    scorchArmed:false, scorchFires:0, purpleBar:0 };
}

// ═══ STATE ═══
export function makeState(team, knobs={}) {
  return { team, enemies:[], turn:0,
    TR: !!process.env.TRACE, logs: [],
    knobs: { arena:1.06, debuffCap:10, wmValue:0, wmProc:0.60, poisonTickBoss:0, champHitL:60, ...knobs },
    DOT: { bossPoisonTicks:0, bossPoisonDmg:0, mobPoisonDmg:0 }, INF: { explosions:0, dmg:0 }, HITLOG: {} };
}
export const aliveT = st => st.team.filter(c=>c.alive);
export const aliveE = st => st.enemies.filter(e=>e.alive);
export const lowestHpE = st => aliveE(st).slice().sort((a,b)=>a.hp-b.hp)[0];
export const F = (st,n) => st.team.find(c=>c.name===n);
export const log = (st,s) => st.logs.push(s);
export const dotWeight = e => e.poison.reduce((s,d)=>s+d.w,0) + (e.decDef>0?1:0) + (e.decAtk>0?1:0) + (e.weaken>0?1:0) + (e.leech>0?1:0) + (e.psens>0?1:0);
// enemy effective DEF: team-wide [Decrease DEF] (60%, no stack) + Xeno-style −20% while poisoned; ignoreFrac per-hit.
export const enemyDef = (e, ignoreFrac=0) => e.def * (1 - (e.decDef>0?0.60:0)) * (1 - (e.poison.length>0?0.20:0)) * (1 - ignoreFrac);
export const tickBuffs = c => { for (const b of Object.keys(c.buffs)){ const v=c.buffs[b]; if (v && v.turns!==undefined){ v.turns--; if(v.turns<=0) c.buffs[b]=null; } } };

// ═══ TEAM → ENEMY direct hit. atkMod (Inc/Dec ATK additive) · crit(EV) · DEF-mit@champHitL · affinity · Warmaster
// (boss only) · purple-bar clear · Leech/lifesteal heal off DIRECT. ═══
export function hit(st, c, e, coeff, hits=1, ignoreFrac=0) {
  if (!e || !e.alive) return 0;
  const atkMod = Math.max(0.1, 1 + (c.buffs.incAtk?0.50:0) - (c.buffs.decAttack?0.50:0));   // Inc/Dec ATK ADDITIVE (cancel)
  const per = c.atk * atkMod * coeff * critEV(c) * defMit(enemyDef(e,ignoreFrac), st.knobs.champHitL) * aff(c.aff, e.aff);
  let direct = per*hits; e.hp -= direct;
  let wm = 0;
  if (c.wm && e.isBoss && st.knobs.wmValue>0){ wm = st.knobs.wmValue*st.knobs.wmProc; e.hp -= wm; }
  c.dealt += direct + wm;
  if (e.isBoss && e.purpleBar>0) e.purpleBar = Math.max(0, e.purpleBar - direct - wm);
  const heal = c.ls*(direct+wm) + (e.leech>0 ? 0.18*(direct+wm) : 0);
  if (heal>0){ c.hp=Math.min(c.maxHp, c.hp+heal); c.healed+=heal; }
  if (e.hp<=0) e.alive=false;
  return direct+wm;
}
export const placePoison = (st, c, e, ev) => {   // ev = EV stacks; respect the shared debuff cap
  const w = Math.min(ev, Math.max(0, st.knobs.debuffCap - dotWeight(e)));
  if (w>0){ e.poison.push({ by:c, w, turns:2 }); e.poisonBy = e.poisonBy||c; }
};

// ═══ ENEMY → ALLY damage application. affinity (skipped for %MaxHP e.g. Scorch) · Strengthen · Block Damage ·
// per-champ nullify / evade / shield-on-hit (all combatant config, not names). raw = pre-affinity magnitude. ═══
export function dealToAlly(st, src, c, raw, pctMaxHp=false, label='') {
  if (!c.alive) return 0;
  const landed = raw * (pctMaxHp?1:aff(src.aff, c.aff)) * (c.buffs.strengthen?0.75:1);
  if (c.buffs.blockDamage) return landed;                                    // [Block Damage] negates all direct dmg
  let loss = landed;
  if (c.nullifyOverHalfMaxHp>0 && landed > 0.5*c.maxHp) loss *= (1 - c.nullifyOverHalfMaxHp);   // e.g. Ezio 35% nullify (EV)
  if (c.evade>0){ const ev = c.buffs.taunt ? c.evadeUnderTaunt : c.evade; loss *= (1-ev); }     // e.g. Mikey 15/30% (EV)
  if (c.buffs.shield>0){ const a=Math.min(loss,c.buffs.shield); c.buffs.shield-=a; loss-=a; }
  if (c.shieldOnHitPctAtk>0) c.buffs.shield = c.shieldOnHitPctAtk*c.atk;      // e.g. Mikey A4 re-shield on hit
  c.hp -= loss; c.taken += loss;
  if (c.hp<=0 && c.alive){ c.hp=0; c.alive=false; c.deaths++; if(st.TR) log(st,`        †DIED ${c.name} (${label} landed ${Math.round(landed)})`); }
  return landed;
}

// ═══ ENEMY single-target targeting: lowest-HP ally not under [Perfect Veil]; [Taunt] overrides (if not veiled). ═══
export function enemyTarget(st) {
  const taunter = aliveT(st).find(c=>c.buffs.taunt);
  if (taunter && !taunter.buffs.veil) return taunter;
  const visible = aliveT(st).filter(c=>!c.buffs.veil);
  return (visible.length ? visible : aliveT(st)).slice().sort((a,b)=>a.hp-b.hp)[0];
}

// ═══ DoT ticks on the enemy's turn. Boss poison CAPPED (knobs.poisonTickBoss/stack, no psens); mob poison =
// 5%·maxHP (psens ×1.25, cap 10 stacks). Per-placer credit. ═══
export function tickEnemyPoison(st, e) {
  if (!e.poison.length) return;
  const psens = e.psens>0 ? 1.25 : 1;
  const stacks = e.poison.reduce((s,d)=>s+d.w,0);
  const capF = e.isBoss ? 1 : Math.min(10,stacks)/Math.max(1,stacks);
  let tick = 0;
  for (const d of e.poison){ const t = e.isBoss ? st.knobs.poisonTickBoss*d.w : 0.05*e.maxHp*d.w*capF*psens; tick += t; if(d.by) d.by.dealt += t; }
  e.hp -= tick;
  if (e.isBoss){ st.DOT.bossPoisonTicks++; st.DOT.bossPoisonDmg+=tick; if(e.purpleBar>0) e.purpleBar=Math.max(0,e.purpleBar-tick); }
  else st.DOT.mobPoisonDmg+=tick;
  e.poison.forEach(d=>d.turns--); e.poison = e.poison.filter(d=>d.turns>0);
  if (e.hp<=0) e.alive=false;
}
// DETONATE (e.g. Ezio A2 "instantly activates all Poison"): each poison fires its FULL remaining duration at
// once, then CONSUMED. Per-placer credit. Returns the burst. (Boss: no psens; mob: psens ×1.25.)
export function detonatePoison(st, e) {
  if (!e.poison.length) return 0;
  const psens = e.psens>0 ? 1.25 : 1; let burst=0;
  for (const d of e.poison){ const b=(e.isBoss ? st.knobs.poisonTickBoss*d.w : 0.05*e.maxHp*d.w*psens)*d.turns; burst+=b; if(d.by) d.by.dealt+=b; }
  e.hp-=burst; e.poison=[];
  if (e.isBoss){ st.DOT.bossPoisonDmg+=burst; if(e.purpleBar>0) e.purpleBar=Math.max(0,e.purpleBar-burst); }
  if (e.hp<=0) e.alive=false;
  return burst;
}

// ═══ SCHEDULER — one phase. `actChamp(st,c)` and `actEnemy(st,e,bs)` are the per-dungeon kits. `onEnemyDeath`
// (optional) resolves e.g. Infest chains after any death. Returns the phase summary bs. ═══
const effSpd = u => u.spd * (u.buffs?.incSpd || u.incSpd>0 ? 1.3 : 1);
export function runPhase(st, enemyList, { label, isBoss=false, actChamp, actEnemy, onEnemyDeath }) {
  st.enemies = enemyList; for (const c of st.team) c.tm=0; for (const e of enemyList) e.tm=0;
  const bs = { start:st.turn, allyTurns:0, enemyTurns:0, isBoss };
  if (st.TR){ log(st,`\n═══ ${label} ═══`); log(st,'ENEMIES: '+enemyList.map(e=>`${e.name} HP${Math.round(e.hp)} DEF${e.def} ATK${e.atk} SPD${e.spd}`).join(' | ')); }
  let g=0, CAP=st.knobs.turnCap||600;
  while (aliveT(st).length>0 && aliveE(st).length>0 && g++<CAP*4){
    const units=[...aliveT(st).map(c=>({u:c,s:'a'})), ...aliveE(st).map(e=>({u:e,s:'e'}))];
    const need=Math.min(...units.map(x=>(100-x.u.tm)/effSpd(x.u)));
    for(const x of units) x.u.tm += effSpd(x.u)*need;
    const act=units.sort((a,b)=>(b.u.tm-a.u.tm)||(effSpd(b.u)-effSpd(a.u)))[0];
    act.u.tm-=100; st.turn++;
    const beHp=aliveE(st).reduce((s,e)=>s+Math.max(0,e.hp),0), baHp=aliveT(st).reduce((s,c)=>s+c.hp,0);
    if (act.s==='a'){ bs.allyTurns++; actChamp(st, act.u); act.u.acts++; onEnemyDeath?.(st);
      if (st.TR){ const d=Math.round(beHp-aliveE(st).reduce((s,e)=>s+Math.max(0,e.hp),0));
        log(st,`t${String(st.turn).padStart(3)} ${act.u.name.padEnd(12)} ${(act.u._skill||'').padEnd(42)} ${d>0?'dmg '+d:''}  | ${isBoss?'boss '+(100*Math.max(0,st.enemies[0].hp)/st.enemies[0].maxHp).toFixed(1)+'%'+(st.enemies[0].purpleBar>0?' bar '+Math.round(st.enemies[0].purpleBar):''):aliveE(st).map(e=>Math.round(100*e.hp/e.maxHp)+'%').join(' ')}`); }
    } else {
      bs.enemyTurns++; const e=act.u;
      tickEnemyPoison(st, e); onEnemyDeath?.(st);
      if (!e.alive){ if(st.TR) log(st,`t${String(st.turn).padStart(3)} ${e.name} died`); continue; }
      if (e.freeze>0){ e.freeze=0; if(st.TR) log(st,`t${String(st.turn).padStart(3)} ${e.name.padEnd(12)} [FROZEN — skip]`); continue; }
      actEnemy(st, e, bs);
      for (const c of st.team) if(c.hp<=0 && c.alive){ c.hp=0; c.alive=false; c.deaths++; }
      if (st.TR){ const tk=Math.round(baHp-aliveT(st).reduce((s,c)=>s+c.hp,0));
        log(st,`t${String(st.turn).padStart(3)} ${e.name.padEnd(12)} ${(e._skill||'').padEnd(42)} ${tk>0?'TKN '+tk:''}  | team ${st.team.map(c=>c.alive?Math.round(100*c.hp/c.maxHp)+'%':'DEAD').join(' ')}`); }
    }
  }
  bs.cleared = aliveE(st).length===0; bs.turns=st.turn-bs.start; return bs;
}

// ═══ REPORT vs reality. REAL = { name: {taken,dealt,healed?,died?} }. ═══
export function report(st, REAL, title='FULL-FIGHT WALK') {
  const fmt=n=>Math.round(n).toLocaleString();
  if (st.TR) console.log(st.logs.join('\n'));
  console.log(`\n═══ ${title} ═══   TOTAL ${st.turn} turns`);
  console.log('champ          taken     dealt      | REALITY taken / dealt / died');
  for (const c of st.team){ const r=REAL[c.name]||{};
    console.log(`  ${c.name.padEnd(12)} ${String(fmt(c.taken)).padStart(8)}  ${String(fmt(c.dealt)).padStart(10)}  | ${String(r.taken??'—').padStart(6)} / ${String(r.dealt??'—').padStart(8)} / ${r.died?'died':'lived'}${(c.deaths>0)!==!!r.died?'  ⚠':''}`); }
  console.log(`  boss poison: ${st.DOT.bossPoisonTicks} ticks ${fmt(st.DOT.bossPoisonDmg)}   ·   Infest: ${st.INF.explosions} expl ${fmt(st.INF.dmg)}`);
}
