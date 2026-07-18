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
  sustain:    ['Shield', 'AoE Shield', 'Ally Protection', 'Block Damage', 'Unkillable', 'Intercept',
               'Stone Skin', 'Magma Shield', 'Life Barrier', 'Total Guard', 'Fortify', 'Immutable',
               'Healer', 'AoE Heal', 'Continuous Heal', 'Leech', 'Revive', 'Revive on Death'],
  damage:     ['Poison', 'HP Burn', 'Poison Cloud', 'Necrosis', 'Enemy Max HP Damage',
               'Poison Explosion', 'Single Target Damage', 'AoE Damage', 'Multi-Hit A1',
               'Reflect Damage'],
  amplification: ['Decrease Defense', 'AoE Decrease Defense', 'Weaken', 'Poison Sensitivity',
               'Increase Debuff Duration', 'Debuff Activation', 'Counterattack', 'Ally Attack',
               'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'Increase ACC'],
  cleanse:    ['Cleanse', 'Block Debuffs'],
  tempo:      ['Increase Speed', 'Increase Turn Meter', 'Fervor', 'Reset Cooldowns', 'Decrease Speed'],
};

// Tags that do NOTHING on Clan Boss — they must not earn pool share. (PROPOSED-dead list: stated
// from general game knowledge, NOT yet confirmed by Mike. A wrong entry here silently zeroes a real
// capability, so this is the riskiest table in the file.)
export const DEAD_ON_CB = new Set(['Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep', 'Stun', 'AoE Stun',
  'Provoke', 'Fear', 'True Fear', 'Sheep', 'Petrification', 'Ensnare', 'Seal', 'Master Seal', 'Hex',
  'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'Block Revive', 'Buff Strip', 'Steal Buffs']);

const bucketOf = (tag) => Object.keys(BUCKETS).find(b => BUCKETS[b].includes(tag)) ?? null;

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
 *  at 50% because she also buffs speed. */
function championDelivery(champ, tagMeta) {
  const tags = (champ.tags ?? []).filter(t => !DEAD_ON_CB.has(t));
  const out = {};
  for (const t of tags) {
    const b = bucketOf(t); if (!b) continue;
    // Reliability: an ACC-gated debuff only counts as much as it lands. Buffs/heals always apply.
    const meta = tagMeta?.[t];
    const gated = meta?.is_debuff && !meta?.bypasses_accuracy_check;
    const acc = champ.estimated_stats?.acc ?? 0;
    const rel = gated ? Math.max(0.15, Math.min(1, acc / ACC_FLOOR)) : 1;
    out[b] = Math.max(out[b] ?? 0, rel);   // best-delivered tag in that bucket represents the champ
  }
  return out;
}

export function scoreTeam(team, tagMeta) {
  const fill = Object.fromEntries(Object.keys(ALLOCATION).map(b => [b, 0]));
  const per = [];
  // Gather every champion's delivery per bucket, then fill each bucket: best coverer fills it,
  // additional coverers add BONUS_COVERER of the target each.
  const byBucket = Object.fromEntries(Object.keys(ALLOCATION).map(b => [b, []]));
  for (const c of team) {
    const d = championDelivery(c, tagMeta);
    for (const [b, rel] of Object.entries(d)) byBucket[b].push({ name: c.name, rel });
    per.push({ name: c.name, nBuckets: Object.keys(d).length, covered: d });
  }
  for (const [b, target] of Object.entries(ALLOCATION)) {
    const cov = byBucket[b].sort((x, y) => y.rel - x.rel);
    if (!cov.length) { fill[b] = 0; continue; }
    fill[b] = target * cov[0].rel;                                   // dedicated seat fills it
    for (const extra of cov.slice(1)) fill[b] += target * extra.rel * BONUS_COVERER;
  }
  let grade = 0;
  const rows = [];
  for (const [b, target] of Object.entries(ALLOCATION)) {
    const got = fill[b];
    const pct = target ? got / target : 0;
    grade += Math.min(got, target);            // v1: over-fill capped flat, no credit past 100%
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
  const { grade, rows, per } = scoreTeam(team, tagMeta);
  console.log(`── ${run.label}`);
  console.log(`   GRADE ${grade.toFixed(1)} / 100`);
  for (const r of rows) {
    const bar = '█'.repeat(Math.round(Math.min(r.pct, 2) * 10)).padEnd(20);
    console.log(`   ${r.bucket.padEnd(14)} target ${String(r.target).padStart(2)}  got ${r.got.toFixed(1).padStart(5)}  ${(r.pct * 100).toFixed(0).padStart(4)}%  ${bar}${r.waste > 0.5 ? ` waste ${r.waste.toFixed(1)}` : ''}`);
  }
  console.log(`   seats: ${per.map(p => `${p.name}(${p.nBuckets})`).join(', ')}\n`);
}
