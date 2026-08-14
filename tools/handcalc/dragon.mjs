// tools/handcalc/dragon.mjs — INDEPENDENT Dragon's Lair hand-calc (st20, DonaHilvi Ezio-Xeno team).
// Clean-room: imports NOTHING from lib/sim. Built per tools/handcalc/DUNGEON_TEMPLATE.md, cloning cb.mjs.
//
// Dragon is a KILL RACE with WAVES (unlike CB's single-boss survival race): 2 waves of 5 Magic mobs, then the
// boss. Combat is BIDIRECTIONAL and MULTI-TARGET. This file walks WAVE 1 action-by-action so it can be checked
// against the reader per-ally HP traces (the reality anchor). Deterministic (EV for %-rolls); ⚙ = calibrate.
//
// Run:  TRACE=1 node tools/handcalc/dragon.mjs           (walk wave 1)
//       ENEMYLVL=60  node ...   (test DEF-mitigation attacker level; mobs are genuinely L280)
//       REALHP=1     node ...   (use real in-battle HP from traces instead of the stale build file)
import fs from 'fs';

// ═══ AFFINITY WHEEL (Magic beats Spirit, Spirit beats Force, Force beats Magic) ═══
const BEATS = { Magic:'Spirit', Spirit:'Force', Force:'Magic' };
const aff = (atk, def) => (!atk||!def||atk==='Void'||def==='Void') ? 1 : (BEATS[atk]===def ? 1.30 : BEATS[def]===atk ? 0.70 : 1.0);

// ═══ DEF MITIGATION — retained-damage fraction. L = ATTACKER level. Mobs genuinely L280 (Mike). ═══
const defMit = (def, L) => 1 - 0.85 * (1 - Math.exp(-2 * Math.max(0, def||0) / (50 * L)));

// ═══ TEAM (stats from data/observed-builds/donahilvi-dragon-ezio-xeno.json; HP overridable to real trace) ═══
const REALHP = !!process.env.REALHP;
const T_LVL = 60;
// build-file stats (fixture inputs). realHp = per-ally startHp read from the reader timeline (2026-08-13 capture).
const TEAM = [
  { name:'Michelangelo', aff:'Spirit', hp:21102, realHp:28131, atk:2546, def:1405, spd:196, cr:59, cd:71, acc:237, res:84, ls:0 },
  { name:'Xenomorph',    aff:'Magic',  hp:17882, realHp:24775, atk:1341, def:1231, spd:160, cr:63, cd:60, acc:170, res:72, ls:0 },
  { name:'Ezio',         aff:'Spirit', hp:19271, realHp:31099, atk:1813, def:970,  spd:161, cr:74, cd:56, acc:60,  res:78, ls:0.30 },
  { name:'Hilve',        aff:'Force',  hp:33425, realHp:45481, atk:1076, def:1305, spd:165, cr:57, cd:65, acc:51,  res:37, ls:0 },
  { name:'Iudex',        aff:'Spirit', hp:28922, realHp:31781, atk:730,  def:1195, spd:148, cr:15, cd:61, acc:35,  res:30, ls:0 },
];
const ARENA = 1.06;   // account arena bonus (HP/ATK/DEF), same as the fixture battle_layer
const critEV = c => 1 + (c.cr/100) * (c.cd/100);

// ═══ WAVE-1 MOBS — exact stats from dungeon_stage_enemies (st20). All Magic, L280. ═══
// Mob damage: Tayrel scales DEF (×1.7/3.5/5.3), Hordin/Crossbowman/Apothecary scale ATK. Verbatim DB mults.
const MOB_LVL = process.env.ENEMYLVL ? +process.env.ENEMYLVL : 280;
const mk = (name, o) => ({ name, aff:'Magic', level:MOB_LVL, ...o, maxHp:o.hp, cd:{}, tm:0, alive:true, buffs:{}, poisonStacks:0 });
const WAVE1 = () => [
  mk('Tayrel#1',      { hp:168516, atk:5894, def:4381, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Hordin#2',      { hp:177770, atk:8363, def:2947, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Crossbowman#3', { hp:144429, atk:7168, def:3266, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Crossbowman#4', { hp:144429, atk:7168, def:3266, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Apothecary#5',  { hp:175910, atk:5814, def:3266, spd:101, acc:133, res:133, cr:15, cdmg:50 }),
];

// ═══ REALITY ANCHORS — reader capture (turns 122) per-ally, slot→champ mapped by sumTaken. ═══
const REAL = {
  Michelangelo:{ taken:58010, dealt:276388, died:true,  bigHits:[10746,7371,18170,6228,12682] },
  Xenomorph:   { taken:29833, dealt:2955167, died:false, bigHits:[5402,5188,7472,9291] },
  Ezio:        { taken:74885, dealt:386562, died:true,  bigHits:[12262,18837,10327,9739,14070] },
  Hilve:       { taken:53180, dealt:318749, died:false, bigHits:[4828,3802,11608,16047,4547,5525] },
  Iudex:       { taken:65737, dealt:36347,  died:true,  bigHits:[9730,7867,22129,12407,8838] },
};
const REAL_TURNS = 121, REAL_WR = 80;

// ── build combatants ──
const team = TEAM.map(c => ({ ...c,
  maxHp: Math.round((REALHP ? c.realHp : Math.round(c.hp*ARENA)) ),
  hp:    Math.round((REALHP ? c.realHp : Math.round(c.hp*ARENA)) ),
  atk: Math.round(c.atk*ARENA), defv: Math.round(c.def*ARENA), level:T_LVL,
  alive:true, tm:0, cdn:{}, dealt:0, taken:0, healed:0, acts:0, buffs:{}, deaths:0 }));
const F = n => team.find(c => c.name===n);
const aliveT = () => team.filter(c=>c.alive);
let wave = WAVE1();
const aliveW = () => wave.filter(m=>m.alive);

// ═══ DAMAGE APPLICATION ═══
function dealToMob(src, mob, coeff, hits, opts={}) {
  if (!mob.alive) return 0;
  const ignoreDef = opts.ignoreDef||0;
  const def = mob.def * (1 - (mob.buffs.decDef?0.60:0)) * (1 - (mob.poisonBy?0.20:0)) * (1-ignoreDef);
  const per = src.atk * coeff * critEV(src) * defMit(def, src.level) * aff(src.aff, mob.aff);
  const dmg = per*hits;
  mob.hp -= dmg; src.dealt += dmg;
  if (src.ls>0) { const h=src.ls*dmg; src.hp=Math.min(src.maxHp,src.hp+h); src.healed+=h; }
  if (mob.hp<=0){ mob.alive=false; }
  return dmg;
}
// Returns the LANDED hit magnitude (what the video shows on a non-evaded hit); applies probabilistic
// mitigations (evade / nullify) as EV only to the HP subtraction, NOT to the reported per-hit number.
function dealToAlly(mob, c, raw, label) {
  if (!c.alive) return 0;
  const landed = raw * aff(mob.aff, c.aff) * (c.buffs.strengthen ? 0.75 : 1);   // Strengthen −25% is deterministic
  let hpLoss = landed;
  if (c.name==='Ezio' && landed > 0.5*c.maxHp) hpLoss *= (1-0.35);              // Full Synchronization 35% nullify (EV)
  if (c.name==='Michelangelo') hpLoss *= (1 - (c.buffs.taunt?0.30:0.15));       // Party Dude evade (EV)
  if (c.buffs.shield && c.buffs.shield>0) { const a=Math.min(hpLoss,c.buffs.shield); c.buffs.shield-=a; hpLoss-=a; }
  c.hp -= hpLoss; c.taken += hpLoss;
  if (c.hp<=0 && c.alive){ c.hp=0; c.alive=false; c.deaths++; if(TR) log(`        †DIED ${c.name} (${label} landed ${Math.round(landed)})`); }
  return landed;
}
const HITLOG = {};   // "MobSkill → Champ" : [dmg...]
function mobDirect(mob, c, coeff, hits, statMult) {
  // statMult: 'DEF'→mob.def, 'ATK'→mob.atk.
  // ENEMY DEBUFFS the team stacks on the mob cut its OUTGOING damage (video-anchored 2026-08-13, Tayrel A2):
  //  • [Decrease Defense] −60% reduces a DEF-SCALING attacker's damage (Tayrel's dmg ∝ his own DEF).
  //  • [Decrease Attack] −50% reduces the final output (all mobs).
  const scaleStat = (statMult==='DEF' ? mob.def * (1 - (mob.buffs.decDef?0.60:0)) : mob.atk);
  const base = scaleStat * coeff;
  const decAtk = mob.buffs.decAtk ? 0.50 : 1;
  const raw = base * defMit(c.defv, mob.level) * (1 + (mob.buffs.incAtk?0.5:0)) * decAtk;
  const critMult = 1 + (mob.cr/100)*(mob.cdmg/100);   // EV crit
  let total=0; for(let i=0;i<hits;i++){ const d=dealToAlly(mob, c, raw*critMult, `${mob._skill||mob.name}`); total+=d;
    const k=`${(mob._skill||mob.name).replace(/ .*/,'')}#${mob.name.replace(/.*#/,'')}→${c.name}`; (HITLOG[`${(mob.name.replace(/#\d/,''))} ${statMult}x${coeff}→${c.aff}`] ??= []).push(Math.round(d)); }
  return total;
}

// ═══ TARGETING ═══
const lowestHpMob = () => aliveW().slice().sort((a,b)=>a.hp-b.hp)[0];
const mobTargetAlly = (mob) => {
  // Taunt forces single-target onto the taunter; Veil hides from single-target
  const taunter = aliveT().find(c=>c.buffs.taunt);
  if (taunter) return taunter;
  const visible = aliveT().filter(c=>!c.buffs.veil);
  const pool = visible.length ? visible : aliveT();
  return pool.slice().sort((a,b)=>(a.hp)-(b.hp))[0];   // lowest current HP
};

// ═══ TEAM KITS (verbatim; deferred clauses noted) ═══
const TR = !!process.env.TRACE;
const logs=[]; const log = s => { logs.push(s); };
function actAlly(c) {
  ['A1','A2','A3'].forEach(s=>c.cdn[s]=Math.max(0,(c.cdn[s]||0)-1));
  for (const b of Object.keys(c.buffs)) if (c.buffs[b]?.turns!==undefined){ c.buffs[b].turns--; if(c.buffs[b].turns<=0) c.buffs[b]=null; }
  const tgt = lowestHpMob(); if(!tgt && c.name!=='Iudex') { c._skill='(no target)'; return; }
  const n=c.name;
  if (n==='Michelangelo') {
    if ((c.cdn.A3||0)<=0){ c._skill='A3 Shell Cyclone (AoE)'; c.cdn.A3=5; for(const m of aliveW()){ dealToMob(c,m,5,1); m.buffs.decAtk=2; m.buffs.leech=2; } c.buffs.taunt={turns:2}; return; }
    if ((c.cdn.A2||0)<=0){ c._skill='A2 Express Delivery'; c.cdn.A2=4; const d=dealToMob(c,tgt,6,1); tgt.buffs.decDef=2; tgt.buffs.stun=1; return; }
    c._skill='A1 Boo-Yah 2x'; dealToMob(c,tgt,2,2); if(c.cr>0) c.buffs.increaseAtk={turns:2}; return;
  }
  if (n==='Xenomorph') {   // AI A3>A2>A1
    if ((c.cdn.A3||0)<=0){ c._skill='A3 Rip and Claw 2x'; c.cdn.A3=4; c.buffs.veil={turns:2}; const nP=tgt.poisonStacks||0; dealToMob(c,tgt,3,2,{}); return; }
    if ((c.cdn.A2||0)<=0){ c._skill='A2 Infestation (Infest+Stun tgt · True Fear others)'; c.cdn.A2=4; c.buffs.veil={turns:2};
      dealToMob(c,tgt,5.9,1); tgt.buffs.stun=2; tgt.infest=2;               // primary target: Stun + INFEST (2t) — the death-bomb seed
      for(const m of aliveW()) if(m!==tgt) m.trueFear=1;                    // TRUE FEAR on all OTHER mobs → restricted to A1 next turn (unresistable under Perfect Veil)
      return; }
    c._skill='A1 Tail Stab +poison'; c.buffs.veil={turns:2}; tgt.poisonStacks=(tgt.poisonStacks||0)+(c.cr/100>=0.5?3:1); tgt.poisonBy=c; dealToMob(c,tgt,3.9,1); return;
  }
  if (n==='Ezio') {
    if ((c.cdn.A2||0)<=0){ c._skill='A2 Da Vinci (AoE poison)'; c.cdn.A2=4; for(const m of aliveW()){ dealToMob(c,m,4,1); m.poisonStacks=(m.poisonStacks||0)+2; m.poisonBy=m.poisonBy||c; m.buffs.psens=2; } return; }
    if ((c.cdn.A3||0)<=0){ c._skill='A3 Hidden Gun'; c.cdn.A3=4; dealToMob(c,tgt,5,1,{ignoreDef:0.35}); return; }
    c._skill='A1 Eagle Dive'; dealToMob(c,tgt,4,1); tgt.buffs.decDef=2; return;
  }
  if (n==='Hilve') {
    if ((c.cdn.A2||0)<=0){ c._skill='A2 Embittering Cold (Freeze all→HP Burn all)'; c.cdn.A2=5;
      for(const m of aliveW()){ m.buffs.freeze=1; m.hpburnBy=c; m.hpburnTurns=2; }  // passive Divine Mission: HP Burn all frozen
      return; }
    c._skill='A1 Frostflame 2x'; dealToMob(c,tgt,2.6,2); tgt.buffs.decDef=2; return;   // A3 revive only if dead ally (handled by priority)
  }
  if (n==='Iudex') {
    const dead = team.filter(x=>!x.alive).sort((a,b)=>a.maxHp-b.maxHp)[0];
    if ((c.cdn.A3||0)<=0 && dead){ c._skill=`A3 Revive ${dead.name}`; c.cdn.A3=6; dead.alive=true; dead.hp=dead.maxHp*0.5; dead.tm=50; return; }
    if ((c.cdn.A2||0)<=0){ c._skill='A2 Inspiration (buff all)'; c.cdn.A2=5; for(const a of aliveT()){ a.tm+=15; a.buffs.increaseAtk={turns:2}; a.buffs.strengthen={turns:2}; } return; }
    c._skill='A1 Censer Whirl (AoE+heal all)'; for(const m of aliveW()) dealToMob(c,m,3.4,1); const h=0.05*c.maxHp; for(const a of aliveT()) a.hp=Math.min(a.maxHp,a.hp+h); c.healed+=h*aliveT().length; return;
  }
}

// ═══ MOB KITS (verbatim; deferred noted) ═══
function actMob(m) {
  ['A1','A2','A3'].forEach(s=>m.cd[s]=Math.max(0,(m.cd[s]||0)-1));
  for (const b of Object.keys(m.buffs)) if (m.buffs[b]?.turns!==undefined){ m.buffs[b].turns--; if(m.buffs[b].turns<=0) m.buffs[b]=null; }
  // [True Fear] (Xeno A2 on all other mobs): the mob STILL acts but is RESTRICTED TO ITS DEFAULT SKILL (A1).
  // It is NOT a turn-skip. Consumed on use (1-turn debuff). This is the DonaHilvi team's core nuke-suppression.
  const forceA1 = m.trueFear>0; if (m.trueFear>0) m.trueFear=0;
  const t = mobTargetAlly(m); if(!t) return;
  const nm = m.name.replace(/#\d+/,'');
  if (nm==='Tayrel') {   // A3(cd5,single,DEFx5.3,TM-)>A2(cd4,AoE,DEFx3.5,DecDEF)>A1(single 2x,DEFx1.7)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Preemptive x5.3'; m.cd.A3=5; mobDirect(m,t,5.3,1,'DEF'); return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Singing Steel AoE x3.5'; m.cd.A2=4; for(const c of aliveT()){ mobDirect(m,c,3.5,1,'DEF'); } return; }
    m._skill=(forceA1?'[TF] ':'')+'A1 Humble 2x x1.7'; mobDirect(m,t,1.7,2,'DEF'); return;
  }
  if (nm==='Hordin') {   // A3(cd6 self buff)>A2(cd4 single ATKx6.5 self-heal)>A1(single 2x ATKx1.9)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Burning Hatred (self buff)'; m.cd.A3=6; m.buffs.incAtk={turns:2}; return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Bloodletter x6.5'; m.cd.A2=4; const d=mobDirect(m,t,6.5,1,'ATK'); m.hp=Math.min(m.maxHp,m.hp+0.10*d); return; }
    m._skill=(forceA1?'[TF] ':'')+'A1 Relentless 2x x1.9'; mobDirect(m,t,1.9,2,'ATK'); return;
  }
  if (nm==='Crossbowman') {   // A3(cd5 single ATKx5.5 Stun)>A2(cd4 buff ally)>A1(single ATKx3.5)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Blunted Arrow x5.5'; m.cd.A3=5; mobDirect(m,t,5.5,1,'ATK'); return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Sharp Eye (buff ally)'; m.cd.A2=4; return; }   // + extra turn (deferred)
    m._skill=(forceA1?'[TF] ':'')+'A1 Snap Shot x3.5'; mobDirect(m,t,3.5,1,'ATK'); return;
  }
  if (nm==='Apothecary') {   // A3(cd5 SPD buff all + 15% TM all)>A2(cd3 heal 35%)>A1(3 random ATKx1.4)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Boon of Speed (+SPD +15%TM all mobs)'; m.cd.A3=5; for(const w of aliveW()){ w.buffs.incSpd={turns:2}; w.tm+=15; } return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Soothing Chant heal35%'; m.cd.A2=3; const hurt=aliveW().slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]; if(hurt){ hurt.hp=Math.min(hurt.maxHp,hurt.hp+0.35*m.maxHp);} return; }
    m._skill=(forceA1?'[TF] ':'')+'A1 Scatterbolt 3xrand x1.4'; for(let i=0;i<3;i++){ const rt=mobTargetAlly(m); if(rt) mobDirect(m,rt,1.4/1,1,'ATK'); } return;
  }
}

// ═══ DoT TICKS (on the victim mob's turn) — POISON + HP-BURN, both %MaxHP, DEF-INDEPENDENT ═══
// This is the team's MAIN wave-clear damage (Xeno/Ezio poison, Hilvi HP Burn) — it bypasses the mobs' high DEF.
const DOT = { poisonTicks:0, poisonDmg:0, burnTicks:0, burnDmg:0 };
function tickMobDots(m) {
  const psens = m.buffs.psens ? 1.25 : 1;   // Ezio [Poison Sensitivity] +25% tick
  if (m.poisonStacks>0 && m.poisonBy){ const t=0.05*m.maxHp*Math.min(10,m.poisonStacks)*psens; m.hp-=t; m.poisonBy.dealt+=t; DOT.poisonTicks++; DOT.poisonDmg+=t; }
  if (m.hpburnTurns>0 && m.hpburnBy){ const t=0.05*m.maxHp; m.hp-=t; m.hpburnBy.dealt+=t; m.hpburnTurns--; DOT.burnTicks++; DOT.burnDmg+=t; }
  if (m.hp<=0) m.alive=false;
}

// ═══ [INFEST] DEATH-EXPLOSION (Xenomorph) — when an Infested mob dies, ALL living mobs take PURE damage =
// 50% of the dead mob's MAX HP (cannot crit; no DEF/affinity). Dragon wave mobs are NOT the boss's minions,
// so the 10% "minion" cap does NOT apply → full 50%. Credited to Xenomorph. CHAINS: an explosion can kill
// another Infested mob → its own explosion (loop until no new Infested deaths). MISSED until Mike surfaced it.
const INF = { explosions:0, dmg:0 };
function resolveInfestDeaths() {
  const xeno = F('Xenomorph');
  let again = true;
  while (again) {
    again = false;
    for (const m of wave) {
      if (!m.alive && m.infest && !m._infestBlew) {
        m._infestBlew = true; again = true; INF.explosions++;
        const dmg = m.maxHp * 0.50;
        for (const s of wave) if (s.alive) { s.hp -= dmg; if (xeno) xeno.dealt += dmg; INF.dmg += dmg; if (s.hp<=0) s.alive=false; }
      }
    }
  }
}

// ═══ TM SCHEDULER — wave 1 until cleared or team wipes ═══
const TURN_CAP=400;
let turn=0, allyTurns=0, mobTurns=0;
if (TR){ log(`\n═══ WAVE 1 TURN-BY-TURN (mobs L${MOB_LVL}, team HP ${REALHP?'REAL':'build×arena'}) ═══`);
  log('ALLIES: '+team.map(c=>`${c.name}(${c.aff[0]}) HP${c.maxHp} ATK${c.atk} DEF${c.defv} SPD${c.spd}`).join(' | '));
  log('W1MOBS: '+wave.map(m=>`${m.name} HP${m.hp} DEF${m.def} ATK${m.atk} SPD${m.spd}`).join(' | ')); }
const effSpd = u => u.spd * (u.buffs?.incSpd?1.3:1);   // Apothecary Boon of Speed (+30% SPD) on mobs
const mobTS = { frozen:0, trueFearA1:0, fullCast:0, nukeCast:0 };   // mob TURN STRUCTURE — the survival driver
let guard=0;
while (aliveT().length>0 && aliveW().length>0 && guard++<TURN_CAP*4) {
  const units=[...aliveT().map(c=>({u:c,side:'a'})), ...aliveW().map(m=>({u:m,side:'m'}))];
  const need=Math.min(...units.map(x=>(100-x.u.tm)/effSpd(x.u)));
  for(const x of units) x.u.tm += effSpd(x.u)*need;
  const act=units.sort((a,b)=>(b.u.tm-a.u.tm)||(effSpd(b.u)-effSpd(a.u)))[0];
  act.u.tm-=100; turn++;
  const beforeMobHp = aliveW().reduce((s,m)=>s+Math.max(0,m.hp),0);
  const beforeAllyHp = aliveT().reduce((s,c)=>s+c.hp,0);
  if (act.side==='a'){
    allyTurns++;
    if (act.u.buffs.freeze){ act.u.buffs.freeze=null; }  // (allies aren't frozen; guard)
    actAlly(act.u); act.u.acts++;
    resolveInfestDeaths();   // a direct hit may have killed an Infested mob → chain-explode
    if (TR){ const dealt=Math.round(beforeMobHp-aliveW().reduce((s,m)=>s+Math.max(0,m.hp),0));
      log(`t${String(turn).padStart(3)} ${act.u.name.padEnd(13)} ${(act.u._skill||'').padEnd(40)} ${dealt>0?'dmg '+dealt:''}  | mobs ${aliveW().map(m=>Math.round(100*m.hp/m.maxHp)+'%').join(' ')}`); }
  } else {
    mobTurns++;
    tickMobDots(act.u);
    resolveInfestDeaths();   // DoT may have killed an Infested mob → 50%·maxHP pure AoE to survivors (chains)
    if (!act.u.alive){ if(TR) log(`t${String(turn).padStart(3)} ${act.u.name} died (DoT${act.u.infest?' + INFEST BLEW ('+Math.round(act.u.maxHp*0.5)+' to all)':''})`); continue; }
    if (act.u.buffs.freeze){ act.u.buffs.freeze=null; mobTS.frozen++; if(TR) log(`t${String(turn).padStart(3)} ${act.u.name.padEnd(13)} [FROZEN — skip]`); continue; }
    const wasTF = act.u.trueFear>0;
    actMob(act.u);
    if (wasTF) mobTS.trueFearA1++; else { mobTS.fullCast++; if (/A2|A3/.test(act.u._skill||'') && /x[0-9]/.test(act.u._skill||'')) mobTS.nukeCast++; }
    if (TR){ const taken=Math.round(beforeAllyHp-aliveT().reduce((s,c)=>s+c.hp,0));
      log(`t${String(turn).padStart(3)} ${act.u.name.padEnd(13)} ${(act.u._skill||'').padEnd(40)} ${taken>0?'TKN '+taken:''}  | team ${team.map(c=>c.alive?Math.round(100*c.hp/c.maxHp)+'%':'DEAD').join(' ')}`); }
  }
}
const cleared = aliveW().length===0;
if (TR) console.log(logs.join('\n'));

// ═══ TURN STRUCTURE — the ACTUAL survival driver (mobs barely act: Freeze + True Fear + outspeed) ═══
const mobActed = mobTS.trueFearA1 + mobTS.fullCast;
console.log(`\n═══ MOB TURN STRUCTURE (wave 1) — the survival driver ═══`);
console.log(`  total mob turns: ${mobTurns}   (ally turns: ${allyTurns}   ratio ally:mob = ${(allyTurns/Math.max(1,mobTurns)).toFixed(1)}:1)`);
console.log(`  frozen/skipped:  ${mobTS.frozen}   (${Math.round(100*mobTS.frozen/Math.max(1,mobTurns))}% of mob turns — did NOTHING)`);
console.log(`  True-Fear→A1:    ${mobTS.trueFearA1}   (${Math.round(100*mobTS.trueFearA1/Math.max(1,mobTurns))}% — restricted to weak A1)`);
console.log(`  free cast:       ${mobTS.fullCast}   of which NUKES (A2/A3 damage): ${mobTS.nukeCast}`);
console.log(`  → mobs delivered a free nuke on only ${mobTS.nukeCast}/${mobTurns} turns (${Math.round(100*mobTS.nukeCast/Math.max(1,mobTurns))}%).`);
console.log(`  DoT: poison ${DOT.poisonTicks} ticks (${Math.round(DOT.poisonDmg).toLocaleString()} dmg)  |  HP-Burn ${DOT.burnTicks} ticks (${Math.round(DOT.burnDmg).toLocaleString()} dmg)`);
console.log(`  INFEST death-explosions: ${INF.explosions}  (${Math.round(INF.dmg).toLocaleString()} pure AoE dmg, credited to Xenomorph)`);

// ═══ REPORT: per-ally taken/dealt vs reality (wave 1 is a fraction of the full fight, so compare SHAPE) ═══
console.log(`\n═══ WAVE 1 RESULT ═══  ${cleared?'CLEARED':'TEAM WIPED'} in ${turn} turns (${allyTurns} ally / ${mobTurns} mob)`);
console.log(`deaths this wave: ${team.filter(c=>c.deaths>0).map(c=>c.name+'×'+c.deaths).join(', ')||'none'}   (reality FULL fight: Mikey/Ezio/Iudex each die once, ~121 total turns)`);
console.log('\nchamp          wave1-taken  wave1-dealt   | REALITY full-fight taken / dealt / biggest-hit');
for (const c of team){ const r=REAL[c.name]||{};
  console.log(`  ${c.name.padEnd(13)} ${String(Math.round(c.taken)).padStart(8)}   ${String(Math.round(c.dealt)).padStart(9)}   | ${String(r.taken).padStart(6)} / ${String(r.dealt).padStart(8)} / ${Math.max(...(r.bigHits||[0]))}`); }

console.log(`\n═══ MOB HIT MAGNITUDES (mobs L${MOB_LVL}, landed hits — evade/nullify are EV on HP only) ═══`);
for (const [k,v] of Object.entries(HITLOG)) console.log(`  ${k.padEnd(28)} avg ${Math.round(v.reduce((a,b)=>a+b,0)/v.length)}  (n=${v.length}, min ${Math.min(...v)}, max ${Math.max(...v)})`);
console.log('\n═══ vs VIDEO ANCHORS (Mike, 2026-08-13 — mobs debuffed with Decrease DEF + Decrease ATK) ═══');
console.log('  Tayrel A2 Singing Steel (AoE): reality ~3208 normal / 4050 crit (Ezio) / 4381 crit (Mikey, shielded)');
console.log('  Crossbowman A3 Blunted Arrow:  reality 13200 normal on Mikey (Taunt + shield up)');
