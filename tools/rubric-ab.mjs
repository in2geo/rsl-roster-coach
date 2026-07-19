// tools/rubric-ab.mjs — A/B TWO CRITERIA SETS against each other on the SAME captured battles,
// through the SAME clear-vs-wipe harness, varying ONLY the rubric. Read-only. SHADOW.
//
// WHY THIS EXISTS (Mike, 2026-07-19): several rounds of modelling produced DIFFERENT criteria per
// dungeon, and they are deliberately kept SEPARATE rather than merged so they can be tested against
// each other later. See `knowledge/MODEL_REGISTRY.md` for what generations exist per content.
//
// Currently wired: DRAGON rubric vs the generic CB rubric on Dragon captures — i.e. "did the
// Dragon-specific rulings (crowd_control bucket, poison_management, Decrease Speed -> CC, empty
// dead-list) actually beat just reusing CB's?"
//
// RESULT HISTORY — read both, the reversal is the lesson:
//   • 2026-07-19 morning: BOTH 14/15; CB showed the LARGER mean separation (9.6 vs 5.8), i.e. the
//     Dragon-specific work looked worthless. **That run was invalid.** `cfg.accFloor` was being
//     discarded (bucket-score.mjs bug, fixed same day), so Dragon was scored at CLAN BOSS's floor of
//     150 instead of its own 130 — both arms ran on the same wrong input.
//   • 2026-07-19 after the fix: BOTH 14/19, but mean separation DRAGON +0.5 vs CB_generic **-1.0**.
//     Negative = in at least one group the best WIPE outscores the worst CLEAR. Dragon now separates
//     and the generic rubric does not.
// Margins are tiny and n is small — directional, not decisive.
//
// THE BINDING LIMIT IS DATA, not the harness: only a couple of groups in the whole log have BOTH a
// win and a loss, so rubrics that both handle those cannot be told apart. Losses are the scarce
// resource — a stage you sometimes lose is worth more than a dozen comfortable clears.
//
// To compare a different pair, edit CFGS below. Mirrors tools/shadow-grade-clears.mjs exactly except
// that it scores each team under BOTH configs.
//
// Run: node --env-file=.env.local tools/rubric-ab.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = p => import(pathToFileURL(`${REPO}/${p}`).href);
const { buildUserChampions } = await imp('lib/gestal-context.js');
const { mapRoster } = await imp('lib/match-engine.js');
const { scoreTeam, ALLOCATION, BUCKETS, DEAD_ON_CB } = await imp('tools/bucket-score.mjs');
const { DRAGON_ALLOCATION, DRAGON_BUCKETS, DEAD_ON_DRAGON } = await imp('lib/dragon-rubric.js');

const CFGS = {
  DRAGON: { allocation: DRAGON_ALLOCATION, buckets: DRAGON_BUCKETS, dead: DEAD_ON_DRAGON, accFloor: 130 },
  CB_generic: { allocation: ALLOCATION, buckets: BUCKETS, dead: DEAD_ON_CB, accFloor: 130 },
};

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check))';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let sk = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; sk = sk.concat(d); if (d.length < 1000) break; }
const skillsByName = {};
for (const r of sk) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

const rosters = {};
for (const f of fs.readdirSync(`${REPO}/gestal-sync/output`).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const s = JSON.parse(fs.readFileSync(`${REPO}/gestal-sync/output/${f}`, 'utf8'));
  if (!s.accountId) continue;
  const { userChampions } = buildUserChampions(s.champions ?? [], db);
  rosters[s.accountId] = Object.fromEntries(mapRoster(userChampions, {}).mapped.map(c => [c.name, c]));
}

const log = JSON.parse(fs.readFileSync(`${REPO}/gestal-sync/RslBattleReader/output/battle-log.json`, 'utf8'));
const arr = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const groups = {};
for (const b of arr) {
  if (b.dungeon !== "Dragon's Lair" || (b.heroes ?? []).length !== 5) continue;
  (groups[`${b.displayName} · stage ${b.stageNumber}`] ??= []).push(b);
}

const results = {};
for (const name of Object.keys(CFGS)) results[name] = { ok: 0, tot: 0, gaps: [] };

for (const [key, rs] of Object.entries(groups)) {
  const roster = rosters[rs[0].accountId]; if (!roster) continue;
  const teamKey = r => r.heroes.map(h => h.name).sort().join(', ');
  console.log(`── ${key}`);
  for (const [name, cfg] of Object.entries(CFGS)) {
    const score = r => { const t = r.heroes.map(h => roster[h.name]).filter(Boolean); return t.length < 5 ? null : scoreTeam(t, tagMeta, skillsByName, cfg).grade; };
    const W = new Map(), L = new Map();
    for (const r of rs) { const g = score(r); if (g == null) continue; (r.result === 'Victory' ? W : L).set(teamKey(r), g); }
    if (!W.size || !L.size) { console.log(`   ${name.padEnd(11)} — no W/L pair`); continue; }
    let a = 0, t = 0;
    for (const [wn, wg] of W) for (const [ln, lg] of L) { if (wn === ln) continue; t++; if (wg > lg) a++; }
    const loW = Math.min(...W.values()), hiL = Math.max(...L.values());
    results[name].ok += a; results[name].tot += t;
    if (t) results[name].gaps.push(loW - hiL);
    console.log(`   ${name.padEnd(11)} ${a}/${t}   clears ${Math.min(...W.values()).toFixed(1)}-${Math.max(...W.values()).toFixed(1)}  ·  wipes ${Math.min(...L.values()).toFixed(1)}-${hiL.toFixed(1)}  ·  margin ${(loW - hiL).toFixed(1)}`);
  }
  console.log();
}

console.log('══ RESULT ══');
for (const [name, r] of Object.entries(results)) {
  const avg = r.gaps.length ? (r.gaps.reduce((a, b) => a + b, 0) / r.gaps.length) : NaN;
  console.log(`${name.padEnd(11)} ${r.ok}/${r.tot} (${r.tot ? ((r.ok / r.tot) * 100).toFixed(0) : '—'}%)   mean separation (worst clear − best wipe): ${avg.toFixed(1)}`);
}
console.log('\nPositive separation = every clear scored above every wipe in that group.');
