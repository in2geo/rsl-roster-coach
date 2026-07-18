// tools/shadow-cb.mjs — SHADOW run of the team-constructor for CLAN BOSS, using the refined CB
// needs (lib/cb-shadow-goals.js) instead of the old DB goals. Analogue of shadow-construct.mjs but
// for CB (single-phase, difficulty axis, hand-defined needs). Runs every Gestal account, prints the
// constructed team + need coverage, and checks GuapoDonni against the "obvious team" anchor.
//
// SHADOW ONLY — does not touch the live DB or the live recommendation. Read-only.
// Run: node --env-file=.env.local tools/shadow-cb.mjs [Difficulty]   (default Nightmare)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { deriveNeeds, constructTeam } from '../lib/team-constructor.js';
import { buildUserChampions } from '../lib/gestal-context.js';
import { mapRoster, usabilityTier } from '../lib/match-engine.js';
import { attachDamageScores } from '../lib/multiplier-rank.js';
import { CB_NEEDS, CB_ACC_FLOOR } from '../lib/cb-shadow-goals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const DIFFICULTY = process.argv[2] || 'Nightmare';
const ACC_FLOOR = CB_ACC_FLOOR[DIFFICULTY] ?? 170;

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const supabase = createClient(BASE, process.env.SUPABASE_SERVICE_KEY);

// catalog: tags + auras + meta
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,ascension_required,tags(name,is_debuff,bypasses_accuracy_check)),champion_auras(aura_type,aura_value,aura_area)';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
const auraByName = new Map(db.map(c => [c.name, c.champion_auras || []]));
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

const isBuilt = c => usabilityTier(c) >= 2;

// CB QUALITY tiebreaker (Side 2): breaks redundant-coverage ties toward the better-built champ.
// DEVELOPMENT is primary — a maxed champ should beat an under-built one on level/gear/stars ALONE
// (Duchess L60/endgame vs an L34/starter is not close). Masteries are a real but SECONDARY CB
// signal (a bonus among comparably-built champs), NOT the decider. Tiebreaker scale so it never
// overrides fresh coverage. has_boss_mastery comes from mapRoster. CB_MAST_W=0 proves dev-only.
const GEARW = { starter: 1, fair: 2, good: 3, endgame: 4 };
const MAST_W = process.env.CB_MAST_W != null ? Number(process.env.CB_MAST_W) : 0.10;
const cbQuality = (c) =>
  0.30 * (usabilityTier(c) / 3) +                 // built-ness
  0.25 * ((GEARW[c.gear_tier] ?? 1) / 4) +        // gear — the clearest built-vs-fodder signal
  0.10 * Math.min(1, (c.level ?? 0) / 60) +
  MAST_W * (c.has_boss_mastery ? 1 : 0);          // masteries: secondary CB bonus, not the decider

// Synergy weight (Side 2): credit a candidate for combos they complete with the already-seated.
// CB_SYN_W=0 reproduces the pre-synergy selection exactly, for A/B.
const SYN_W = process.env.CB_SYN_W != null ? Number(process.env.CB_SYN_W) : 0;

const ANCHOR = { GuapoDonni: ['Ezio Auditore', 'Xenomorph', 'Duchess Lilitu', 'Donatello', 'Michelangelo'] };

const outDir = path.join(REPO, 'gestal-sync/output');
const files = fs.readdirSync(outDir).filter(f => f.endsWith('.json') && !/^gear-corpus/.test(f));

console.log(`══ CB SHADOW (refined goals) — difficulty ${DIFFICULTY}, ACC floor ${ACC_FLOOR} ══`);
console.log(`needs: ${CB_NEEDS.map(n => n.role).join(', ')}\n`);

for (const file of files) {
  const snap = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'));
  const acct = snap.displayName || file.replace(/_.*/, '');
  const { userChampions } = buildUserChampions(snap.champions ?? [], db);
  const mapped = mapRoster(userChampions, {}).mapped;
  try { await attachDamageScores(mapped, supabase); } catch {}
  for (const c of mapped) c.auras = auraByName.get(c.name) || [];

  const { team, leader, needCoverage } = constructTeam(mapped, CB_NEEDS, { contentKey: 'clan_boss', eligible: isBuilt, tagMeta, accFloor: ACC_FLOOR, qualityFn: cbQuality, synergyWeight: SYN_W });
  console.log(`── ${acct} ──`);
  console.log(`  TEAM: ${team.map(c => c.name).join(', ')}   (leader ${leader?.name ?? 'none'})`);
  const uncovered = needCoverage.filter(n => !n.covered_by.length).map(n => n.role);
  if (uncovered.length) console.log(`  uncovered: ${uncovered.join(', ')}`);
  const anchor = ANCHOR[acct];
  if (anchor) {
    const got = new Set(team.map(c => c.name));
    const hit = anchor.filter(n => got.has(n));
    console.log(`  ▶ ANCHOR ${hit.length}/5 — missing [${anchor.filter(n => !got.has(n)).join(', ') || 'none'}]`);
  }
  console.log('');
}
