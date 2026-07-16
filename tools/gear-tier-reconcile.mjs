// tools/gear-tier-reconcile.mjs — the post-battle gear-tier CHECK for Gestal accounts.
//
// Grades every champ's real gear, derives the account's ceiling tier, and — if a battle
// capture is available — flags any champ that FOUGHT below the account tier (the model's
// "field it in your good gear" promise wasn't met). Also prints the empirical per-tier
// multipliers derived from the account's own gear, next to the placeholder GEAR_TIERS.
//
//   node tools/gear-tier-reconcile.mjs [AccountDisplayName=GuapoDonni] [--capture] [--all-tiers]
//     --capture    pull the champs that fought in the most recent captured battle for this
//                  account and run the fielded-drift check against them.
//     --all-tiers  print the calibration table for every graded tier (default: ceiling only).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reconcileGearTiers, summarizeCalibration, TIER_ORDER } from '../lib/gear-tier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'gestal-sync', 'output');
const BATTLE_LOG = path.join(REPO, 'gestal-sync', 'RslBattleReader', 'output', 'battle-log.json');

const args = process.argv.slice(2);
const want = args.find(a => !a.startsWith('--')) || 'GuapoDonni';
const useCapture = args.includes('--capture');
const allTiers = args.includes('--all-tiers');

// Placeholder tier table (mirror of estimate-stats.js GEAR_TIERS) for side-by-side.
const PLACEHOLDER = {
  starter: { hp: 0.30, atk: 0.30, def: 0.30, spd: 15,  acc: 30,  res: 20,  crate: 0.20, cdmg: 0.20 },
  fair:    { hp: 0.60, atk: 0.60, def: 0.60, spd: 35,  acc: 80,  res: 50,  crate: 0.45, cdmg: 0.50 },
  good:    { hp: 1.00, atk: 1.00, def: 1.00, spd: 60,  acc: 150, res: 80,  crate: 0.70, cdmg: 0.80 },
  endgame: { hp: 2.00, atk: 2.00, def: 2.00, spd: 100, acc: 220, res: 120, crate: 0.90, cdmg: 1.30 },
};

// ── load snapshot ────────────────────────────────────────────────────────────
const file = fs.readdirSync(OUT).find(f => f.includes(want) && f.endsWith('.json') && !f.startsWith('gear-corpus'));
if (!file) { console.error(`No Gestal snapshot matching "${want}" in ${OUT}`); process.exit(1); }
const snap = JSON.parse(fs.readFileSync(path.join(OUT, file), 'utf8'));
const champions = snap.champions ?? [];

// ── optional: fielded champs from the latest captured battle ───────────────────
let fieldedHeroIds = null, battleLabel = null;
if (useCapture) {
  try {
    const log = JSON.parse(fs.readFileSync(BATTLE_LOG, 'utf8'));
    const mine = (Array.isArray(log) ? log : [])
      .filter(b => !snap.accountId || !b.accountId || b.accountId === snap.accountId)
      .filter(b => Array.isArray(b.heroes) && b.heroes.length)
      .sort((a, b) => String(b.capturedAt ?? '').localeCompare(String(a.capturedAt ?? '')));
    if (mine.length) {
      const b = mine[0];
      fieldedHeroIds = b.heroes.map(h => h.heroId ?? h.id).filter(v => v != null);
      battleLabel = `${b.stage ?? b.dungeon ?? 'battle'} — ${b.result ?? '?'} (${b.capturedAt ?? '?'})`;
    }
  } catch { /* no log — skip drift */ }
}

// ── run ────────────────────────────────────────────────────────────────────────
const { account, perChamp, samples, fieldedDrift } = reconcileGearTiers(champions, { fieldedHeroIds });
const calib = summarizeCalibration(samples);

console.log(`\n═══ Gear-tier reconciliation — ${snap.displayName ?? want} ═══\n`);
console.log(`ACCOUNT CEILING TIER: ${account.tier.toUpperCase()}   (owns a full team's gear at this tier)`);
console.log(`  champs graded at tier-or-above:  ${TIER_ORDER.map(t => `${t} ${account.counts[t]}`).join('  |  ')}`);
console.log(`  (${account.graded} champs graded of ${champions.filter(c => !c.inStorage).length} owned)\n`);

console.log(`Top graded champs (gear each is CURRENTLY wearing):`);
for (const c of perChamp.slice(0, 12)) {
  const flag = TIER_ORDER.indexOf(c.tier) < TIER_ORDER.indexOf(account.tier) ? '  ↓ below ceiling' : '';
  console.log(`  ${c.name.padEnd(22)} ${c.rank}★ +${c.level}  → ${c.tier}${c.partial ? ' (partial)' : ''}${flag}`);
}

if (useCapture) {
  console.log(`\n── Fielded-drift check ──`);
  if (!fieldedHeroIds) console.log(`  (no captured battle with hero data for this account)`);
  else {
    console.log(`  last battle: ${battleLabel}`);
    if (!fieldedDrift.length) console.log(`  ✓ every fielded champ is geared at or above the account ceiling (${account.tier}).`);
    else {
      console.log(`  ⚠ ${fieldedDrift.length} champ(s) fought BELOW the account ceiling (${account.tier}):`);
      for (const d of fieldedDrift) {
        console.log(`     ${d.name.padEnd(22)} fought at ${d.fieldedTier} (${d.rank}★ +${d.level}) — model assumed ${d.accountTier}.`);
      }
      console.log(`  → the prediction assumed ${account.tier} gear on these champs; move your good sets onto them to hit it.`);
    }
  }
}

// ── calibration: empirical vs placeholder ──────────────────────────────────────
const pctS  = (v) => v == null ? '   —' : `×${(1 + v).toFixed(2)}`;
const flatS = (v) => v == null ? ' —' : `+${Math.round(v)}`;
const tiersToShow = allTiers ? TIER_ORDER.filter(t => calib[t]) : (calib[account.tier] ? [account.tier] : []);

console.log(`\n── Calibration — this account's real gear vs placeholder GEAR_TIERS ──`);
for (const t of tiersToShow) {
  const e = calib[t], p = PLACEHOLDER[t];
  console.log(`\n  ${t.toUpperCase()} tier   (n=${e.n} graded champs)`);
  console.log(`    HP   empirical ${pctS(e.hp)}   placeholder ×${(1 + p.hp).toFixed(2)}`);
  console.log(`    ATK  empirical ${pctS(e.atk)}   placeholder ×${(1 + p.atk).toFixed(2)}`);
  console.log(`    DEF  empirical ${pctS(e.def)}   placeholder ×${(1 + p.def).toFixed(2)}`);
  console.log(`    SPD  empirical median ${flatS(e.spd.median)}  role ${flatS(e.spd.role)}   placeholder +${p.spd}`);
  console.log(`    ACC  empirical median ${flatS(e.acc.median)}  role ${flatS(e.acc.role)}   placeholder +${p.acc}   ← debuffers carry ACC; use "role"`);
  console.log(`    RES  empirical median ${flatS(e.res.median)}  role ${flatS(e.res.role)}   placeholder +${p.res}`);
  console.log(`    CRATE empirical ${e.crate == null ? '—' : '+' + Math.round(e.crate * 100)}   CDMG empirical ${e.cdmg == null ? '—' : '+' + Math.round(e.cdmg * 100)}   (placeholder +${Math.round(p.crate * 100)} / +${Math.round(p.cdmg * 100)})`);

  // Role-aware breakdown — DEF read from Defense/Support champs, ATK from Attack champs, etc.
  console.log(`    by role (each stat measured from champs geared for that role):`);
  for (const [role, r] of Object.entries(e.byRole).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`      ${String(role).padEnd(9)} n=${r.n}  HP ${pctS(r.hp)}  ATK ${pctS(r.atk)}  DEF ${pctS(r.def)}  SPD ${flatS(r.spd.median)}  ACC ${flatS(r.acc.median)}  RES ${flatS(r.res.median)}`);
  }
}
console.log('');
