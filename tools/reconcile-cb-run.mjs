// Manual CB reconciliation for the newest DonBrogni Clan Boss key (2026-07-14).
// Closes the loop by hand: model PREDICTION (contribution model) vs REALITY (capture).
// reconcile-runs.mjs skips Clan Boss, so this stands in for it. Real tags (live DB),
// nominal stats (supports are tag-driven, so this is faithful for the question we ask:
// does the model VALUE the turn-multiplier support?). Run: node tools/reconcile-cb-run.mjs
import { computeContributions } from '../lib/contribution-model.js';

// Captured REALITY (battle-log.json, 2026-07-14T22:43): 9.94M over 134t, all died.
const REALITY = {
  total: 9943848, turns: 134,
  heroes: {
    'Xenomorph': 6556739, 'Underpriest Brogni': 1644848, 'Ezio Auditore': 1241564,
    'Michelangelo': 408364, 'Apothecary': 92333,
  },
};

// Fielded team — REAL approved tags (live DB), nominal stats. Xenomorph = poison engine;
// Apothecary = the turn-multiplier support under test. has_boss_mastery nominal on the carrier.
const TEAM = [
  { name: 'Xenomorph',          tags: ['Poison', 'Decrease Defense', 'Revive'],                 atk: 3000, spd: 200, hp: 55000, crit_rate: 60, crit_dmg: 180, damage_multiplier_score: 4.0, has_boss_mastery: true },
  { name: 'Underpriest Brogni', tags: ['HP Burn', 'Increase Attack', 'Shield', 'Continuous Heal', 'Block Debuffs'], atk: 2200, spd: 150, hp: 60000, crit_rate: 40, crit_dmg: 150, damage_multiplier_score: 2.0, has_boss_mastery: false },
  { name: 'Ezio Auditore',      tags: ['Poison', 'Poison Sensitivity', 'Decrease Defense', 'AoE Damage'], atk: 2600, spd: 180, hp: 45000, crit_rate: 60, crit_dmg: 170, damage_multiplier_score: 3.0, has_boss_mastery: false },
  { name: 'Michelangelo',       tags: ['Increase Attack', 'Decrease Defense', 'Decrease Attack', 'Leech', 'Shield', 'Debuff Spread'], atk: 2400, spd: 160, hp: 50000, crit_rate: 50, crit_dmg: 160, damage_multiplier_score: 1.5, has_boss_mastery: false },
  { name: 'Apothecary',         tags: ['Healer', 'Increase Speed', 'Increase Turn Meter', 'Multi-Hit A1'], atk: 1500, spd: 190, hp: 40000, crit_rate: 15, crit_dmg: 60, damage_multiplier_score: 0.4, has_boss_mastery: false },
];

const NOMINAL_BOSS_HP = 40_000_000; // CB-scale nominal; relative shares are what we read
const res = computeContributions(TEAM, { bossHp: NOMINAL_BOSS_HP });

console.log('=== MODEL PREDICTION (contribution model, BEFORE speed rule) ===');
console.log(`killTurns=${isFinite(res.killTurns)?Math.round(res.killTurns):'inf'}  confidence=${res.confidence}  ${res.dataWarning?'['+res.dataWarning+']':''}`);
const realTotal = REALITY.total;
console.log('\n  champ                  model share   |   REALITY share   (model own/granted)');
for (const r of res.perChampion) {
  const realDmg = REALITY.heroes[r.name] ?? 0;
  const realShare = (realDmg / realTotal * 100).toFixed(0);
  console.log(`  ${r.name.padEnd(20)}   ${(r.share*100).toFixed(1).padStart(5)}%      |   ${String(realShare).padStart(4)}%          (own ${Math.round(r.ownDamage/1e6*10)/10}M / grant ${Math.round(r.grantedDamage/1e6*10)/10}M / surv ${Math.round(r.grantedSurvival/1e6*10)/10}M)`);
}
const apo = res.perChampion.find(r => r.name === 'Apothecary');
console.log(`\n  >>> Apothecary model contribution share: ${(apo.share*100).toFixed(1)}%  (the champion the user found pivotal)`);
