// tools/handcalc/dragon.mjs — INDEPENDENT Dragon's Lair st20 hand-calc. Clean-room: imports NOTHING from
// lib/sim. Built from tools/handcalc/KITS-dragon.md (every clause wired or explicitly deferred), cloning the
// structure of cb.mjs. Team = DonaHilvi Ezio-Xeno (Michelangelo/Xenomorph/Ezio/Hilvi/Iudex), confirmed current
// gear. Dragon = KILL RACE with 2 WAVES (5 Magic mobs each) then the boss; combat is bidirectional + multi-target.
// Deterministic (EV for %-rolls). ⚙ = a genuine unknown, calibrate against Mike's video.
//
// Run:  TRACE=1 node tools/handcalc/dragon.mjs      (full walk)   ·   TRACE=boss  (boss phase only)

// ═══ ⚙ OPEN KNOBS (KITS-dragon.md §OPEN — confirm w/ Mike as we walk) ═══
const PURPLE_PCT   = +(process.env.PURPLE ?? 0.20);     // Q2 purple bar = this × boss maxHP
const SCORCH_ESC   = process.env.NOESC ? false : true;  // Q3 Scorch 0.25→0.5→0.75×maxHP, or flat 0.25×
const BOSS_ST      = process.env.BOSSST ? true : false;  // Q6 does the boss have a single-target attack? (veil relevance)
const XENO_A3_MULT = +(process.env.XA3 ?? 3);           // Q5 Rip and Claw base per-hit mult (CB assumed 3)
const WARMASTER    = +(process.env.WM ?? 47542);        // Q4 Warmaster proc value on Hellrazor st20 (Mike first-party)
const WM_PROC      = 0.45;
// champ->boss DEF mitigation: keyed at the champs' REAL L60 (same defender-level rule as enemy->champ),
// with the boss's EFFECTIVE DEF MEASURED from two independent, agreeing hits (NOT a fitted level):
//   Mikey A1 (coeff 2, non-crit weak ×0.70, base ATK): 2015 = 2063·2·0.70·defMit -> defMit 0.698
//   Ezio  A1 (coeff 4, non-crit,      ×0.70, base ATK): 3103 = 1560·4·0.70·defMit -> defMit 0.710
// Both -> retention ~0.70 WITH Dec-DEF (60%) up -> effDef ~653 -> base effective DEF ~1633 (see BOSS.def).
// The seed table's displayed DEF is 3982; the effective vs champs measures far lower — identical to the
// cb.mjs CB finding (displayed DEF back-calc 3000 vs measured ~0). Two agreeing anchors = a measurement.

// ═══ MEASURED / DOCUMENTED CONSTANTS ═══
const POISON_TICK_BOSS = 46293;   // Dragon st20, per 5%-stack (Mike first-party = 2% of boss maxHP = 5%·0.40)
const ARENA = 1.06;               // account arena bonus (HP/ATK/DEF)
const DEBUFF_CAP = 10;            // shared debuff-slot cap (poison + Dec-DEF + Weaken + Leech + Dec-ATK)

// ═══ AFFINITY WHEEL — Magic beats Spirit, Spirit beats Force, Force beats Magic ═══
const BEATS = { Magic:'Spirit', Spirit:'Force', Force:'Magic' };
const aff = (a, d) => (!a||!d||a==='Void'||d==='Void') ? 1 : (BEATS[a]===d ? 1.30 : BEATS[d]===a ? 0.70 : 1.0);

// ═══ FORMULAS ═══
// DEF mitigation — retained fraction. L = the DEFENDER's level (validated both directions: enemy→champ L60 via
// the Crossbowman-13,200 anchor; champ hits at L60 as cb.mjs does). def is the target's effective DEF.
const defMit = (def, L=60) => 1 - 0.85 * (1 - Math.exp(-2 * Math.max(0, def) / (50 * L)));
const critEV = c => 1 + (c.cr/100) * (c.cdmg/100);

// ═══ TEAM — CONFIRMED CURRENT GEAR (data/observed-builds/donahilvi-dragon-ezio-xeno.json, roster-screen: base+
// gear; validated within a few % of the reader in-battle HP trace). ARENA ×1.06 (HP/ATK/DEF) applied below;
// Mikey ACC leader aura folded into acc. ⚠ Ezio lifesteal = 0 in current gear (no complete Lifesteal set). ═══
const ROSTER = [
  { name:'Michelangelo', aff:'Spirit', hp:26231, atk:1946, def:1472, spd:180, cr:30, cdmg:50, acc:110, res:92, ls:0, wm:true },
  { name:'Xenomorph',    aff:'Magic',  hp:22876, atk:2814, def:1694, spd:167, cr:87, cdmg:78, acc:121, res:53, ls:0, wm:true },
  { name:'Ezio',         aff:'Spirit', hp:30436, atk:1472, def:1324, spd:161, cr:74, cdmg:99, acc:87,  res:30, ls:0 },
  { name:'Hilvi',        aff:'Force',  hp:42021, atk:1323, def:1625, spd:165, cr:52, cdmg:55, acc:41,  res:37, ls:0, wm:true },
  { name:'Iudex',        aff:'Spirit', hp:27946, atk:910,  def:1273, spd:145, cr:15, cdmg:61, acc:43,  res:37, ls:0 },
];
const team = ROSTER.map(c => ({ ...c,
  maxHp: Math.round(c.hp*ARENA), hp: Math.round(c.hp*ARENA), atk: Math.round(c.atk*ARENA), defv: Math.round(c.def*ARENA),
  alive:true, tm:0, cd:{}, dealt:0, taken:0, healed:0, acts:0, deaths:0,
  buffs:{},          // {strengthen,incAtk,taunt,veil,shield,blockDamage,incSpd}: {turns} (shield = numeric value)
}));
const F = n => team.find(c => c.name===n);
const aliveT = () => team.filter(c => c.alive);

// ═══ ENEMIES ═══
// Wave mobs (dungeon_stage_enemies st20, all L280 Magic). Each carries its OWN debuff state (decDef, decAtk).
const mk = (name, o) => ({ name, aff:'Magic', level:280, ...o, maxHp:o.hp, tm:0, cd:{}, alive:true,
  poison:[], decDef:0, decAtk:0, incAtk:0, incSpd:0, freeze:0, trueFear:0, infest:0, psens:0, poisonBy:null });
const WAVE1 = () => [
  mk('Tayrel#1',      { hp:168516, atk:5894, def:4381, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Hordin#2',      { hp:177770, atk:8363, def:2947, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Crossbowman#3', { hp:144429, atk:7168, def:3266, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Crossbowman#4', { hp:144429, atk:7168, def:3266, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Apothecary#5',  { hp:175910, atk:5814, def:3266, spd:101, acc:133, res:133, cr:15, cdmg:50 }),
];
const WAVE2 = () => [   // st20 wave 2: Tayrel / Crossbowman / Hordin / Hordin / Apothecary (2 Hordins)
  mk('Tayrel#1',      { hp:168516, atk:5894, def:4381, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Crossbowman#2', { hp:144429, atk:7168, def:3266, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Hordin#3',      { hp:177770, atk:8363, def:2947, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Hordin#4',      { hp:177770, atk:8363, def:2947, spd:95,  acc:133, res:133, cr:15, cdmg:50 }),
  mk('Apothecary#5',  { hp:175910, atk:5814, def:3266, spd:101, acc:133, res:133, cr:15, cdmg:50 }),
];
// Boss — Hellrazor st20 (dungeon_stage_enemies). Magic. Immune to Stun/Freeze/Sleep/Provoke/Fear/True Fear + Dec-TM/SPD.
// def: MEASURED effective DEF vs champs ≈ 1725 (~0.43× the displayed 3982), from THREE first-party Ezio hits on
// CONFIRMED gear (2026-08-14): the clean anchor is st19 A1 = 4,164 CRIT with NO buffs / NO Dec-DEF (full DEF),
// ATK ~1698 C.DMG 109% → retention 0.42 → base 1725; it predicts the st19 Dec-DEF hit (6,864) to <1% and
// matches st20's 3,103 normal (1,633). Displayed DEF is FLAT across stages (3982-4102) → one value covers 1-25.
const BOSS = () => ({ name:'Hellrazor', aff:'Magic', level:280, hp:2314665, maxHp:2314665, atk:11947, def:1725,
  spd:100, acc:200, res:200, cr:15, cdmg:50, alive:true, tm:0, cd:{}, isBoss:true,
  poison:[], decDef:0, decAtk:0, weaken:0, leech:0, psens:0, poisonBy:null,
  scorchArmed:false, scorchFires:0, purpleBar:0 });

let enemies = [];                          // the CURRENT phase's enemies (mobs, or [boss])
const aliveE = () => enemies.filter(e => e.alive);
const lowestHpE = () => aliveE().slice().sort((a,b)=>a.hp-b.hp)[0];

// enemy effective DEF: team-wide [Decrease DEF] (60%, no stack) + Xeno passive −20% while the enemy is poisoned.
const enemyDef = (e, ignoreFrac=0) => e.def * (1 - (e.decDef>0?0.60:0)) * (1 - (e.poison.length>0?0.20:0)) * (1 - ignoreFrac);
const dotWeight = e => e.poison.reduce((s,d)=>s+d.w,0) + (e.decDef>0?1:0) + (e.decAtk>0?1:0) + (e.weaken>0?1:0) + (e.leech>0?1:0) + (e.psens>0?1:0);

// ═══ TEAM → ENEMY direct hit. Affinity + DEF-mit@L60 + crit(EV) + Decrease-DEF/Xeno-20%. Adds Warmaster; Leech
// (Mikey A3 on target) + lifesteal heal off DIRECT only. Returns damage dealt. ═══
function hit(c, e, coeff, hits=1, ignoreFrac=0) {
  if (!e || !e.alive) return 0;
  // DEF mitigation keyed at the DEFENDER's level = L60 for champs (see the header note); the enemy's
  // effective DEF (measured, ~1633 base for the boss) is what enemyDef() feeds in.
  const atkMod = Math.max(0.1, 1 + (c.buffs.incAtk?0.50:0) - (c.buffs.decAttack?0.50:0));   // Inc ATK +50% and Dec ATK -50% are ADDITIVE (cancel to net base) - reconciles Mikey 2015 + Ezio 3103
  const per = c.atk * atkMod * coeff * critEV(c) * defMit(enemyDef(e,ignoreFrac), 60) * aff(c.aff, e.aff);
  let direct = per*hits;
  e.hp -= direct;
  let wm = 0;
  if (c.wm && e.isBoss){ wm = WARMASTER*WM_PROC; e.hp -= wm; }   // Warmaster/Giant Slayer %maxHP proc (⚙ confirm value)
  c.dealt += direct + wm;
  if (e.isBoss && e.purpleBar>0) e.purpleBar = Math.max(0, e.purpleBar - direct - wm);   // any damage clears the purple bar
  const healBase = direct + wm;
  const heal = c.ls*healBase + (e.leech>0 ? 0.18*healBase : 0);   // lifesteal (self) + Leech (any ally vs leeched target)
  if (heal>0){ c.hp=Math.min(c.maxHp, c.hp+heal); c.healed+=heal; }
  if (e.hp<=0) e.alive=false;
  return direct+wm;
}
const placePoison = (c, e, ev) => {   // ev = EV stacks to place; respect the shared 10-debuff cap
  const room = DEBUFF_CAP - dotWeight(e); const w = Math.min(ev, Math.max(0,room));
  if (w>0){ e.poison.push({ by:c, w, turns:2 }); e.poisonBy = e.poisonBy||c; }
};

// ═══ TEAM→ENEMY damage application onto an ALLY (boss/mob AoE). Affinity + Strengthen + Block Damage + Ezio
// nullify + Mikey shield/evade + veil (single-target only, handled by targeting). raw = pre-affinity magnitude. ═══
function dealToAlly(src, c, raw, scorch=false, label='') {
  if (!c.alive) return 0;
  const landed = raw * (scorch?1:aff(src.aff, c.aff)) * (c.buffs.strengthen?0.75:1);   // Scorch = %MaxHP, affinity-independent
  if (c.buffs.blockDamage) return landed;                                              // [Block Damage] negates all direct dmg
  let loss = landed;
  if (c.name==='Ezio' && landed > 0.5*c.maxHp) loss *= (1-0.35);                        // Full Synchronization 35% nullify (EV)
  if (c.name==='Michelangelo') loss *= (1 - (c.buffs.taunt?0.30:0.15));                 // Party Dude evade (EV)
  if (c.buffs.shield>0){ const a=Math.min(loss,c.buffs.shield); c.buffs.shield-=a; loss-=a; }
  if (c.name==='Michelangelo') c.buffs.shield = 3.0*c.atk;                              // A4 re-shield on hit (≈5,838)
  c.hp -= loss; c.taken += loss;
  if (c.hp<=0 && c.alive){ c.hp=0; c.alive=false; c.deaths++; if(TR) log(`        †DIED ${c.name} (${label} landed ${Math.round(landed)})`); }
  return landed;
}

// ═══ TARGETING ═══
// Enemy single-target picks the lowest-CURRENT-HP ally that is NOT under [Perfect Veil] (veil = untargetable by
// single-target). If everyone visible is veiled, the veil lapses (can't leave the attacker no target).
function enemyTarget(m) {
  const taunter = aliveT().find(c=>c.buffs.taunt);
  if (taunter && !taunter.buffs.veil) return taunter;                                   // Taunt draws single-target
  const visible = aliveT().filter(c=>!c.buffs.veil);
  const pool = visible.length ? visible : aliveT();
  return pool.slice().sort((a,b)=>a.hp-b.hp)[0];
}

// ═══ TEAM KITS (verbatim, KITS-dragon.md). Works vs a mob (wave) or the boss (single enemy). ═══
const TR = !!process.env.TRACE;
const logs=[]; const log = s => logs.push(s);
function tickBuffs(c){ for (const b of Object.keys(c.buffs)){ const v=c.buffs[b]; if (v && v.turns!==undefined){ v.turns--; if(v.turns<=0) c.buffs[b]=null; } } }
function reviveOne(dead){ dead.alive=true; dead.hp=Math.round(dead.maxHp*0.5); dead.tm=50; if(TR) log(`        ✚REVIVE ${dead.name} @50%`); }

function actChamp(c){
  ['A1','A2','A3'].forEach(s=>c.cd[s]=Math.max(0,(c.cd[s]||0)-1));
  tickBuffs(c);
  const boss = enemies.find(e=>e.isBoss && e.alive);
  const tgt = lowestHpE();
  const n = c.name;

  if (n==='Michelangelo'){
    if ((c.cd.A3||0)<=0){ c._skill='A3 Shell Cyclone (AoE + Dec-ATK + Leech + Taunt)'; c.cd.A3=5;
      for (const e of aliveE()){ hit(c,e,5); if(dotWeight(e)<DEBUFF_CAP){ e.decAtk=2; e.leech=2; } }
      c.buffs.taunt={turns:2}; return; }
    if ((c.cd.A2||0)<=0){ c._skill='A2 Express Delivery (Dec-DEF)'; c.cd.A2=4;
      if(tgt && dotWeight(tgt)<DEBUFF_CAP) tgt.decDef=2; hit(c,tgt,6); return; }   // Dec-DEF placed BEFORE the hit
    c._skill='A1 Boo-Yah 2x'; const d=hit(c,tgt,2,2); if(c.cr>0) c.buffs.incAtk={turns:2}; return; }

  if (n==='Xenomorph'){   // auto AI A3 > A2 > A1
    if ((c.cd.A3||0)<=0){ c._skill='A3 Rip and Claw 2x'; c.cd.A3=4; c.buffs.veil={turns:2};
      const stacks = tgt ? tgt.poison.reduce((s,d)=>s+d.w,0) : 0; hit(c,tgt,XENO_A3_MULT*(1+0.15*stacks),2); return; }
    if ((c.cd.A2||0)<=0){ c._skill='A2 Infestation (Infest+Stun tgt · True Fear others)'; c.cd.A2=4; c.buffs.veil={turns:2};
      if(tgt && !tgt.isBoss){ tgt.infest=2; for(const e of aliveE()) if(e!==tgt) e.trueFear=1; }   // Stun/Infest/TF all inert vs boss
      hit(c,tgt,5.9); return; }
    c._skill='A1 Tail Stab +poison'; c.buffs.veil={turns:2};
    if(tgt){ placePoison(c,tgt, 1 + 2*(c.cr/100)); }  // 1 base, 3 if crit → EV 1+2·crit
    hit(c,tgt,3.9); return; }

  if (n==='Ezio'){
    if ((c.cd.A2||0)<=0){ c._skill='A2 Da Vinci (AoE poison + Poison Sensitivity)'; c.cd.A2=4;
      for (const e of aliveE()){ placePoison(c,e, 2*0.75); e.psens=2; hit(c,e,4);
        // "Instantly activates all [Poison] on enemies under 4+ debuffs" → DETONATE each poison for its FULL
        // remaining duration (all remaining ticks at once), THEN the poisons are CONSUMED. Mike first-party:
        // 5 poisons detonated = 462,931 = 5 × 2t × 46,293 (2 ticks each). Bursty, not persist. (Dragon-specific.)
        if (dotWeight(e) >= 4 && e.poison.length){ const psens=e.psens>0?1.25:1;
          let burst=0; for(const d of e.poison){ const b=(e.isBoss?POISON_TICK_BOSS*d.w:0.05*e.maxHp*d.w*psens)*d.turns; burst+=b; if(d.by) d.by.dealt+=b; }   // credit each stack's PLACER
          const nStacks=e.poison.reduce((s,d)=>s+d.w,0);
          e.hp-=burst; e.poison=[];   // consumed
          if(e.isBoss){ DOT.bossPoisonDmg+=burst; if(e.purpleBar>0) e.purpleBar=Math.max(0,e.purpleBar-burst); }
          if(e.hp<=0) e.alive=false; if(TR) log(`        💥 Ezio poison-detonate ${Math.round(burst)} (${nStacks.toFixed(1)} stacks × 2t)`); }
      } return; }   // 75% two poison (EV 1.5)
    if ((c.cd.A3||0)<=0){ c._skill='A3 Hidden Gun (ignore 35% DEF)'; c.cd.A3=4; hit(c,tgt,5,1,0.35); return; }
    // Eagle Dive does NOT say "before attacking" → the hit lands vs the CURRENT DEF; the Dec-DEF it places is
    // for SUBSEQUENT hits (Mike anchor: Ezio A1 = 3,103 normal vs FULL DEF, not the dec-def'd 3,612).
    c._skill='A1 Eagle Dive (Dec-DEF)'; if(tgt && dotWeight(tgt)<DEBUFF_CAP) tgt.decDef=2; hit(c,tgt,4); return; }

  if (n==='Hilvi'){
    // A3 Ward of the Glacier — REVIVE all + Block Damage all 1t + Inc-SPD all 2t (the sustain engine).
    if ((c.cd.A3||0)<=0 && team.some(x=>!x.alive)){ c._skill='A3 Ward (REVIVE all + Block Damage all + Inc-SPD)'; c.cd.A3=6;
      team.filter(x=>!x.alive).forEach(reviveOne);
      for (const a of aliveT()){ a.buffs.blockDamage={turns:1}; a.buffs.incSpd={turns:2}; } return; }
    if ((c.cd.A2||0)<=0){ c._skill='A2 Embittering Cold (Freeze all + strip buffs)'; c.cd.A2=5;
      for (const e of aliveE()){ if(!e.isBoss){ e.freeze=1; e.hpburnBy=c; e.hpburnTurns=2; } }  // Freeze inert vs boss → no HP-Burn on boss
      return; }
    c._skill='A1 Frostflame 2x (Dec-DEF)'; if(tgt && dotWeight(tgt)<DEBUFF_CAP) tgt.decDef=2; hit(c,tgt,2.6,2); return; }

  if (n==='Iudex'){
    const dead = team.filter(x=>!x.alive).sort((a,b)=>a.maxHp-b.maxHp)[0];
    if ((c.cd.A3||0)<=0 && dead){ c._skill=`A3 Revival Mandate (revive ${dead.name})`; c.cd.A3=6;
      reviveOne(dead); dead.buffs.incAtk={turns:1}; return; }
    if ((c.cd.A2||0)<=0){ c._skill='A2 Inspiration (Inc-ATK + Strengthen + TM all)'; c.cd.A2=5;
      for (const a of aliveT()){ a.tm+=15; a.buffs.incAtk={turns:2}; a.buffs.strengthen={turns:2}; } return; }
    c._skill='A1 Censer Whirl (AoE + heal all 5%)'; const h=0.05*c.maxHp;
    for (const e of aliveE()) hit(c,e,3.4);
    for (const a of aliveT()){ a.hp=Math.min(a.maxHp,a.hp+h); } c.healed+=h*aliveT().length; return; }
}

// ═══ WAVE MOB KITS (verbatim). [True Fear] → restricted to A1. DEF-mit on allies at DEFENDER L60. ═══
const HITLOG = {};
function mobDirect(m, c, coeff, hits, statMult){
  const scaleStat = (statMult==='DEF' ? m.def*(1-(m.decDef>0?0.60:0)) : m.atk);
  const raw = scaleStat*coeff * defMit(c.defv,60) * (1+(m.incAtk>0?0.5:0)) * (m.decAtk>0?0.5:1) * (1+(m.cr/100)*(m.cdmg/100));
  let tot=0; for(let i=0;i<hits;i++){ const d=dealToAlly(m,c,raw,false,m._skill||m.name); tot+=d;
    (HITLOG[`${m.name.replace(/#\d/,'')} ${statMult}x${coeff}`] ??= []).push(Math.round(d)); }
  return tot;
}
function actMob(m){
  ['A1','A2','A3'].forEach(s=>m.cd[s]=Math.max(0,(m.cd[s]||0)-1));
  for (const k of ['decDef','decAtk','incAtk','incSpd','weaken','freeze']) if(m[k]>0) m[k]--;
  const forceA1 = m.trueFear>0; if(m.trueFear>0) m.trueFear=0;
  const t = enemyTarget(m); if(!t) return;
  const nm = m.name.replace(/#\d+/,'');
  if (nm==='Tayrel'){   // A3(cd5 single DEFx5.3 TM-)>A2(cd4 AoE DEFx3.5 Dec-DEF)>A1(single 2x DEFx1.7)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Preemptive x5.3'; m.cd.A3=5; mobDirect(m,t,5.3,1,'DEF'); return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Singing Steel AoE x3.5'; m.cd.A2=4; for(const c of aliveT()) mobDirect(m,c,3.5,1,'DEF'); return; }
    m._skill=(forceA1?'[TF] ':'')+'A1 Humble 2x x1.7'; mobDirect(m,t,1.7,2,'DEF'); return; }
  if (nm==='Hordin'){   // A3(cd6 self buff)>A2(cd4 single ATKx6.5 self-heal)>A1(single 2x ATKx1.9)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Burning Hatred (self buff)'; m.cd.A3=6; m.incAtk=2; return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Bloodletter x6.5'; m.cd.A2=4; const d=mobDirect(m,t,6.5,1,'ATK'); m.hp=Math.min(m.maxHp,m.hp+0.10*d); return; }
    m._skill=(forceA1?'[TF] ':'')+'A1 Relentless 2x x1.9'; mobDirect(m,t,1.9,2,'ATK'); return; }
  if (nm==='Crossbowman'){   // A3(cd5 single ATKx5.5)>A2(cd4 buff)>A1(single ATKx3.5)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Blunted Arrow x5.5'; m.cd.A3=5; mobDirect(m,t,5.5,1,'ATK'); return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Sharp Eye (buff)'; m.cd.A2=4; return; }
    m._skill=(forceA1?'[TF] ':'')+'A1 Snap Shot x3.5'; mobDirect(m,t,3.5,1,'ATK'); return; }
  if (nm==='Apothecary'){   // A3(cd5 +SPD +15%TM all)>A2(cd3 heal 35%)>A1(3 random ATKx1.4)
    if (!forceA1 && (m.cd.A3||0)<=0){ m._skill='A3 Boon of Speed (+SPD +15%TM all)'; m.cd.A3=5; for(const w of aliveE()){ w.incSpd=2; w.tm+=15; } return; }
    if (!forceA1 && (m.cd.A2||0)<=0){ m._skill='A2 Soothing Chant heal35%'; m.cd.A2=3; const hurt=aliveE().slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]; if(hurt) hurt.hp=Math.min(hurt.maxHp,hurt.hp+0.35*m.maxHp); return; }
    m._skill=(forceA1?'[TF] ':'')+'A1 Scatterbolt 3xrand x1.4'; for(let i=0;i<3;i++){ const rt=enemyTarget(m); if(rt) mobDirect(m,rt,1.4,1,'ATK'); } return; }
}

// ═══ BOSS KIT — Swipe / Wall of Fire (cd3) / Inhale (cd3) → purple bar → Scorch ═══
function bossAoE(boss, mult){ for (const c of aliveT()){ const raw = boss.atk*mult*defMit(c.defv,60)*(boss.decAtk>0?0.5:1); dealToAlly(boss,c,raw,false,boss._skill); } }
function scorchAoE(boss){ for (const c of aliveT()){ const raw = c.maxHp*0.25*(SCORCH_ESC?(boss.scorchFires+1):1); dealToAlly(boss,c,raw,true,'Scorch'); c.buffs.stun={turns:1}; } boss.scorchFires++; }
function actBoss(boss, bs){
  boss.cd.wof=Math.max(0,(boss.cd.wof||0)-1); boss.cd.inhale=Math.max(0,(boss.cd.inhale||0)-1);
  for (const k of ['decAtk','decDef','weaken','leech','psens']) if(boss[k]>0) boss[k]--;
  // resolve an ARMED Scorch first
  if (boss.scorchArmed){ boss.scorchArmed=false;
    if (boss.purpleBar>0){ boss._skill='SCORCH #'+(boss.scorchFires+1); bs.scorch++; scorchAoE(boss); return; }
    else { boss._skill='(purple bar cleared — Scorch interrupted, turn WASTED)'; bs.interrupted++; boss.tm=0; return; } }
  // Inhale (cd3): drain own TM, arm Scorch, raise the purple bar
  if ((boss.cd.inhale||0)<=0){ boss.cd.inhale=3; boss.scorchArmed=true; bs.inhale++;
    boss.purpleBar=PURPLE_PCT*boss.maxHp; boss.tm=0; boss._skill='INHALE — bar '+Math.round(boss.purpleBar); return; }
  // Wall of Fire (cd3): AoE 3.4× + two 5% Poison (on allies) + Weaken
  if ((boss.cd.wof||0)<=0){ boss.cd.wof=3; bs.wof++; boss._skill='Wall of Fire 3.4×'; bossAoE(boss,3.4);
    for (const c of aliveT()) c.buffs.weaken={turns:2}; return; }
  // Swipe: AoE 3× + 50% Dec-ATK on allies
  bs.swipe++; boss._skill='Swipe 3×'; bossAoE(boss,3);
  for (const c of aliveT()) c.buffs.decAttack={turns:2};
}

// ═══ DoT TICKS on the enemy's turn. Boss poison CAPPED (46,293/stack); mob poison = 5%·maxHP (uncapped). ═══
const DOT = { bossPoisonTicks:0, bossPoisonDmg:0, mobPoisonDmg:0 };
function tickEnemyPoison(e){
  if (!e.poison.length) return;
  const psens = e.psens>0 ? 1.25 : 1;
  const stacks = e.poison.reduce((s,d)=>s+d.w,0);
  const capFactor = e.isBoss ? 1 : Math.min(10,stacks)/Math.max(1,stacks);   // mob %maxHP cap at 10 stacks
  let tick = 0;
  for (const d of e.poison){ const t = e.isBoss ? POISON_TICK_BOSS*d.w : 0.05*e.maxHp*d.w*capFactor*psens; tick += t; if(d.by) d.by.dealt += t; }   // credit each stack to its PLACER
  e.hp -= tick;
  if (e.isBoss){ DOT.bossPoisonTicks++; DOT.bossPoisonDmg+=tick; if(e.purpleBar>0) e.purpleBar=Math.max(0,e.purpleBar-tick); }
  else DOT.mobPoisonDmg+=tick;
  e.poison.forEach(d=>d.turns--); e.poison = e.poison.filter(d=>d.turns>0);
  if (e.hp<=0) e.alive=false;
}
// [Infest] death-explosion (waves): an Infested mob dying → 50%·its-maxHP PURE AoE to living mobs; chains.
const INF = { explosions:0, dmg:0 };
function resolveInfestDeaths(){ const xeno=F('Xenomorph'); let again=true;
  while(again){ again=false; for (const m of enemies){ if(!m.alive && m.infest && !m._blew){ m._blew=true; again=true; INF.explosions++;
    const d=m.maxHp*0.5; for(const s of enemies) if(s.alive){ s.hp-=d; if(xeno) xeno.dealt+=d; INF.dmg+=d; if(s.hp<=0) s.alive=false; } } } } }

// ═══ SCHEDULER — one phase (mobs or boss) ═══
const effSpd = u => u.spd * (u.buffs?.incSpd || u.incSpd>0 ? 1.3 : 1);
let turn=0; const TURN_CAP=600;
function runPhase(enemyList, label, isBoss){
  enemies = enemyList; for (const c of team) c.tm=0; for (const e of enemies) e.tm=0;
  const bs = { start:turn, allyTurns:0, enemyTurns:0, swipe:0, wof:0, inhale:0, scorch:0, interrupted:0, frozen:0, tf:0 };
  if (TR){ log(`\n═══ ${label} ═══`); log('ENEMIES: '+enemies.map(e=>`${e.name} HP${Math.round(e.hp)} DEF${e.def} ATK${e.atk} SPD${e.spd}`).join(' | ')); }
  let g=0;
  while (aliveT().length>0 && aliveE().length>0 && g++<TURN_CAP*4){
    const units=[...aliveT().map(c=>({u:c,s:'a'})), ...aliveE().map(e=>({u:e,s:'e'}))];
    const need=Math.min(...units.map(x=>(100-x.u.tm)/effSpd(x.u)));
    for(const x of units) x.u.tm += effSpd(x.u)*need;
    const act=units.sort((a,b)=>(b.u.tm-a.u.tm)||(effSpd(b.u)-effSpd(a.u)))[0];
    act.u.tm-=100; turn++;
    const beHp=aliveE().reduce((s,e)=>s+Math.max(0,e.hp),0), baHp=aliveT().reduce((s,c)=>s+c.hp,0);
    if (act.s==='a'){ bs.allyTurns++; actChamp(act.u); act.u.acts++; resolveInfestDeaths();
      if (TR){ const d=Math.round(beHp-aliveE().reduce((s,e)=>s+Math.max(0,e.hp),0));
        log(`t${String(turn).padStart(3)} ${act.u.name.padEnd(12)} ${(act.u._skill||'').padEnd(42)} ${d>0?'dmg '+d:''}  | ${isBoss?'boss '+(100*Math.max(0,enemies[0].hp)/enemies[0].maxHp).toFixed(1)+'%'+(enemies[0].purpleBar>0?' bar '+Math.round(enemies[0].purpleBar):''):aliveE().map(e=>Math.round(100*e.hp/e.maxHp)+'%').join(' ')}`); }
    } else {
      bs.enemyTurns++; const e=act.u;
      tickEnemyPoison(e); resolveInfestDeaths();
      if (!e.alive){ if(TR) log(`t${String(turn).padStart(3)} ${e.name} died`); continue; }
      if (e.freeze>0){ e.freeze=0; bs.frozen++; if(TR) log(`t${String(turn).padStart(3)} ${e.name.padEnd(12)} [FROZEN — skip]`); continue; }
      if (isBoss){ actBoss(e,bs); } else { const wasTF=e.trueFear>0; actMob(e); if(wasTF) bs.tf++; }
      for (const c of team) if(c.hp<=0 && c.alive){ c.hp=0; c.alive=false; c.deaths++; }
      if (TR){ const tk=Math.round(baHp-aliveT().reduce((s,c)=>s+c.hp,0));
        log(`t${String(turn).padStart(3)} ${e.name.padEnd(12)} ${(e._skill||'').padEnd(42)} ${tk>0?'TKN '+tk:''}  | team ${team.map(c=>c.alive?Math.round(100*c.hp/c.maxHp)+'%':'DEAD').join(' ')}`); }
    }
  }
  bs.cleared = aliveE().length===0; bs.turns=turn-bs.start; return bs;
}

// ═══ RUN ═══
// Victory screen for the walked battle (143 turns; Ezio L49, Iudex/Artor L46 — under-leveled). died = to the
// Swipe at turn 119 (Ezio/Iudex/Mikey), Hilvi AoE-revived them next turn; Xeno/Hilvi never died.
const REAL = {
  Michelangelo:{ taken:77095, dealt:513634,  healed:47744,  died:true },
  Xenomorph:   { taken:41363, dealt:2661117, healed:68810,  died:false },
  Ezio:        { taken:59920, dealt:316531,  healed:11196,  died:true },
  Hilvi:       { taken:49471, dealt:434430,  healed:69237,  died:false },
  Iudex:       { taken:52048, dealt:45075,   healed:111959, died:true },
};
const w1 = runPhase(WAVE1(), 'WAVE 1', false);
const w2 = w1.cleared ? runPhase(WAVE2(), 'WAVE 2', false) : null;
const bp = (w2 && w2.cleared) ? runPhase([BOSS()], 'BOSS PHASE', true) : null;
if (TR) console.log(logs.join('\n'));

const fmt=n=>Math.round(n).toLocaleString();
console.log(`\n═══ st20 FULL-FIGHT WALK ═══  (confirmed current gear · knobs: PURPLE ${Math.round(PURPLE_PCT*100)}%, Scorch ${SCORCH_ESC?'escalating':'flat'}, XenoA3 ${XENO_A3_MULT}×, WM ${WARMASTER})`);
console.log(`  WAVE 1: ${w1.cleared?'CLEARED':'WIPED'} in ${w1.turns}t (ally ${w1.allyTurns}/mob ${w1.enemyTurns}; frozen ${w1.frozen}, TF→A1 ${w1.tf})`);
console.log(`  WAVE 2: ${w2?(w2.cleared?'CLEARED':'WIPED')+' in '+w2.turns+'t (ally '+w2.allyTurns+'/mob '+w2.enemyTurns+'; frozen '+w2.frozen+', TF→A1 '+w2.tf+')':'—'}`);
if (bp) console.log(`  BOSS:   ${bp.cleared?'KILLED':'TEAM WIPED ('+Math.round(100*Math.max(0,enemies[0].hp)/enemies[0].maxHp)+'% left)'} in ${bp.turns}t (ally ${bp.allyTurns}/boss ${bp.enemyTurns})`);
if (bp) console.log(`          Swipe ${bp.swipe} · Wall of Fire ${bp.wof} · Inhale ${bp.inhale} · SCORCH ${bp.scorch} (interrupted ${bp.interrupted})   [reality Scorches ~3-4]`);
console.log(`\n  TOTAL: ${bp?.cleared?'WIN':'LOSS'} in ${turn} turns   [reality ~121 turns, ~91% WR]`);
console.log(`  deaths: ${team.filter(c=>c.deaths>0).map(c=>c.name+'×'+c.deaths).join(', ')||'none'}   [reality: Mikey/Ezio/Iudex die once]`);
console.log(`  boss poison: ${DOT.bossPoisonTicks} ticks, ${fmt(DOT.bossPoisonDmg)} dmg (${POISON_TICK_BOSS}/stack)   ·   Infest waves: ${INF.explosions} explosions ${fmt(INF.dmg)}`);
console.log('\nchamp          taken     dealt      | REALITY taken / dealt / died');
for (const c of team){ const r=REAL[c.name]||{};
  console.log(`  ${c.name.padEnd(12)} ${String(fmt(c.taken)).padStart(8)}  ${String(fmt(c.dealt)).padStart(10)}  | ${String(r.taken).padStart(6)} / ${String(r.dealt).padStart(8)} / ${r.died?'died':'lived'}${c.deaths>0!==!!r.died?'  ⚠':''}`); }
console.log(`\n═══ ANCHORS ═══  Scorch on Ezio (Str) = 0.25×${F('Ezio').maxHp}×0.75 = ${Math.round(0.25*F('Ezio').maxHp*0.75)} [reality 5841]  ·  boss poison/stack ${POISON_TICK_BOSS} [Mike]`);
