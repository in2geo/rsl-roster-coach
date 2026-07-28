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
import { readSkillKit, CONFIRMED_SKILL_ORDER } from './ai.js';
import { gearProcsForBuild } from './gear.js';
import { makeDragonContent, HELLRAZOR_IMMUNE } from './dragon.js';
import { loadNameResolverRest } from '../champion-names.js';

// ── per-dungeon config: the ONLY dungeon-specific pieces of the otherwise-generic build (P3 weld 1) ──
// The shared skeleton in buildBattle (champion load + resolver, boss from the DB row, exact ally builds)
// is dungeon-agnostic; each dungeon supplies its boss-immunity list, enemy-level source, non-boss enemy
// assembly, content factory, and any extra result fields here. Add a dungeon = add an entry.
const DUNGEONS = {
  "Dragon's Lair": {
    bossImmune: HELLRAZOR_IMMUNE,
    // ENEMY LEVEL drives the DEF-mitigation curve (higher-level attackers penetrate DEF more). Dragon reads
    // the in-game-verified level table (data/dragon-wave-data.json); Dragon-17 mobs/boss are L220.
    levelFor: (stage, repoRoot) => {
      try {
        const wd = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'dragon-wave-data.json'), 'utf8')).filter(r => Number(r.Stage) === stage);
        if (wd.length) return Number(wd[0].Level) || 60;
      } catch { /* fall back to 60 */ }
      return 60;
    },
    // non-boss enemies — Dragon's are real champions in discrete WAVES (role 'wave', grouped by wave_number),
    // each with the stats from its row + the kit/affinity inherited from its champion_id.
    buildEnemies: ({ enemyRows, stage, stageLevel, byId }) => {
      const buildWaveMob = (r) => {
        const cat = byId[r.champion_id];
        return makeCombatant({ name: `${r.enemy_name}#${r.position}`, side: 'enemy', role: 'wave', level: stageLevel,
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
      return { waves };
    },
    makeContent: ({ stage, boss, built }) => makeDragonContent({ stageNumber: stage, purpleBarHp: 0.20 * boss.maxHp, waves: built.waves, boss }),
    // extra result fields Dragon consumers read: the waves + a human-readable wave listing
    describe: ({ built }) => ({ waves: built.waves, waveMobNames: built.waves ? built.waves.map((w, i) => `wave ${i + 1}: ${w.enemies.map(e => e.name).join(', ')}`) : [] }),
  },
};

// buildBattle — the generic fixture→battle builder (P3 weld 1: de-Dragoned). Dispatches on the fixture's
// dungeon to a DUNGEONS config; the champion load, boss build, and exact ally builds are shared. Dragon
// behaviour is byte-identical to the old buildDragonBattle (model-golden 7/7, snapshot no-drift).
export async function buildBattle({ rest, fixture, repoRoot }) {
  const dungeonName = fixture.content?.dungeon;
  const cfg = DUNGEONS[dungeonName];
  if (!cfg) return { skip: `no sim builder for dungeon ${JSON.stringify(dungeonName)}` };
  const stage = fixture.content.stage;

  // champions (paged) + the canonical name resolver
  const SEL = 'id,name,affinity,base_spd,champion_skills(slot,skill_name,skill_summary,cooldown_base,cooldown_booked,damage_multiplier,multiplier_type)';
  let db = [];
  for (let off = 0; ; off += 1000) {
    const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${off}`);
    if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
  }
  const byId = Object.fromEntries(db.map(c => [c.id, c]));
  const resolver = await loadNameResolverRest(rest);

  const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === dungeonName);
  if (!dun) return { skip: `no ${dungeonName} dungeon row` };
  const enemyRows = await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,wave_number,position,champion_id,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id);
  const affRows = await rest('dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.' + dun.id);
  const stageAff = Object.fromEntries(affRows.map(r => [r.stage_number, r.affinity]));
  const stageLevel = cfg.levelFor(stage, repoRoot);

  // boss — stats from the row, affinity from the stage rotation, immunity from the dungeon config
  const bossRow = enemyRows.find(e => e.stage_number === stage && e.enemy_role === 'boss');
  if (!bossRow) return { skip: `no boss row for stage ${stage}` };
  const boss = makeCombatant({ name: bossRow.enemy_name, side: 'enemy', role: 'boss', level: stageLevel,
    maxHp: +bossRow.hp, atk: +bossRow.atk, def: +bossRow.def, spd: +bossRow.spd, acc: +bossRow.acc, res: +bossRow.res,
    critRate: +bossRow.crit_rate, critDmg: +bossRow.crit_dmg, affinity: stageAff[stage] });
  boss.immune = cfg.bossImmune;

  // non-boss enemies — dungeon-specific (Dragon: discrete waves; Spider: a spawn template, Slice B)
  const built = cfg.buildEnemies({ enemyRows, stage, stageLevel, byId, stageAff });

  // exact ally builds
  const buildRef = Object.values(fixture.inputs || {}).map(v => v.build).find(Boolean);
  let builds = {};
  try { builds = Object.fromEntries((JSON.parse(fs.readFileSync(path.join(repoRoot, buildRef), 'utf8')).champions || []).map(c => [c.name, c])); }
  catch (e) { return { skip: `cannot read builds (${buildRef}): ${e.message}` }; }

  const missing = [];
  const gearDeferred = [];        // COMPLETE proc sets whose family isn't wired yet — flagged, never silently dropped
  const allies = (fixture.team || []).map((shortName) => {
    const canon = fixture.roster?.[shortName] ?? shortName;
    const hit = resolver.resolveOrThrow(canon, 'golden team hero');
    const cat = byId[hit.id];
    const dbName = cat?.name ?? canon;
    const b = builds[dbName] ?? builds[canon] ?? builds[shortName];
    if (!b) { missing.push(shortName); return null; }
    const s = b.total_stats;
    // Lifesteal 4-set = heals 30% of damage dealt (game fact). NEW build files (tools/build-from-sync.mjs)
    // carry an explicit `lifesteal` gated on a COMPLETE 4-set, so a loose "Lifesteal×1" piece is not
    // miscredited. Fall back to the gear_sets regex only for the frozen hand-captured files, whose
    // gear_sets strings say "Lifesteal (4-set…)" (always a complete set) so the regex is safe there.
    const lifesteal = (b.lifesteal != null)
      ? b.lifesteal
      : ((b.gear_sets || []).some(g => /lifesteal/i.test(g)) ? 0.30 : 0);
    const gp = gearProcsForBuild(b.gear_sets || []);   // COMPLETE chance-proc sets only (partial ×1 pieces grant nothing)
    if (gp.deferred.length) gearDeferred.push(`${shortName}: ${gp.deferred.map(d => `${d.set} (${d.rng_type})`).join(', ')}`);
    const ally = makeCombatant({ name: shortName, side: 'ally',           // SHORT name aligns with the fixture record
      maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd, acc: s.acc, res: s.res,
      critRate: s.crit_rate, critDmg: s.crit_dmg, affinity: b.affinity ?? cat?.affinity, lifesteal,
      // Warmaster/Giant Slayer (tier-6 Offense mastery) — a standard Dragon mastery the real team runs but the
      // build data does not yet capture. EXPERIMENT flag (SIM_TEAM_MASTERY=1) to measure its wave-clear impact
      // until masteries are captured per-champion (has_boss_mastery). Default OFF preserves the current number.
      bossMastery: b.has_boss_mastery ?? (process.env.SIM_TEAM_MASTERY === '1'),
      gearProcs: gp.wired,                                                // on-attack GEAR_PROC family (Toxic/Stun/…)
      skillOrder: CONFIRMED_SKILL_ORDER[canon] ?? CONFIRMED_SKILL_ORDER[shortName] ?? null,   // confirmed non-default AI order
      skills: readSkillKit(cat?.champion_skills ?? []) });
    ally.baseSpd = b.base_spd != null ? +b.base_spd : (cat?.base_spd != null ? +cat.base_spd : null);   // ACTUAL base SPD (synced build) preferred; DB max-ascension is the fallback for frozen hand-captured builds — aura scales BASE only (True Speed §4)
    // Base HP/ATK/DEF for the base-only ARENA bonus — SYNC ONLY (no DB fallback): DB base HP/ATK/DEF are stored
    // at MAX level and would over-credit an under-leveled champ, so a build without them falls back to the old
    // total-based arena in applyBattleLayers rather than to a wrong max-level base.
    ally.baseHp = b.base_hp != null ? +b.base_hp : null; ally.baseAtk = b.base_atk != null ? +b.base_atk : null; ally.baseDef = b.base_def != null ? +b.base_def : null;
    return ally;
  }).filter(Boolean);
  if (missing.length) return { skip: `no exact build for ${missing.join(', ')}`, missing };
  const noBaseSpd = allies.filter(a => a.baseSpd == null).map(a => a.name);   // aura needs base SPD; surface if any is missing rather than silently under-applying

  const content = cfg.makeContent({ stage, boss, built });
  return { allies, content, boss, stage, gearDeferred, noBaseSpd, ...cfg.describe({ built }) };
}
// back-compat: every current caller imports buildDragonBattle; it now dispatches through the generic path
// (a Dragon fixture resolves to the Dragon config, so this is byte-identical to the old function).
export const buildDragonBattle = buildBattle;

// Run-harness battle layers, applied to the built allies BEFORE simulate: the leader SPD aura + the arena
// bonus. BOTH scale off BASE stats only — leader auras and the account-wide Arena/Great-Hall bonuses add a %
// of the champion's raw base stat, never the geared total (True Speed §4; same class of error). Aura reads
// `ally.baseSpd`; arena reads `ally.baseHp/baseAtk/baseDef` (HP/ATK/DEF only — arena grants no SPD/ACC/RES).
// A build WITHOUT synced base HP/ATK/DEF falls back to the old total-based arena (DB base HP/ATK/DEF are
// max-level → would over-credit). Centralized so sim-fixture-volume / sim-run / model-golden can't drift.
// Defaults: aura +19% (Ezio SPD leader), arena +3% (Bronze III).
// ⚠ OPEN QUESTION (CLAUDE.md #7): whether Classic Arena bonuses apply in PvE at all is UNVERIFIED.
export function applyBattleLayers(allies, { auraSpdPct = 0.19, arenaPct = 0.03 } = {}) {
  for (const a of allies) {
    a.spd = a.spd + Math.round((a.baseSpd ?? 0) * auraSpdPct);   // aura: +% of BASE speed on top of the geared total
    a.maxHp = a.baseHp  != null ? a.maxHp + Math.round(a.baseHp  * arenaPct) : Math.round(a.maxHp * (1 + arenaPct));
    a.hp = a.maxHp;
    a.atk = a.baseAtk != null ? a.atk + Math.round(a.baseAtk * arenaPct) : Math.round(a.atk * (1 + arenaPct));
    a.def = a.baseDef != null ? a.def + Math.round(a.baseDef * arenaPct) : Math.round(a.def * (1 + arenaPct));
  }
  return allies;
}
