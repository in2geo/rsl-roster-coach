// lib/sim/dragon-fixture.js — build a RUNNABLE Dragon battle from a golden fixture + the live DB.
//
// One build path for "the real Dragon-16 fight": exact ally builds (data/observed-builds/*), the boss
// and wave mobs from dungeon_stage_enemies, kits parsed from the live champion skill text. Extracted so
// the trace oracle (tools/sim-trace.mjs) scores the SAME battle the golden rung does, with no drift.
// DB-gated by the caller (pass a `rest(path)` REST client). Champion NAMES on the returned allies are
// the fixture's SHORT names, so a sim death lines up with the fixture timeline / per-hero record.

import fs from 'fs';
import path from 'path';
import { makeCombatant, actEnemyMob } from './engine.js';
import { readSkillKit } from './ai.js';
import { makeDragonContent, HELLRAZOR_IMMUNE } from './dragon.js';
import { loadNameResolverRest } from '../champion-names.js';

export async function buildDragonBattle({ rest, fixture, repoRoot }) {
  if (fixture.content?.dungeon !== "Dragon's Lair") return { skip: 'not a Dragon fixture' };
  const stage = fixture.content.stage;

  // champions (paged) + the canonical name resolver
  const SEL = 'id,name,affinity,champion_skills(slot,skill_name,skill_summary,cooldown_base,cooldown_booked,damage_multiplier,multiplier_type)';
  let db = [];
  for (let off = 0; ; off += 1000) {
    const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${off}`);
    if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
  }
  const byId = Object.fromEntries(db.map(c => [c.id, c]));
  const resolver = await loadNameResolverRest(rest);

  const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === "Dragon's Lair");
  if (!dun) return { skip: 'no Dragon dungeon row' };
  const enemyRows = await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,wave_number,position,champion_id,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id);
  const affRows = await rest('dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.' + dun.id);
  const stageAff = Object.fromEntries(affRows.map(r => [r.stage_number, r.affinity]));

  // boss
  const bossRow = enemyRows.find(e => e.stage_number === stage && e.enemy_role === 'boss');
  if (!bossRow) return { skip: `no boss row for stage ${stage}` };
  const boss = makeCombatant({ name: bossRow.enemy_name, side: 'enemy', role: 'boss',
    maxHp: +bossRow.hp, atk: +bossRow.atk, def: +bossRow.def, spd: +bossRow.spd, acc: +bossRow.acc, res: +bossRow.res,
    critRate: +bossRow.crit_rate, critDmg: +bossRow.crit_dmg, affinity: stageAff[stage] });
  boss.immune = HELLRAZOR_IMMUNE;

  // wave mobs — real champions: stats from the row, kit + affinity inherited from champion_id
  const buildWaveMob = (r) => {
    const cat = byId[r.champion_id];
    return makeCombatant({ name: `${r.enemy_name}#${r.position}`, side: 'enemy', role: 'wave',
      maxHp: +r.hp, atk: +r.atk, def: +r.def, spd: +r.spd, acc: +r.acc, res: +r.res,
      critRate: +r.crit_rate, critDmg: +r.crit_dmg, affinity: cat?.affinity,
      skills: readSkillKit(cat?.champion_skills ?? []) });
  };
  const waveRows = enemyRows.filter(e => e.enemy_role === 'wave' && e.stage_number === stage);
  const waves = waveRows.length
    ? [...new Set(waveRows.map(e => e.wave_number))].sort((a, b) => a - b).map(wn => ({
        enemies: waveRows.filter(e => e.wave_number === wn).sort((a, b) => a.position - b.position).map(buildWaveMob),
        actEnemy: actEnemyMob }))
    : null;

  // exact ally builds
  const buildRef = Object.values(fixture.inputs || {}).map(v => v.build).find(Boolean);
  let builds = {};
  try { builds = Object.fromEntries((JSON.parse(fs.readFileSync(path.join(repoRoot, buildRef), 'utf8')).champions || []).map(c => [c.name, c])); }
  catch (e) { return { skip: `cannot read builds (${buildRef}): ${e.message}` }; }

  const missing = [];
  const allies = (fixture.team || []).map((shortName) => {
    const canon = fixture.roster?.[shortName] ?? shortName;
    const hit = resolver.resolveOrThrow(canon, 'golden team hero');
    const cat = byId[hit.id];
    const dbName = cat?.name ?? canon;
    const b = builds[dbName] ?? builds[canon] ?? builds[shortName];
    if (!b) { missing.push(shortName); return null; }
    const s = b.total_stats;
    return makeCombatant({ name: shortName, side: 'ally',                 // SHORT name aligns with the fixture record
      maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd, acc: s.acc, res: s.res,
      critRate: s.crit_rate, critDmg: s.crit_dmg, affinity: b.affinity ?? cat?.affinity,
      skills: readSkillKit(cat?.champion_skills ?? []) });
  }).filter(Boolean);
  if (missing.length) return { skip: `no exact build for ${missing.join(', ')}`, missing };

  const content = makeDragonContent({ stageNumber: stage, purpleBarHp: 0.20 * boss.maxHp, waves, boss });
  const waveMobNames = waves ? waves.map((w, i) => `wave ${i + 1}: ${w.enemies.map(e => e.name).join(', ')}`) : [];
  return { allies, content, boss, waves, stage, waveMobNames };
}
