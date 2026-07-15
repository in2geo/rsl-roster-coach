// Throwaway synthetic test for the Layer 1 watchdog + sustain profiles.
// Run: node tools/_watchdog_test.mjs   (delete after — no DB, pure logic)
import { runWatchdog, computeCompositeScores } from '../lib/watchdog.js';
import { sustainContribution, contentThreatWeight } from '../lib/sustain-profiles.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } };

// Equal usability for all — isolate the composite comparison from the build gate.
const built = () => 5;

// ── 1. Sustain profiles: mechanism ranking on Ice Golem (spike HIGH, debuff MED) ──
console.log('\n[1] sustain mechanism ranking on ice_golem');
const sBlock   = sustainContribution(['Block Debuffs'], 'ice_golem').score;   // prevention
const sShield  = sustainContribution(['Ally Protection'], 'ice_golem').score; // absorption
const sCleanse = sustainContribution(['Cleanse'], 'ice_golem').score;         // removal
console.log(`    BlockDebuffs=${sBlock.toFixed(2)} AllyProtection=${sShield.toFixed(2)} Cleanse=${sCleanse.toFixed(2)}`);
ok(sShield > sCleanse, 'Absorption (Ally Protection) > Removal (Cleanse) on Ice Golem');
ok(sBlock  > sCleanse, 'Prevention (Block Debuffs) > Removal (Cleanse) on Ice Golem');

// Cleanse should be RELATIVELY stronger on Spider (poison = debuff threat is HIGH there).
const sCleanseSpider = sustainContribution(['Cleanse'], 'spider').score;
ok(sCleanseSpider > sCleanse, 'Cleanse scores higher on Spider (debuff threat) than Ice Golem (spike threat)');
ok(contentThreatWeight('ice_golem') > contentThreatWeight('campaign'), 'Ice Golem is more sustain-hungry than Campaign');

// ── 2. The Brogni/Uugo case on a PURE poison/HP-burn team ─────────────────────
console.log('\n[2] Brogni/Uugo watchdog case (ice_golem, pure DoT team)');
// Fielded: three DoT dealers + a poison support + Uugo (Decrease DEF = a true mismatch on
// a pure-DoT team; her only real value here is her heal, making her the weakest fielded).
// Benched: Underpriest Brogni (HP Burn damage + full sustain package). No fielded champ
// deals ATTACK damage, so Decrease DEF multiplies nothing.
const roster = [
  { name: 'Xenomorph',  tags: ['Poison'],  damage_multiplier_score: 5.0 },
  { name: 'HP Burner',  tags: ['HP Burn'], damage_multiplier_score: 3.5 },
  { name: 'Poisoner 2', tags: ['Poison'],  damage_multiplier_score: 3.0 },
  { name: 'Poisoner 3', tags: ['Poison'],  damage_multiplier_score: 2.8 },
  { name: 'Uugo',       tags: ['Decrease Defense', 'Heal'], damage_multiplier_score: 1.0 },
  // benched:
  { name: 'Underpriest Brogni', tags: ['HP Burn', 'Continuous Heal', 'Block Debuffs', 'Ally Protection'], damage_multiplier_score: 2.5 },
  { name: 'Random Nuker',       tags: ['AoE Damage'], damage_multiplier_score: 0.8 }, // benched, weak — must NOT flag
];
const team = roster.slice(0, 5);
const wd = runWatchdog({ roster, team, contentKey: 'ice_golem', usabilityTier: built });

console.log('    composite ranking:');
for (const s of wd.scores) console.log(`      ${s.fielded ? '[F]' : '[b]'} ${s.name.padEnd(18)} comp=${s.composite}  (dmg=${s.damage} sus=${s.sustain} grant=${s.grant})`);
console.log('    flags:'); for (const f of wd.flags) console.log('      →', f.detail);

const brogniFlag = wd.flags.find(f => f.benched === 'Underpriest Brogni');
ok(!!brogniFlag, 'watchdog flags benched Brogni as out-contributing a fielded champ');
ok(brogniFlag && brogniFlag.fielded === 'Uugo', 'the fielded champ Brogni out-scores is Uugo (weakest fielded, mismatched Decrease DEF)');
ok(brogniFlag && /Decrease Defense/.test(brogniFlag.detail) && /nothing/.test(brogniFlag.detail),
   'the flag explains Uugo\'s Decrease DEF adds ~nothing to this DoT team');
ok(!wd.flags.find(f => f.benched === 'Random Nuker'), 'weak benched Random Nuker does NOT fire the watchdog (absolute-margin guard)');

// Uugo's Decrease DEF must contribute ZERO grant on a pure poison/HP-burn team.
const uugo = wd.scores.find(s => s.name === 'Uugo');
ok(uugo.grant === 0, 'Uugo Decrease DEF grant = 0 on a pure DoT team (damage-type mismatch)');

// ── 3. usability gate: an UNBUILT benched champ must not flag ──────────────────
console.log('\n[3] usability gate');
const tierByName = c => (c.name === 'Underpriest Brogni' ? 0 : 5); // Brogni is "fodder"
const wd2 = runWatchdog({ roster, team, contentKey: 'ice_golem', usabilityTier: tierByName });
ok(!wd2.flags.find(f => f.benched === 'Underpriest Brogni'), 'unbuilt (low-tier) Brogni is NOT promoted over built fielded champs');

// ── 4. no-op safety ───────────────────────────────────────────────────────────
console.log('\n[4] safety');
ok(runWatchdog({ roster: [], team: [], contentKey: 'ice_golem' }) === null, 'empty roster/team → null');
const cleanTeam = roster.slice(0, 5);
const wdSelf = runWatchdog({ roster: cleanTeam, team: cleanTeam, contentKey: 'ice_golem', usabilityTier: built });
ok(wdSelf.flags.length === 0, 'no benched champs → no flags');

// ── 5. team-turn buffs (Increase Speed / Turn Meter) earn grant credit (INS-0002) ──
console.log('\n[5] speed/turn-meter support is not scored ~0');
const spdRoster = [
  { name: 'Poison Carrier', tags: ['Poison'], damage_multiplier_score: 4.0 },
  { name: 'HP Burner',      tags: ['HP Burn'], damage_multiplier_score: 3.0 },
  { name: 'Nuker',          tags: ['AoE Damage'], damage_multiplier_score: 2.0 },
  { name: 'Filler',         tags: ['Provoke'], damage_multiplier_score: 0.5 },
  { name: 'Speed Support',  tags: ['Healer', 'Increase Speed', 'Increase Turn Meter'], damage_multiplier_score: 0.3 },
];
const wdSpd = runWatchdog({ roster: spdRoster, team: spdRoster, contentKey: 'clan_boss', usabilityTier: built });
const spdSupport = wdSpd.scores.find(s => s.name === 'Speed Support');
ok(spdSupport.grant > 0, 'a speed/turn-meter support gets non-zero grant credit (not benched as ~0)');

// ── 6. crowd control is credited as survival, discounted on CC-immune content (INS-0004) ──
console.log('\n[6] crowd-control support (Fabian-like) is not scored ~0');
const ccRoster = [
  { name: 'Poison Carrier', tags: ['Poison'], damage_multiplier_score: 4.0 },
  { name: 'HP Burner',      tags: ['HP Burn'], damage_multiplier_score: 3.0 },
  { name: 'Healer',         tags: ['Continuous Heal'], damage_multiplier_score: 0.5 },
  { name: 'Nuker',          tags: ['AoE Damage'], damage_multiplier_score: 2.0 },
  { name: 'Fabian',         tags: ['True Fear', 'Petrification', 'Decrease Turn Meter', 'AoE Damage'], damage_multiplier_score: 0.3 },
];
const wdIG = runWatchdog({ roster: ccRoster, team: ccRoster, contentKey: 'ice_golem', usabilityTier: built });
const fabIG = wdIG.scores.find(s => s.name === 'Fabian');
console.log(`    Fabian on ice_golem: composite=${fabIG.composite} control=${fabIG.control}`);
ok(fabIG.control > 0, 'CC champ gets non-zero control sub-score on Ice Golem');
ok(fabIG.composite > 0.05, 'CC champ is no longer scored ~0 on Ice Golem (blindness fixed)');
// CB is CC-immune → control heavily discounted (ccEffectiveness 0.15).
const wdCB = runWatchdog({ roster: ccRoster, team: ccRoster, contentKey: 'clan_boss', usabilityTier: built });
const fabCB = wdCB.scores.find(s => s.name === 'Fabian');
console.log(`    Fabian on clan_boss: composite=${fabCB.composite}`);
ok(fabIG.composite > fabCB.composite, 'CC contributes MORE on Ice Golem (adds) than CC-immune Clan Boss (immunity guardrail)');

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
