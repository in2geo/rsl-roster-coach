// tools/handcalc/stats.mjs — INDEPENDENT effective-stat engine (hand-calc template, module 1 of N).
// Computes a champion's effective stats from RAW snapshot data ONLY (baseStats + equipped artifacts +
// bonusesV2). Imports NOTHING from lib/ — this is a clean-room reimplementation whose whole value is that it
// shares no code with the Model under test. Diff its output against the Model's estimated_stats to catch a
// wrong stat pipeline, a phantom account bonus, or gear drift (feed it the real gear and the numbers must match
// reality). Dungeon-agnostic: stats don't change per dungeon, so this module is reused everywhere.
//
// Stat-id map (game data, from the in-game artifact popups; NOT engine logic):
//   1 HP  2 DEF  3 ATK  4 HP%  5 DEF%  6 ATK%  7 SPD  8 C.RATE  9 C.DMG  10 ACC  11 RES
const KIND = { 1:'HP',2:'DEF',3:'ATK',4:'HP%',5:'DEF%',6:'ATK%',7:'SPD',8:'CRATE',9:'CDMG',10:'ACC',11:'RES' };
const FLATKEY = { HP:'hp',ATK:'atk',DEF:'def',SPD:'spd',CRATE:'crate',CDMG:'cdmg',ACC:'acc',RES:'res' };

export function effectiveFromRaw(c) {
  const b = c.baseStats || {};
  const eff = { hp:b.hp||0, atk:b.atk||0, def:b.def||0, spd:b.spd||0, crate:b.crate||0, cdmg:b.cdmg||0, res:b.res||0, acc:b.acc||0 };
  // add a named stat. `frac` true => value is a FRACTION of base (e.g. 0.12 = +12% of base); false => the raw
  // artifact convention (percent stats named "HP%" carry a whole-number percent; flats carry the flat amount).
  const add = (name, val, frac=false) => {
    if (!name) return;
    const pct = name.endsWith('%');
    const key = FLATKEY[name.replace('%','')];
    if (!key) return;
    if (frac) eff[key] += b[key] * val;                       // bonusesV2 %-bonus: fraction of base
    else if (pct) eff[key] += (b[key] || 0) * val / 100;      // artifact "HP%": whole-number percent of base
    else eff[key] += val;                                     // artifact flat, or flat bonus
  };
  for (const a of c.equippedArtifacts || []) {
    add(a.mainStat, a.mainStatValue);
    for (const s of a.substats || []) add(s.stat, s.value);
  }
  for (const bucket of ['sets','mastery','blessing','relic','empower','factionGuardian']) {
    for (const x of (c.bonusesV2?.[bucket]) || []) {
      const name = KIND[x.statKindId];
      if (x.isAbsolute) add(name.replace('%',''), x.value, false);   // flat bonus
      else add(name.replace('%',''), x.value, true);                 // fraction-of-base bonus
    }
  }
  for (const k of Object.keys(eff)) eff[k] = Math.round(eff[k]);
  return eff;
}
