// tools/bucket-score.mjs — FIRST CUT of the POOL/BUCKET grade (Mike's model, 2026-07-18).
// SHADOW ONLY. Read-only. Touches no live path, no DB writes.
//
// THE MODEL (see knowledge/cb-bucket-taxonomy-DRAFT.md):
//   The pool is 100% of what a team can be, split into six buckets by how much each job matters.
//   Champions FILL buckets. Grade = how well actual fill matches the target allocation — "all the
//   parts make a whole." Replaces the ordinal weights whose 0.25x saturation cliff produced three
//   wrong benchings in one session (a Revive-only champ satisfying all of sustain; Tagoar priced
//   0.25x then measured delivering 28% of team healing; Gnut discarded despite carrying the
//   top-weighted need).
//
// THE SEAT ARITHMETIC (Mike's, and the reason no constants are invented here):
//   5 champions = 100%, so ONE SEAT = 20% of the pool. A champion's single seat is divided across
//   the buckets they actually cover — that is what makes a multi-role champion (Pallas: tempo +
//   3 sustain mechanisms + cleanse) worth more than the sum of the parts, and it is why the
//   allocation sums to exactly 5.0 seats.
//
// ACC GATE: a bucket filled by DEBUFFS only counts as much as those debuffs LAND (champ ACC vs the
// difficulty floor). Mike's ruling: a champion's own ACC is a GATE, not a bucket. Buffs/heals/shields
// are never ACC-gated.
//
// v1 LIMITS — deliberately crude, stated so nobody over-reads the output:
//   • Fill is CAPABILITY-based (which buckets a champ covers), not MAGNITUDE-based. It cannot yet
//     tell a big heal from a small one — the healing/defense columns landed in the capture today and
//     are not wired in.
//   • Over-fill is CAPPED FLAT at 100% (Mike has not ruled flat-vs-declining past a full bucket).
//   • Equal split across covered buckets. A champion who is 90% a healer and incidentally buffs
//     speed is treated as splitting evenly. Wrong, but not arbitrarily wrong.
//   • No masteries/gear term, no synergy term, no leader aura.
// Run: node --env-file=.env.local tools/bucket-score.mjs [Difficulty]   (default Brutal)

import fs from 'fs';
import path from 'path';
import { buildUserChampions } from '../lib/gestal-context.js';
import { mapRoster } from '../lib/match-engine.js';
import { CB_ACC_FLOOR } from '../lib/cb-shadow-goals.js';
import { tagDelivery } from '../lib/bucket-magnitude.js';

const DIFFICULTY = process.argv[2] || 'Brutal';
const ACC_FLOOR = CB_ACC_FLOOR[DIFFICULTY] ?? 150;

// ── The allocation — RULED by Mike 2026-07-18. Sums to 100 / exactly 5.0 seats. ──
export const ALLOCATION = {
  mitigation: 20, damage: 20, tempo: 20, sustain: 15, amplification: 15, cleanse: 10,
};

// ── Bucket membership — every entry is a Mike ruling or follows from one (see the taxonomy doc). ──
export const BUCKETS = {
  mitigation: ['Decrease Attack', 'Decrease C.Rate', 'Decrease C.DMG', 'Decrease ACC', 'Fatigue',
               'Taunt', 'Increase Defense', 'Increase RES'],
  // Redirect family stays here (RULED): Ally Protection / Intercept / Pain Link redistribute damage
  // that is ALREADY incoming — the boss still picks its target and still swings. `Taunt` is the
  // outlier in Mitigation because it changes WHO THE BOSS TARGETS, i.e. it acts before the swing.
  sustain:    ['Shield', 'AoE Shield', 'Ally Protection', 'Block Damage', 'Unkillable', 'Intercept',
               'Pain Link', 'Stone Skin', 'Magma Shield', 'Life Barrier', 'Total Guard', 'Fortify',
               'Immutable', 'Healer', 'AoE Heal', 'Continuous Heal', 'Leech', 'Revive',
               'Revive on Death'],
  // BOUNDARY (RULED 2026-07-18, after review): DAMAGE **generates** damage; AMPLIFICATION **makes
  // existing damage bigger**. `Counterattack` and `Ally Attack` therefore belong HERE, not in
  // amplification — they produce attacks. Counterattack is the same mechanic as `Reflect Damage`
  // (damage on being hit), which was already ruled into Damage, so the two were split across
  // buckets. That loose boundary also inflated amplification, which was running 182-220% on every
  // team while damage carried the teams that actually won.
  damage:     ['Poison', 'HP Burn', 'Poison Cloud', 'Necrosis', 'Enemy Max HP Damage',
               'Poison Explosion', 'Single Target Damage', 'AoE Damage', 'Multi-Hit A1',
               'Reflect Damage', 'Counterattack', 'Ally Attack'],
  amplification: ['Decrease Defense', 'AoE Decrease Defense', 'Weaken', 'Poison Sensitivity',
               'Increase Debuff Duration', 'Debuff Activation',
               'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'Increase ACC'],
  cleanse:    ['Cleanse', 'Block Debuffs'],
  tempo:      ['Increase Speed', 'Increase Turn Meter', 'Fervor', 'Reset Cooldowns', 'Decrease Speed'],
};

// Tags that do NOTHING on Clan Boss — they must not earn pool share. RULED by Mike 2026-07-18.
// The boss is immune to this whole CC family, so it is dead weight regardless of how well built the
// champion is: ~a third of Gnut's kit (Freeze + Decrease Turn Meter), and part of Pelops's (Stun,
// Provoke, Petrification — including the Petrification his passive places on attackers, though the
// HP Burn half of that same passive is very much alive).
// Previously these scored zero only by ACCIDENT — they were simply absent from every CB need — so the
// engine reached the right answer with no rule behind it. Now it is explicit.
export const DEAD_ON_CB = new Set(['Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Stun', 'AoE Stun',
  'Provoke', 'Fear', 'True Fear', 'Sheep', 'Petrification', 'Ensnare', 'Seal', 'Master Seal', 'Hex',
  'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'Block Revive', 'Buff Strip', 'Steal Buffs']);

const bucketOf = (tag, buckets = BUCKETS) => Object.keys(buckets).find(b => buckets[b].includes(tag)) ?? null;

// Each ADDITIONAL champion covering an already-covered bucket adds this fraction of the target.
// Mike, 2026-07-18: "you would give ONE spot for mitigation. any more is bonus from another champ's
// kit. you wouldn't give 2 seats for mitigation." So the FIRST (best) coverer fills the bucket; the
// rest are genuine but secondary. NOT the old 0.25x saturation cliff — that punished the 2nd coverer
// of a need the team still needed; this says the need is already MET and more is surplus.
const BONUS_COVERER = 0.30;

/** How well this champion DELIVERS each bucket they touch (0..1). Independent of how many other
 *  buckets they cover — a champion who does four jobs does each of them fully (that is exactly why
 *  multi-role champions are coveted). The five-seat limit is a SEPARATE constraint, not a divisor.
 *  The earlier "split one seat across covered buckets" rule had it backwards: it made Pallas cleanse
 *  at 50% because she also buffs speed.
 *
 *  MAGNITUDE (lib/bucket-magnitude.js): delivery is now uptime × chance × land-rate, not a bare
 *  "has the tag". This is what separates Pelops landing Decrease ATK at ACC 214 from Gnut landing the
 *  SAME debuff at ACC 20 — the distinction capability-based fill could not see (INS-0031). */
function championDelivery(champ, tagMeta, skillsByName, cfg) {
  const { buckets = BUCKETS, dead = DEAD_ON_CB, accFloor = ACC_FLOOR } = cfg ?? {};
  const tags = (champ.tags ?? []).filter(t => !dead.has(t));
  const rows = skillsByName[champ.name] ?? [];
  const out = {};
  for (const t of tags) {
    const b = bucketOf(t, buckets); if (!b) continue;
    // `assume_booked` is the field mapRoster actually exposes (NOT `is_booked` — that is the raw
    // user_champions/Gestal field one layer down). It folds in the Rare-books-are-cheap heuristic
    // (INS-0003) on top of the real flag. Reading the wrong name silently disabled books entirely.
    const { delivery } = tagDelivery(t, champ, rows, tagMeta,
      { accFloor: ACC_FLOOR, assumeBooked: champ.assume_booked === true });
    out[b] = Math.max(out[b] ?? 0, delivery);  // best-delivered tag in that bucket represents the champ
  }
  return out;
}

// Credit for a bucket given how much filled it. RULED (Mike, 2026-07-18): "anything over 100% is
// DECLINING." Full credit up to the target; surplus still earns something, but progressively less.
//
// DECLINING TOWARD ZERO, NOT NEGATIVE. In a fixed 100% budget across 5 seats, surplus in one bucket
// necessarily means a SHORTFALL in another — and the grade already docks you there. Making the
// over-filled bucket go negative would penalise the same seat twice.
//
// NOTE ON AN EARLIER WRONG OBJECTION: Claude argued against declining because it ranked the BEST
// captured team LAST (Tagoar had the most over-fill: 58.9 vs 43.4 / 45.0). That was an artifact of
// CAPABILITY-based fill, where "over-fill" only meant counting more tags — noise, not surplus. Under
// MAGNITUDE fill it means genuinely surplus delivery (e.g. the measured 2.7x overheal), which should
// indeed stop paying. Do not re-litigate this using capability-fill numbers.
const SURPLUS_DECAY = 0.15;   // log-scale: 2x fill earns ~+10%, 3x ~+16%. Nominal until calibrated.
function bucketCredit(got, target) {
  if (target <= 0) return 0;
  const ratio = got / target;
  if (ratio <= 1) return got;                                   // linear up to a full bucket
  return target * (1 + SURPLUS_DECAY * Math.log(ratio));        // diminishing past it
}

export function scoreTeam(team, tagMeta, skillsByName = {}, cfg = {}) {
  const allocation = cfg.allocation ?? ALLOCATION;
  const fill = Object.fromEntries(Object.keys(allocation).map(b => [b, 0]));
  const per = [];
  // Gather every champion's delivery per bucket, then fill each bucket: best coverer fills it,
  // additional coverers add BONUS_COVERER of the target each.
  const byBucket = Object.fromEntries(Object.keys(allocation).map(b => [b, []]));
  for (const c of team) {
    const d = championDelivery(c, tagMeta, skillsByName, cfg);
    for (const [b, rel] of Object.entries(d)) byBucket[b].push({ name: c.name, rel });
    per.push({ name: c.name, nBuckets: Object.keys(d).length, covered: d });
  }
  for (const [b, target] of Object.entries(allocation)) {
    const cov = byBucket[b].sort((x, y) => y.rel - x.rel);
    if (!cov.length) { fill[b] = 0; continue; }
    fill[b] = target * cov[0].rel;                                   // dedicated seat fills it
    for (const extra of cov.slice(1)) fill[b] += target * extra.rel * BONUS_COVERER;
  }
  let grade = 0;
  const rows = [];
  for (const [b, target] of Object.entries(allocation)) {
    const got = fill[b];
    const pct = target ? got / target : 0;
    grade += bucketCredit(got, target);
    rows.push({ bucket: b, target, got, pct, waste: Math.max(0, got - target) });
  }
  return { grade, rows, per };
}

// ── run it against the real captured teams ───────────────────────────────────
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,ascension_required,tags(name,is_debuff,bypasses_accuracy_check)),champion_auras(aura_type,aura_value,aura_area)';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
// Skill rows WITH cooldowns — mapRoster carries {slot,name,summary} but not cooldowns, and uptime
// needs them. Fetched here rather than widening the live mapRoster carry.
let skillRows = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; skillRows = skillRows.concat(d); if (d.length < 1000) break; }
const skillsByName = {};
for (const r of skillRows) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }

const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const snapF = fs.readdirSync(path.join(REPO, 'gestal-sync/output')).find(f => /Gnut/i.test(f) && f.endsWith('.json'));
const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', snapF), 'utf8'));
const { userChampions } = buildUserChampions(snap.champions ?? [], db);
const mapped = mapRoster(userChampions, {}).mapped;
const byName = Object.fromEntries(mapped.map(c => [c.name, c]));

// The three CAPTURED Brutal teams, with what actually happened.
const RUNS = [
  { label: 'Tagoar   (23.46M, GRANDMASTER, 268t)', names: ['Ezio Auditore', 'Pelops the Victor', 'Narma the Returned', 'Glorious Pallas', 'Tagoar'] },
  { label: 'Fahrakin (21.54M, master,      210t)', names: ['Ezio Auditore', 'Pelops the Victor', 'Narma the Returned', 'Glorious Pallas', 'Fahrakin the Fat'] },
  { label: 'Gnut     (20.20M, master,      177t)', names: ['Gnut', 'Pelops the Victor', 'Narma the Returned', 'Glorious Pallas', 'Fahrakin the Fat'] },
];

console.log(`══ POOL/BUCKET GRADE — Clan Boss ${DIFFICULTY} (ACC floor ${ACC_FLOOR}) ══`);
console.log(`allocation: ${Object.entries(ALLOCATION).map(([b, v]) => `${b} ${v}%`).join(' · ')}\n`);
for (const run of RUNS) {
  const team = run.names.map(n => byName[n]).filter(Boolean);
  if (team.length < 5) { console.log(`${run.label}: MISSING ${run.names.filter(n => !byName[n]).join(', ')}\n`); continue; }
  const { grade, rows, per } = scoreTeam(team, tagMeta, skillsByName);
  console.log(`── ${run.label}`);
  console.log(`   GRADE ${grade.toFixed(1)} / 100`);
  for (const r of rows) {
    const bar = '█'.repeat(Math.round(Math.min(r.pct, 2) * 10)).padEnd(20);
    console.log(`   ${r.bucket.padEnd(14)} target ${String(r.target).padStart(2)}  got ${r.got.toFixed(1).padStart(5)}  ${(r.pct * 100).toFixed(0).padStart(4)}%  ${bar}${r.waste > 0.5 ? ` waste ${r.waste.toFixed(1)}` : ''}`);
  }
  console.log(`   seats: ${per.map(p => `${p.name}(${p.nBuckets})`).join(', ')}\n`);
}
