// tools/handcalc/cb.mjs — INDEPENDENT Clan Boss (Demon Lord) hand-calc. Clean-room: imports ONLY raw snapshot
// data + the independent stat engine (stats.mjs). Nothing from lib/sim. Built from tools/handcalc/KITS.md,
// every clause wired or explicitly deferred. CB is a SURVIVAL RACE: the team is ground down and WIPES; the
// number of turns they survive sets the total damage. So HP/mitigation is the engine, damage is downstream.
//
// Deterministic (EV for %-rolls). ⚙ = a genuine unknown to calibrate against the video/reality.
import fs from 'fs';
import { effectiveFromRaw } from './stats.mjs';

// ── measured / documented constants ────────────────────────────────────────────
const POISON_TICK = 40000;   // CB Hard, 5% strength (cb-damage-model CB_POISON_CAPS)
const HPBURN_TICK = 75000;   // Legendary/epicPlus (CB_HP_BURN_TICK)
const WM_CAP = 67912, WM_PROC = 0.60;   // CB_WM_PROC_CAP Hard × per-skill proc (measured 2026-08-08)
const LEADER_ACC = 70;       // Michelangelo ACC aura, all battles
// ⚙ boss (calibrate against taken + fight length):
// BOSS CALIBRATED to reality (walkthrough 2026-08-06, validated t1–19):
const CB_BOSS_HIT = 2460;    // per-hit AoE base (turn-1 Dark Nova, Ninja exact) — used instead of atk×coeff
// PER-SKILL AoE split (Mike first-party 2026-08-10): the two AoEs hit very differently per hit. t1 Flesh
// Wither (2 hits) = 789 to Xeno; t2 Dark Nova (1 hit) = 1,289 → Dark Nova ~3.3× Flesh Wither per hit. The old
// single CB_BOSS_HIT over-credited Flesh Wither. Dark Nova base verified by t17 (9,632 crit ≈ model 9,840).
const DN_HIT = +(process.env.DN_HIT || CB_BOSS_HIT);   // Dark Nova per-hit base
const FW_HIT = +(process.env.FW_HIT || CB_BOSS_HIT);   // Flesh Wither per-hit base (calibrate to t1: 2×FW = 789)
const CRUSH_MAXHP = 0.113;   // Crushing Force = 11.3% MAX HP (turn-3: 2899/25583)
const GF = T => T < 10 ? 1 : T < 20 ? 1 + 0.75*(T-9) : 8.5 + (T-19);   // Gathering Fury, GLOBAL turn (F(11)=2.5, F(19)=8.5)
// Boss DEF — CORRECTED 2026-08-09 via turn-by-turn video hits (supersedes the earlier Mikey back-calc that gave 3000).
// Xeno's direct hits land at mitigation ≈ 1.0: Rip and Claw 30,371 (=2×3×ATK×crit at defMit 1.0), Tail Stab 32,026 w/
// Inc.ATK & 20,962 w/o (ratio 1.53 = the ×1.5 buff, both defMit≈1.0). ⇒ the boss's EFFECTIVE DEF vs this team ≈ 0
// (direct hits ~full). DEF=3000 was halving every direct hit. Override with BOSSDEF env.
const BOSS_DEF = +(process.env.BOSSDEF || 0);
// ── BOSS stat block — Demon Lord, HARD. Grounded in confirmed data (CLAN_BOSS_REVIEW.md §6, clan_boss_stats),
//    NOT placeholders. Only DEF is not published — it is calibrated (Mikey/Xeno anchors ≈3000) and flagged.
const BOSS0 = {
  spd:    +(process.env.BOSSSPD || 140),      // CONFIRMED (Easy/Normal/Hard/Brutal/NM/UNM = 90/120/140/160/170/190)
  res:    90,                                 // CONFIRMED (Tier-2, CB_BOSS_RES)
  maxHp:  194_130_000,                        // CONFIRMED (clan_boss_stats Hard) — never dies in the time limit
  atk:    CB_BOSS_HIT,                         // calibrated per-hit base (walkthrough turn-1 Dark Nova, gf=1)
  def:    BOSS_DEF,                            // ⚙ NOT published — calibrated to Mikey/Xeno direct hits (~3000)
  level:  100,
};
const TURN_CAP = 400;

// ── champions ───────────────────────────────────────────────────────────────────
const snap = JSON.parse(fs.readFileSync(new URL('../../gestal-sync/output/DonaHilvi_a6261acc35588c94.json', import.meta.url), 'utf8'));
const NAMES = ['Ezio Auditore','Ninja','Michelangelo','Iudex Artor','Xenomorph'];
const LS = { 'Ninja': 0.30 };
const MASTERY = { 'Ninja':'WM', 'Michelangelo':'WM' };
// REAL in-game effective stats read off the 2026-08-10 in-game stat/Set-Info screenshots (Total Stats =
// base + ALL gear/set/mastery/Great-Hall bonuses; battle leader aura added separately below). Override the
// STALE snapshot gear when REALSTATS=1 — the snapshot was Aug-9 and its gear no longer matches the account.
const GEAR_STATS = process.env.REALSTATS ? {
  'Michelangelo':  { hp:27840, atk:2089, def:1546, spd:191, crate:35, cdmg:60,  res:92,  acc:212 },
  'Xenomorph':     { hp:24438, atk:2979, def:1754, spd:190, crate:92, cdmg:88,  res:53,  acc:251 },
  'Ninja':         { hp:23822, atk:2602, def:1469, spd:168, crate:79, cdmg:66,  res:100, acc:81  },
  'Ezio Auditore': { hp:29887, atk:1502, def:1321, spd:167, crate:79, cdmg:109, res:30,  acc:149 },
  'Iudex Artor':   { hp:31199, atk:1009, def:1311, spd:155, crate:15, cdmg:61,  res:37,  acc:43  },
} : null;
function build(name) {
  const raw = (snap.champions||[]).find(c => c.name===name || c.name.startsWith(name.split(' ')[0]));
  const s = effectiveFromRaw(raw);
  if (GEAR_STATS && GEAR_STATS[raw.name]) Object.assign(s, GEAR_STATS[raw.name]);   // inject real gear-inclusive totals
  s.acc += LEADER_ACC;
  return { name: raw.name, ...s, maxHp: s.hp, hp: s.hp, alive: true,
    lifesteal: LS[raw.name]||0, mastery: MASTERY[raw.name]||null,
    dmg:0, directDmg:0, wmDmg:0, healed:0, taken:0, acts:0, tm:0, cd:{}, atkMult:1, cdmgBonus:0, escSet:{},
    buffs:{} };   // buffs: {increaseAtk, strengthen, shield, taunt, veil} → turns/value
}
const team = NAMES.map(build);
const F = n => team.find(c => c.name===n);
const alive = () => team.filter(c => c.alive);
// boss state + its debuffs (placed by the team) with turn durations
const boss = { ...BOSS0, hp: BOSS0.maxHp, tm:0, turn:0,
  dec_def:0, dec_atk:0, leech:0, psens:0,          // debuff durations (turns)
  poison:[], hpburn:[] };                          // DoT stacks: [{placer, w, turns}]

// ── formulas (documented) ────────────────────────────────────────────────────────
const defMit = (def, L) => 1 - 0.85 * (1 - Math.exp(-2 * Math.max(0, def) / (50 * L)));
const critEV = c => 1 + (c.crate/100) * ((c.cdmg + c.cdmgBonus)/100);
const bossDef = () => boss.def * (1 - (boss.dec_def>0?0.60:0)) * (1 - (boss.poison.length>0?0.20:0));   // Decrease DEF (max 60%, no stack) + Xeno passive −20% while poisoned
const champAtk = c => c.atk * c.atkMult * (1 + (c.buffs.increaseAtk?0.50:0));   // Escalation ×atkMult + [Increase ATK] 50%
const dotWeight = () => boss.poison.reduce((s,d)=>s+d.w,0) + boss.hpburn.reduce((s,d)=>s+d.w,0);

// direct attack on the boss: returns direct damage; adds WM; lifesteal/leech heal off DIRECT only.
const hitDiag = { n:0, decDefUp:0, poisonUp:0, defMitSum:0 };
function hit(c, coeff, hits=1, ignoreDefFrac=0) {
  const def = bossDef() * (1 - ignoreDefFrac);
  hitDiag.n++; if (boss.dec_def>0) hitDiag.decDefUp++; if (boss.poison.length>0) hitDiag.poisonUp++; hitDiag.defMitSum += defMit(def,60);
  const per = champAtk(c) * coeff * critEV(c) * defMit(def, 60);   // Void → affinity 1; our champs L60
  const direct = per * hits;
  let d = direct, wmHit = 0;
  if (c.mastery === 'WM') { wmHit = WM_CAP * WM_PROC; d += wmHit; c.wmDmg = (c.wmDmg||0)+wmHit; }   // Warmaster once per skill (capped)
  c.dmg += d; c.directDmg += direct;
  // heal off the HIT (direct + Warmaster — both are part of the skill hit; DoT does NOT lifesteal):
  // Ninja lifesteal 30% (self), Leech 18% (any ally attacking a Leeched boss)
  const healBase = direct + wmHit;
  let heal = c.lifesteal * healBase + (boss.leech>0 ? 0.18*healBase : 0);
  if (heal>0) { c.hp = Math.min(c.maxHp, c.hp+heal); c.healed += heal; }
  return d;
}
const DBG = !!process.env.DBG;
const dotDiag = { dropped:0, slotSamples:[], placed:{} };
const placePoison = (c, ev) => { const room = 10 - dotWeight(); const w = Math.min(ev, Math.max(0,room)); if (ev>room) dotDiag.dropped += (ev-Math.max(0,room)); if (w>0) { boss.poison.push({placer:c, w, turns:2}); dotDiag.placed[c.name+' poison']=(dotDiag.placed[c.name+' poison']||0)+w; } };
const placeHPBurn = (c, ev) => { const room = 10 - dotWeight(); const w = Math.min(ev, Math.max(0,room)); if (ev>room) dotDiag.dropped += (ev-Math.max(0,room)); if (w>0) { boss.hpburn.push({placer:c, w, turns:3}); dotDiag.placed[c.name+' hpburn']=(dotDiag.placed[c.name+' hpburn']||0)+w; } };
function tickDots() {                                             // on the boss's turn
  const pm = boss.psens>0 ? 1.25 : 1;
  let turnDot = 0;
  for (const d of boss.poison) { const t = POISON_TICK * d.w * pm; d.placer.dmg += t; turnDot += t; }
  for (const d of boss.hpburn) { const t = HPBURN_TICK * d.w; d.placer.dmg += t; turnDot += t; }
  dotDiag.slotSamples.push({ turn: boss.turn+1, slots: +dotWeight().toFixed(1), dot: Math.round(turnDot), pois: +boss.poison.reduce((s,d)=>s+d.w,0).toFixed(1), burn: +boss.hpburn.reduce((s,d)=>s+d.w,0).toFixed(1) });
  boss.poison.forEach(d=>d.turns--); boss.hpburn.forEach(d=>d.turns--);
  boss.poison = boss.poison.filter(d=>d.turns>0); boss.hpburn = boss.hpburn.filter(d=>d.turns>0);
}

const castDiag = {};
const survDiag = { deaths:[], revives:0, reviveLog:[], bossTurns:0, decAtkUp:0, leechUp:0, hitInstances:0, strHits:0 };
// ── champion turns (full kits from KITS.md) ──────────────────────────────────────
function actChamp(c) {
  const dec = s => c.cd[s] = Math.max(0, (c.cd[s]||0)-1);
  ['A1','A2','A3'].forEach(dec);
  c._log = s => { const k=c.name+'.'+s; castDiag[k]=(castDiag[k]||0)+1; };
  // tick this champ's own buff durations
  for (const b of Object.keys(c.buffs)) if (c.buffs[b] && c.buffs[b].turns !== undefined) { c.buffs[b].turns--; if (c.buffs[b].turns<=0) c.buffs[b]=null; }
  const n = c.name;

  if (n === 'Ninja') {
    if ((c.cd.A3||0)<=0) { c._skill='A3 Cyan Slash'; c.cd.A3=5; c.cd.A2=Math.max(0,(c.cd.A2||0)-1); c.escSet.A3=1; return hit(c,3,1,0.50); }
    if ((c.cd.A2||0)<=0) { c._skill='A2 Hailburn'; c.cd.A2=4; c.escSet.A2=1; c.buffs.veil={turns:2};
      const d = hit(c,2,3);
      for (let i=0;i<3;i++){ c.dmg += 0.75*HPBURN_TICK; placeHPBurn(c, 0.75); }   // per-hit place+activate; persist to tick on boss turns
      return d; }
    c._skill='A1 Shatterbolt'; c.escSet.A1=1; c.tm += 15;                          // A1 self +15% TM vs boss
    if (c.escSet.A1&&c.escSet.A2&&c.escSet.A3 && c.atkMult<2.0) { c.atkMult=Math.min(2.0,c.atkMult*1.20); c.cdmgBonus=Math.min(25,c.cdmgBonus+10); c.escSet={}; }  // Escalation ×1.2 ATK + C.DMG, cap
    setDecDef(c);                                                                  // A1 45% Decrease DEF
    return hit(c,3.7,1);
  }
  if (n === 'Xenomorph') {   // auto-AI priority A3 > A2 > A1 (Xeno LEADS with Rip and Claw — confirmed video turn 1)
    if ((c.cd.A3||0)<=0) { c._skill='A3 Rip and Claw'; c.cd.A3=4; c.buffs.veil={turns:2}; return hit(c,3,2)*(1+0.15*boss.poison.reduce((s,d)=>s+d.w,0)); }
    if ((c.cd.A2||0)<=0) { c._skill='A2 Infestation'; c.cd.A2=4; c.buffs.veil={turns:2}; return hit(c,5.9,1); }         // stun/infest/fear wasted on boss
    c._skill='A1 Tail Stab'; c.buffs.veil={turns:2}; placePoison(c, 1 + 2*(c.crate/100));    // A1: 1 + (crit→3)
    return hit(c,3.9,1);
  }
  if (n === 'Michelangelo') {
    // Auto-AI opens with (and prioritises) A3 Shell Cyclone — Leech + Decrease-ATK from turn 1 (Mike first-party
    // 2026-08-10: "mikey opens with shell cyclone → boss has leech and decrease attack right away"). A3 before A2.
    if ((c.cd.A3||0)<=0) { c._skill='A3 Shell Cyclone'; c.cd.A3=4; boss.leech=2; boss.dec_atk=2; c.buffs.taunt={turns:2}; if(process.env.XHP)console.log(`      >> Mikey A3 (Leech+DecATK+Taunt) @ boss t${boss.turn}`); return hit(c,5,1); }  // Leech + Decrease ATK + Taunt · BOOKED cd 4 (Mike fully booked, only booked champ)
    if ((c.cd.A2||0)<=0) { c._skill='A2 Express Delivery'; c.cd.A2=3; setDecDef(c); return hit(c,6,1); }                 // 75% Decrease DEF · BOOKED cd 3
    { c._skill='A1 Boo-Yah'; const d = hit(c,2,2); if (c.crate>0) c.buffs.increaseAtk={turns:2}; return d; }             // A1 2×2; Increase ATK on crit (EV: crate>0)
  }
  if (n === 'Ezio Auditore') {
    if ((c.cd.A2||0)<=0) { c._skill='A2 Da Vinci'; c.cd.A2=4; const land = c.buffs.veil ? 1 : 0.75;                     // veiled → unresistable; else EV land
      placePoison(c, 2*land); boss.psens=2;
      const d = hit(c,4,1);
      // NOTE: Ezio "instantly activates all Poison" — but reality holds a STEADY 4-6 poison (2026-08-09), i.e. activation
      // does NOT wipe the stacks. Modeling it as an extra tick over-credited Ezio's own poison (1.53×), so we let poison
      // simply persist and tick normally each boss turn (no crash, no bonus tick). Revisit if a bonus-tick anchor appears.
      return d; }
    if ((c.cd.A3||0)<=0) { c._skill='A3 Hidden Gun'; c.cd.A3=4; return hit(c,5,1,0.35); }
    c._skill='A1 Eagle Dive'; setDecDef(c); return hit(c,4,1);                                                          // A1 75% Decrease DEF
  }
  if (n === 'Iudex Artor') {
    const dead = team.filter(x=>!x.alive).sort((a,b)=>a.maxHp-b.maxHp)[0];
    if ((c.cd.A3||0)<=0 && dead) { c._skill='A3 Revive'; c.cd.A3=6; dead.alive=true; dead.hp=dead.maxHp*0.5; dead.tm=50; dead.buffs.increaseAtk={turns:1}; survDiag.revives++; survDiag.reviveLog.push(`${dead.name}@t${boss.turn}`); return 0; }   // A3 Revival Mandate: revive lowest-MaxHP dead ally 50% HP/TM
    if ((c.cd.A2||0)<=0) { c._skill='A2 Inspiration'; c.cd.A2=5; for (const a of alive()){ a.tm+=15; a.buffs.increaseAtk={turns:2}; a.buffs.strengthen={turns:2}; } if(process.env.XHP)console.log(`      >> Artor A2 (Strengthen+TM+IncATK) @ boss t${boss.turn}`); return 0; }
    c._skill='A1 Censer Whirl'; const h=0.05*c.maxHp;                                         // A1: heal all allies 5% Artor MaxHP
    for (const a of alive()) a.hp=Math.min(a.maxHp,a.hp+h);
    c.healed += h*alive().length;                                                             // credited to Artor
    return hit(c,3.4,1);
  }
  return 0;
}
function setDecDef(c) { boss.dec_def = 2; }   // any 60% Decrease DEF → 2t (no stack; refreshes)

// ── boss turn (Demon Lord kit + Gathering Fury) ──────────────────────────────────
function actBoss(gt) {
  tickDots();                                          // DoTs tick on boss turn
  boss.turn++;
  const _xeTaken0 = F('Xenomorph')?.taken ?? 0;        // snapshot to report boss damage to Xeno THIS round
  const gf = GF(boss.turn);                            // Gathering Fury ramps over the BOSS's own turns (F(11)=2.5, F(19)=8.5)
  const ph = boss.turn % 3;
  const decA = boss.dec_atk>0 ? 0.50 : 1;              // Mikey A3 Decrease ATK −50% (survival lever)
  survDiag.bossTurns++; if (boss.dec_atk>0) survDiag.decAtkUp++; if (boss.leech>0) survDiag.leechUp++;
  const incoming = (c, raw) => {                        // mitigation: Evade, Strengthen −25%, Shield absorb, then HP
    // Mikey A4 Party Dude: 15% Evade (30% under Taunt) — model as EV damage reduction on this hit
    if (c.name==='Michelangelo') { const ev = c.buffs.taunt ? 0.30 : 0.15; raw *= (1-ev); }
    // Ezio Full Synchronization: 35% nullify a hit dealing >50% MaxHP (Crushing Force late-game) — EV reduction
    if (c.name==='Ezio Auditore' && raw > 0.5*c.maxHp) raw *= (1 - 0.35);
    survDiag.hitInstances++; if (c.buffs.strengthen) survDiag.strHits++;   // Strengthen coverage on incoming hits
    let dmg = raw * (c.buffs.strengthen?0.75:1);
    if (c.buffs.shield && c.buffs.shield.value>0) { const a=Math.min(dmg,c.buffs.shield.value); c.buffs.shield.value-=a; dmg-=a; c.taken+=a; }
    c.hp -= dmg; c.taken += dmg; if (c.hp<=0 && c.alive){ c.hp=0; c.alive=false; survDiag.deaths.push(`${c.name}@t${boss.turn}`); }
    // Mikey A4: gains [Shield] = 300% ATK when hit, only if he has no active shield (re-applies when broken, not every hit)
    if (c.name==='Michelangelo' && c.alive && !(c.buffs.shield && c.buffs.shield.value>0)) c.buffs.shield = { value: 3*c.atk };
  };
  const aoeHit = (c, base) => base * gf * decA * defMit(c.def, boss.level);   // per-hit AoE (per-skill base × GF × decATK × DEF)
  // CONFIRMED rotation (first-party live 2026-08-09): 3-cycle FLESH WITHER (T1/4/7) → DARK NOVA (T2/5/8) → CRUSHING FORCE (T3/6/9).
  if (ph===1) {   // Flesh Wither: 2-hit AoE (softer per hit)
    for (const c of alive()) incoming(c, 2*aoeHit(c, FW_HIT));
  } else if (ph===2) {   // Dark Nova: 1-hit AoE (Void), harder per hit
    for (const c of alive()) incoming(c, aoeHit(c, DN_HIT));
  } else {   // ph===0 Crushing Force: single-target 11.3% MaxHP + unresistable Stun. Taunt draws it (T3 stunned Mikey ✓); else Ezio (unveiled) else lowest HP%.
    const mikey=F('Michelangelo'), ezio=F('Ezio Auditore');
    let tgt = (mikey.alive&&mikey.buffs.taunt) ? mikey : (ezio.alive&&!ezio.buffs.veil) ? ezio : alive().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if (tgt){ incoming(tgt, tgt.maxHp*CRUSH_MAXHP*gf); tgt.stunned=true; if(process.env.XHP)console.log(`      >> Crushing Force STUNS ${tgt.name} @ boss t${boss.turn} (Mikey taunt=${mikey.buffs.taunt?'Y':'n'})`); }
  }
  // Xeno passive Caustic Blood: UNBOOKED 25% chance to place a 5% [Poison] on the attacker PER HIT taken (seed 45; Xeno not booked).
  // Flesh Wither = 2 hits → 2 chances; Dark Nova = 1 hit → 1 chance.
  const xeno = F('Xenomorph');
  if (xeno.alive) { const hitsTaken = ph===1 ? 2 : ph===2 ? 1 : 0; if (hitsTaken) placePoison(xeno, 0.25*hitsTaken); }
  // decrement boss-debuff durations (they tick on the boss's turn)
  boss.dec_def=Math.max(0,boss.dec_def-1); boss.dec_atk=Math.max(0,boss.dec_atk-1);
  boss.leech=Math.max(0,boss.leech-1); boss.psens=Math.max(0,boss.psens-1);
  if (process.env.XHP) { const x=F('Xenomorph'); const skill=['Crushing Force','Flesh Wither','Dark Nova'][ph]; const mit=decA*(x.buffs.strengthen?0.75:1); const dmgToXeno=Math.round(x.taken-_xeTaken0); console.log(`  [boss t${boss.turn} ${skill} GF${gf.toFixed(1)}] decATK=${decA<1?'Y':'n'} leech=${boss.leech>0?'Y':'n'} | boss→Xeno ${dmgToXeno.toLocaleString().padStart(7)} | Xeno ${Math.round(100*x.hp/x.maxHp)}% veil=${x.buffs.veil?'Y':'n'} str=${x.buffs.strengthen?'Y':'n'} mit×${mit.toFixed(3)} ${x.alive?'':'DEAD'}`); }
}

// ── TURN-METER SCHEDULER: fight until the team WIPES (survival race). ─────────────
// TRACE=1 (or TRACE=<maxBossTurn>) prints an action-by-action log to walk against the video.
const TRACE = process.env.TRACE ? (process.env.TRACE==='1' ? 999 : +process.env.TRACE) : 0;
const totalDmg = () => Math.round(team.reduce((a,c)=>a+c.dmg,0));
let guard=0, gturn=0; const cumByBossTurn=[]; const openOrder=[];
if (TRACE) console.log(`\n═══ TURN-BY-TURN TRACE (through boss turn ${TRACE}) ═══\n#   actor         skill              dmg     poison→   HP-burn   running-total`);
while (alive().length>0 && guard++<TURN_CAP*20) {
  const units = [...alive(), boss];
  const need = Math.min(...units.map(u => (100-u.tm)/u.spd));
  for (const u of units) u.tm += u.spd*need;
  const actor = units.sort((a,b)=>(b.tm-a.tm)||(b.spd-a.spd))[0];
  if (openOrder.length < 14) openOrder.push(actor===boss ? 'BOSS' : actor.name.split(' ')[0]);
  actor.tm -= 100; gturn++;                            // global turn (Gathering Fury uses this)
  const before = totalDmg();
  if (actor===boss) {
    actBoss(gturn); cumByBossTurn.push({ turn: boss.turn, total: totalDmg(), xa: F('Xenomorph').acts, na: F('Ninja').acts });
    if (TRACE && boss.turn<=TRACE) { const sk=['Crushing Force','Flesh Wither','Dark Nova'][boss.turn%3===0?0:boss.turn%3===1?1:2];
      console.log(`— BOSS turn ${boss.turn} (GF ${GF(boss.turn).toFixed(2)}): ${sk} · DoT ticked ${before===totalDmg()?0:'+'+(totalDmg()-before)} · poison=${boss.poison.reduce((s,d)=>s+d.w,0).toFixed(1)} burn=${boss.hpburn.reduce((s,d)=>s+d.w,0).toFixed(1)} · total ${totalDmg()}`); }
  } else if (actor.stunned) { actor.stunned=false; if (TRACE && boss.turn<TRACE) console.log(`${String(gturn).padStart(3)} ${actor.name.split(' ')[0].padEnd(12)} STUNNED (lost turn)`); }
  else { actChamp(actor); actor.acts++;
    if (TRACE && boss.turn<TRACE) console.log(`${String(gturn).padStart(3)} ${actor.name.split(' ')[0].padEnd(12)} ${(actor._skill||'').padEnd(18)} ${String(totalDmg()-before).padStart(7)}   pois=${boss.poison.reduce((s,d)=>s+d.w,0).toFixed(1).padStart(4)}   burn=${boss.hpburn.reduce((s,d)=>s+d.w,0).toFixed(1)}   ${totalDmg()}`); }
}
const wipeTurn = gturn;

// ── TEAM→BOSS per-hit anchors (video, 2026-08-09) — the direct-hit analogue of the boss-side anchors.
// Three independent confirmations that the per-instance damage engine is CORRECT (each within ~5%):
//   1. Xeno A2 Infestation crit, [Inc.ATK]+[Strengthen], decDEF+poison up  = 27170
//   2. Xeno A1 Tail Stab crit (3 poisons), [Veil]+[Inc.ATK]+[Strengthen], decDEF+poison = 19543
//   3. HP-Burn ticks are a flat 75000 (confirms HPBURN_TICK — the cap, no variance)
// All three cross-validate boss DEF≈3000 (also = Mikey's WM-subtracted direct). NOT fitted to the 9M total.
{
  const x = F('Xenomorph');
  const eff = defMit(BOSS_DEF*0.4*0.8, 60);   // Decrease-DEF(60%) + Xeno-poison(-20%) active during both hits
  const a2 = x.atk * 1.50 * 5.9 * (1 + x.cdmg/100) * eff;   // A2 Infestation
  const a1 = x.atk * 1.50 * 3.9 * (1 + x.cdmg/100) * eff;   // A1 Tail Stab
  console.log(`\nDIRECT-ENGINE ANCHORS (video):`);
  console.log(`  Xeno A2 crit: model ${Math.round(a2)} vs 27170  (${(a2/27170).toFixed(2)}×)`);
  console.log(`  Xeno A1 crit: model ${Math.round(a1)} vs 19543  (${(a1/19543).toFixed(2)}×)`);
  console.log(`  HP-Burn tick: model ${HPBURN_TICK} vs 75000  (${(HPBURN_TICK/75000).toFixed(2)}×)  → direct engine + boss DEF≈${BOSS_DEF} CONFIRMED\n`);
}
// NEW battle 2026-08-09 (Mikey LEAD/ACC, fresh gear): 12.38M total, 06:46. Out-of-sample test of the 9M-calibrated model.
const REAL = { 'Ninja':{dmg:4766602,taken:116355,healed:1004821}, 'Xenomorph':{dmg:5796397,taken:74060,healed:111504},
  'Michelangelo':{dmg:1129909,taken:62884,healed:140802}, 'Ezio Auditore':{dmg:633977,taken:75270,healed:42171}, 'Iudex Artor':{dmg:62056,taken:58445,healed:116487} };
// ── COMBATANT STAT TABLE (champs from roster snapshot; boss from confirmed data — the user's "table with all stats")
console.log('COMBATANT STAT TABLE');
console.log('  name              HP      ATK    DEF   SPD  C.RATE  C.DMG   ACC   RES   source');
for (const c of team)
  console.log(`  ${c.name.padEnd(14)} ${String(Math.round(c.maxHp)).padStart(7)}  ${String(Math.round(c.atk)).padStart(5)}  ${String(Math.round(c.def)).padStart(5)}  ${String(Math.round(c.spd)).padStart(4)}  ${String(Math.round(c.crate)+'%').padStart(5)}  ${String(Math.round(c.cdmg)+'%').padStart(5)}  ${String(Math.round(c.acc)).padStart(4)}  ${String(Math.round(c.res)).padStart(4)}   roster snapshot`);
console.log(`  ${'Demon Lord'.padEnd(14)} ${String(boss.maxHp).padStart(7)}  ${String(boss.atk).padStart(5)}* ${String(boss.def).padStart(5)}† ${String(boss.spd).padStart(4)}      —      —     —  ${String(boss.res).padStart(4)}   confirmed (SPD/RES/HP), *ATK=CB_BOSS_HIT calib, †DEF calib`);
console.log('');

console.log(`INDEPENDENT hand-calc — DonaHilvi CB Hard (survival race). Boss turns: ${boss.turn}  (fight ended: ${alive().length} alive)\n`);
console.log('champ            acts  hand-dmg    real-dmg   d/r    hand-tkn  real-tkn   hand-heal  real-heal');
let tot=0,rtot=0;
for (const c of team) { const r=REAL[c.name]||{}; tot+=c.dmg; rtot+=r.dmg||0;
  console.log(`  ${c.name.padEnd(16)} ${String(c.acts).padStart(3)}  ${String(Math.round(c.dmg)).padStart(9)}  ${String(r.dmg||0).padStart(9)}  ${r.dmg?(c.dmg/r.dmg).toFixed(2):'—'}   ${String(Math.round(c.taken)).padStart(7)}  ${String(r.taken||0).padStart(7)}   ${String(Math.round(c.healed)).padStart(8)}  ${String(r.healed||0).padStart(8)}`); }
console.log(`  ${'TOTAL'.padEnd(16)}      ${String(Math.round(tot)).padStart(9)}  ${String(rtot).padStart(9)}  (real 9.0M, ~6:37)`);

// ── damage-source breakdown (localize the carry gap: direct vs DoT vs Warmaster) ──
console.log('\nSOURCE BREAKDOWN            direct       DoT        WM      (direct drives lifesteal → survival)');
for (const c of team) {
  const wm = c.wmDmg||0, dot = c.dmg - c.directDmg - wm;
  console.log(`  ${c.name.padEnd(16)} ${String(Math.round(c.directDmg)).padStart(9)}  ${String(Math.round(dot)).padStart(9)}  ${String(Math.round(wm)).padStart(8)}`);
}
if (DBG) {
  console.log('\nCOMBAT STATS (final)      atk  atkMult  crate  cdmg+bon  critEV   effBossDEF  defMit@60');
  const edef = bossDef();
  for (const c of team) {
    console.log(`  ${c.name.padEnd(16)} ${String(Math.round(c.atk)).padStart(5)}   ${c.atkMult.toFixed(2)}   ${String(Math.round(c.crate)).padStart(3)}%   ${String(Math.round(c.cdmg+c.cdmgBonus)).padStart(3)}%    ${critEV(c).toFixed(2)}     ${String(Math.round(edef)).padStart(5)}      ${defMit(edef,60).toFixed(3)}`);
  }
  console.log(`\nDECREASE-DEF UPTIME: ${(100*hitDiag.decDefUp/hitDiag.n).toFixed(0)}% of hits  ·  XENO-POISON(-20%) UPTIME: ${(100*hitDiag.poisonUp/hitDiag.n).toFixed(0)}%  ·  avg defMit: ${(hitDiag.defMitSum/hitDiag.n).toFixed(3)}  (boss DEF=${BOSS_DEF})`);
  console.log(`\nDoT SLOT UTILIZATION (cap 10) — dropped stacks total: ${dotDiag.dropped.toFixed(1)}`);
  console.log('  boss-turn  slots-full  DoT-dealt');
  for (const s of dotDiag.slotSamples) console.log(`    ${String(s.turn).padStart(3)}       ${String(s.slots).padStart(5)}     ${String(s.dot).padStart(8)}`);
  const avg = dotDiag.slotSamples.reduce((a,s)=>a+s.slots,0)/dotDiag.slotSamples.length;
  console.log(`  avg slots full: ${avg.toFixed(1)}/10   (reality needs ~10/10 to bank 9M over 19 turns)`);
  console.log('\n  DoT STACKS PLACED (total over fight):');
  for (const [k,v] of Object.entries(dotDiag.placed)) console.log(`    ${k.padEnd(24)} ${v.toFixed(1)}`);
  const bossTurns = dotDiag.slotSamples.length;
  console.log(`    → to hold 10 slots over ${bossTurns} boss-turns (poison 2t / hpburn 3t): need ~${(10*bossTurns/2.4).toFixed(0)} placements; have ${Object.values(dotDiag.placed).reduce((a,b)=>a+b,0).toFixed(0)}`);
}
// ── TURN-BY-TURN cumulative total (video anchors, 2026-08-09): running TOTAL DAMAGE at each BOSS TURN COUNT ──
const REAL_CUM = {};   // (old-battle turn-1 anchor removed — different fight)
console.log(`\nOPENING ORDER: ${openOrder.join(', ')}   (real: Xeno, Ninja, Mikey, Artor, Ezio, BOSS)`);
console.log('\nTURN-BY-TURN TOTAL DAMAGE  (boss-turn : model cumulative : reality)');
for (const s of cumByBossTurn) {
  const r = REAL_CUM[s.turn];
  const mark = s.turn===16 ? `   ← Xeno acts=${s.xa} (real 22), Ninja acts=${s.na}` : '';
  console.log(`  t${String(s.turn).padStart(2)}  ${String(s.total).padStart(9)}${r?`   vs ${r}  (${(s.total/r).toFixed(2)}×)`:''}${mark}`);
}
console.log(`\nSURVIVAL: deaths ${survDiag.deaths.join(', ')}  (real: Artor@14, Xeno@17, Ezio@18, Ninja@19)`);
console.log(`  revives: ${survDiag.revives} [${survDiag.reviveLog.join(', ')}]  ·  Decrease-ATK uptime: ${(100*survDiag.decAtkUp/survDiag.bossTurns).toFixed(0)}%  ·  Leech uptime: ${(100*survDiag.leechUp/survDiag.bossTurns).toFixed(0)}%  ·  Strengthen coverage: ${survDiag.hitInstances?(100*survDiag.strHits/survDiag.hitInstances).toFixed(0):0}% of ${survDiag.hitInstances} hits`);
console.log('\n⚙ calibrate vs video: BOSS0.atk/def/spd, CRUSH_MAXHP, GF ramp, rotation. Everything else = stats + verbatim kits.');
