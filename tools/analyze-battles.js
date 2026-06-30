/**
 * Analyze the captured battle log (gestal-sync/RslBattleReader/output/battle-log.json).
 *
 * Turns the raw per-battle records the reader captures (dungeon, stage, result,
 * turns, retreat, team) into a readable summary:
 *   1. Per dungeon/stage — attempts, win/loss/retreat, best & average turns, last run.
 *   2. Per champion — how often fielded, across which content, win rate when present.
 *   3. Headline notes — where you're farming, where you're losing/retreating.
 *
 * Read-only. No DB, no network. Reuses the readers in lib/gestal-context.js.
 *
 * Usage:
 *   node tools/analyze-battles.js                 # most-recent account
 *   node tools/analyze-battles.js --account <id>  # a specific account
 *   node tools/analyze-battles.js --json          # machine-readable output
 */
import { readBattleHistory, readGestalRoster } from '../lib/gestal-context.js';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const asJson = args.includes('--json');
const accountArg = flag('--account') ?? null;

// ── Load ───────────────────────────────────────────────────────────────────────
const allBattles = readBattleHistory();
if (!allBattles.length) {
  console.error('No battles in the log yet (battle-log.json is empty or missing).');
  process.exit(0);
}

// Scope to one account: explicit --account, else the account of the newest battle.
const newest = [...allBattles].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0];
const accountId = accountArg ?? newest.accountId ?? null;
const battles = allBattles.filter(b => !accountId || b.accountId === accountId);
const roster = readGestalRoster(accountId);
const displayName = battles[0]?.displayName ?? roster?.displayName ?? accountId ?? 'unknown';

// ── 1. Per stage ─────────────────────────────────────────────────────────────────
// Authoritative stage number from the in-memory StageId (last 3 digits = stage).
// Used to resolve / override the fingerprint stage, incl. older entries that have a
// stageId but no stageNumber yet.
const stageNumOf = (b) =>
  (typeof b.stageId === 'number' && b.stageId > 1000) ? b.stageId % 1000 : (b.stageNumber ?? null);
const stageKey = (b) => {
  const sn = stageNumOf(b);
  if (b.dungeon && sn != null) return `${b.dungeon} Stage ${sn}`;
  return b.stage ?? (b.dungeon ? `${b.dungeon} (stage unknown)` : 'Unknown content');
};
const stages = new Map();
for (const b of battles) {
  const key = stageKey(b);
  if (!stages.has(key)) stages.set(key, {
    label: key, dungeon: b.dungeon ?? null, stageNumber: stageNumOf(b),
    attempts: 0, victories: 0, defeats: 0, retreats: 0,
    turns: [], lastAt: null, lastResult: null,
  });
  const s = stages.get(key);
  s.attempts++;
  if (b.result === 'Victory') s.victories++;
  else if (b.result === 'Defeat') s.defeats++;
  if (b.finishCause === 'Retreat') s.retreats++;
  if (typeof b.turns === 'number') s.turns.push(b.turns);
  if (!s.lastAt || (b.capturedAt && b.capturedAt > s.lastAt)) { s.lastAt = b.capturedAt; s.lastResult = b.result; }
}
const round = (n) => Math.round(n * 10) / 10;
const stageRows = [...stages.values()].map(s => ({
  ...s,
  winRate: s.attempts ? round(100 * s.victories / s.attempts) : 0,
  bestTurns: s.turns.length ? Math.min(...s.turns) : null,
  avgTurns:  s.turns.length ? round(s.turns.reduce((a, c) => a + c, 0) / s.turns.length) : null,
})).sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));

// Leader (aura source) of a battle: the hero flagged isLeader, else the slot-0
// hero (fallback for entries captured before the isLeader flag existed).
const leaderOf = (b) => {
  const hs = b.heroes ?? [];
  if (!hs.length) return null;
  return hs.find(h => h.isLeader) ?? [...hs].sort((a, c) => a.slot - c.slot)[0];
};

// ── 2. Per champion ────────────────────────────────────────────────────────────
const champs = new Map();
for (const b of battles) {
  const leader = leaderOf(b);
  for (const h of (b.heroes ?? [])) {
    const name = h.name ?? `#${h.heroId}`;
    if (!champs.has(name)) champs.set(name, { name, battles: 0, victories: 0, dungeons: new Set(), led: 0, ledWins: 0 });
    const c = champs.get(name);
    c.battles++;
    if (b.result === 'Victory') c.victories++;
    if (b.dungeon) c.dungeons.add(b.dungeon);
    if (leader && (leader.name ?? `#${leader.heroId}`) === name) {
      c.led++;
      if (b.result === 'Victory') c.ledWins++;
    }
  }
}
const champRows = [...champs.values()].map(c => ({
  name: c.name, battles: c.battles,
  winRate: c.battles ? round(100 * c.victories / c.battles) : 0,
  dungeons: [...c.dungeons].sort(),
  led: c.led,
  ledWinRate: c.led ? round(100 * c.ledWins / c.led) : null,
})).sort((a, b) => b.battles - a.battles || a.name.localeCompare(b.name));

// ── 2b. Per leader ───────────────────────────────────────────────────────────
const leaderRows = champRows
  .filter(c => c.led > 0)
  .map(c => ({ name: c.name, led: c.led, ledWinRate: c.ledWinRate }))
  .sort((a, b) => b.led - a.led || a.name.localeCompare(b.name));

// ── 3. Headline notes ──────────────────────────────────────────────────────────
const notes = [];
const struggles = stageRows.filter(s => s.defeats > 0 || s.retreats > 0);
for (const s of struggles)
  notes.push(`Struggling at ${s.label}: ${s.defeats} loss(es), ${s.retreats} retreat(s) in ${s.attempts} run(s).`);
const farming = stageRows.filter(s => s.attempts >= 3 && s.winRate === 100);
for (const s of farming)
  notes.push(`Farming ${s.label} cleanly (${s.attempts} wins, best ${s.bestTurns ?? '?'} turns).`);
const unknownStage = stageRows.filter(s => s.dungeon && s.stageNumber == null);
for (const s of unknownStage)
  notes.push(`${s.dungeon}: stage number missing (captured before StageId support) — re-run it and it resolves automatically.`);

// ── Output ───────────────────────────────────────────────────────────────────────
if (asJson) {
  console.log(JSON.stringify({ account: { displayName, accountId }, totals: { battles: battles.length },
    stages: stageRows.map(({ turns, ...r }) => r), champions: champRows, leaders: leaderRows, notes }, null, 2));
  process.exit(0);
}

const pct = (n) => `${n}%`.padStart(4);
console.log(`\nBattle analysis — ${displayName}${accountId ? ` (${accountId})` : ''}`);
console.log(`${battles.length} battle(s) logged${allBattles.length !== battles.length ? ` (of ${allBattles.length} across all accounts)` : ''}\n`);

console.log('By stage:');
console.log('  ' + 'STAGE'.padEnd(34) + 'RUNS  W/L/R   WIN   BEST  AVG   LAST');
for (const s of stageRows) {
  const wlr = `${s.victories}/${s.defeats}/${s.retreats}`.padEnd(7);
  const last = (s.lastAt ?? '').slice(0, 10);
  console.log('  ' + s.label.padEnd(34) +
    String(s.attempts).padStart(4) + '  ' + wlr + ' ' + pct(s.winRate) + '  ' +
    String(s.bestTurns ?? '-').padStart(4) + '  ' + String(s.avgTurns ?? '-').padStart(4) + '  ' + last);
}

console.log('\nBy champion:');
console.log('  ' + 'CHAMPION'.padEnd(26) + 'RUNS  WIN   LED   USED IN');
for (const c of champRows)
  console.log('  ' + c.name.padEnd(26) + String(c.battles).padStart(4) + '  ' + pct(c.winRate) + '  ' +
    String(c.led || '-').padStart(3) + '   ' + c.dungeons.join(', '));

if (leaderRows.length) {
  console.log('\nBy leader (aura source — slot 0):');
  console.log('  ' + 'LEADER'.padEnd(26) + 'LED   WIN');
  for (const l of leaderRows)
    console.log('  ' + l.name.padEnd(26) + String(l.led).padStart(3) + '   ' + (l.ledWinRate == null ? '  -' : pct(l.ledWinRate)));
  console.log('  (aura EFFECT pending champion aura data — this shows who provided it)');
}

if (notes.length) {
  console.log('\nNotes:');
  for (const n of notes) console.log('  - ' + n);
}
console.log('');
