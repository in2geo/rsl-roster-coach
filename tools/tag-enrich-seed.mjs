// tools/tag-enrich-seed.mjs — emits seeds/136_tag_enrichment.sql from champion_skills.skill_summary.
// Lands 4 capability gaps as status='proposed' (advisor-reviewed before approved, per CLAUDE.md).
// Rulings (Mike, 2026-07-15): Reset Cooldowns = ALLY-cooldown only; add new vocab tag Increase Debuff
// Duration. Uses champions.id (UUID) directly from the skill join — no name-resolution ambiguity.
// Run: node tools/tag-enrich-seed.mjs > seeds/136_tag_enrichment.sql
import fs from 'fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
async function all(p) { const out = []; let f = 0; for (;;) { const r = await (await fetch(`${BASE}/rest/v1/${p}`, { headers: { ...H, Range: `${f}-${f + 999}` } })).json(); if (!Array.isArray(r) || !r.length) break; out.push(...r); if (r.length < 1000) break; f += 1000; } return out; }
const norm = (s) => (s || '').toLowerCase();
const sentences = (txt) => (txt || '').split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean);

const TAGS = await rest('tags?select=id,name');
const tagId = Object.fromEntries(TAGS.map(t => [t.name, t.id]));
const skills = await all('champion_skills?select=champion_id,skill_summary');
const champs = await rest('champions?select=id,name,rarity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const info = {};
for (const c of champs) {
  const app = new Set((c.champion_tags ?? []).filter(x => x.status === 'approved').map(x => x.tags?.name));
  const prop = new Set((c.champion_tags ?? []).filter(x => x.status === 'proposed').map(x => x.tags?.name));
  info[c.id] = { name: c.name, rarity: c.rarity, app, prop };
}
const txt = {};
for (const s of skills) if (s.champion_id) (txt[s.champion_id] ??= []).push(s.skill_summary || '');

// ── per-target selection: return the matched sentence, or null to skip. Applies the policy filters. ──
const SELECT = {
  'Poison Explosion': (sen) => {
    const t = norm(sen);
    if (!/poison/.test(t)) return null;
    // detonation = instantly activate/trigger EXISTING poisons for burst. Exclude bomb-detonation that
    // merely PLACES poison, and single-tick "one 5% poison" (not a stacked-poison burst enabler).
    if (/\[bomb\]|detonation countdown/.test(t)) return null;
    if (/one .*5%? \[poison\]|one 5% \[poison\]/.test(t)) return null;
    if (/(instantly activat|instantly deal|activates all \[poison\]|detonat|explod)/.test(t)) return sen;
    return null;
  },
  'AoE Decrease Defense': (sen) => {
    const t = norm(sen);
    if (!/decreas\w*\s+def/.test(t)) return null;
    if (!/(all enemies|each enemy|every enemy)/.test(t)) return null;
    // must PLACE it (not merely react to it being present)
    if (/under \[?decrease def|if a .*decrease def.* is placed/.test(t) && !/plac\w+ a .*\[decrease def\]/.test(t)) return null;
    if (/plac\w+/.test(t)) return sen;
    return null;
  },
  'Reset Cooldowns': (sen) => {
    const t = norm(sen);
    if (!/(reduc\w*|decreas\w*|reset\w*|refresh)\w*[^.]*cooldown|cooldown[^.]*(reduc|reset|refresh)/.test(t)) return null;
    if (/increas\w*[^.]*cooldown|cannot be (decreased|reset)/.test(t)) return null;
    // ALLY-ONLY ruling: object of the reduction must be an ALLY's skill(s), NOT "this Champion's".
    const mentionsAlly = /\ball(y|ies)\b|target( ally)?['’]s? skills|revived ally|their skills/.test(t);
    const selfObject = /(cooldowns? (on|of) )?this champion['’]?s? skills|cooldown of this skill|this skill['’]?s? cooldown|resets the cooldown of (the )?\[?[a-z' ]+\]? skill/.test(t);
    // keep only if it clearly targets an ally and is not purely a self-skill reset
    if (mentionsAlly && !/this champion['’]?s? skills/.test(t)) return sen;
    return null;
  },
  'Increase Debuff Duration': (sen) => {
    const t = norm(sen);
    // extend the duration of a DEBUFF (Poison/HP Burn/any debuff) on enemies. Exclude: removing duration
    // (heal scaling), immutability clauses, and buff-duration (that's not a debuff).
    if (/removed from the duration|cannot be (removed|transferred|spread|.*increased)|decreas\w* the duration of a buff/.test(t)) return null;
    if (/(increas\w*|extend\w*)[^.]*duration[^.]*(debuff|\[poison\]|\[hp burn\]|\[hex\])/.test(t)) return sen;
    if (/duration of (all |any |a |two |[0-9]+ )?(random )?(enemy )?debuff/.test(t) && /(increas|extend)/.test(t)) return sen;
    return null;
  },
};

// hand-verified exclusions (matched by keyword but the "ally" mention is only a trigger condition —
// the reduced cooldown is the champion's OWN skill; fails the ALLY-only ruling).
const EXCLUDE = { 'Reset Cooldowns': new Set(['Iudex Artor', 'Tribune Herakletes', 'Vulkanos']) };

const rows = [];
const report = {};
for (const [tname, sel] of Object.entries(SELECT)) {
  report[tname] = [];
  const tid = tagId[tname];
  const skip = EXCLUDE[tname] || new Set();
  for (const [cid, texts] of Object.entries(txt)) {
    const c = info[cid]; if (!c) continue;
    if (c.app.has(tname) || c.prop.has(tname)) continue; // already tagged/proposed
    if (skip.has(c.name)) continue;
    let hit = null;
    for (const tx of texts) { for (const sen of sentences(tx)) { if (sel(sen)) { hit = sel(sen); break; } } if (hit) break; }
    if (!hit) continue;
    report[tname].push(c.name);
    const note = hit.replace(/\s+/g, ' ').replace(/'/g, "''").slice(0, 220);
    rows.push(`  ('${cid}','${tid}','proposed','human_observation','${note}','tag-enrich-2026-07-15',now(),0,'unknown',null,null)`);
  }
}

// ── emit SQL ──
const isNew = !tagId['Increase Debuff Duration'];
let out = `-- ============================================================================
-- 136 - Tag enrichment from champion_skills.skill_summary (2026-07-15). Fills 4
-- capability gaps the 5 content solvers exposed. Landed status='proposed' for
-- advisor review (CLAUDE.md tag source-of-truth). Rulings (Mike 2026-07-15):
--   • Reset Cooldowns = ALLY-cooldown reducers ONLY (self-on-kill resets excluded
--     as personal DPS perks, not team utility).
--   • Increase Debuff Duration = NEW vocab tag (extends DoT/debuff uptime → boosts
--     DoT-team total damage; distinct from policy #11 which rejects tagging the
--     EXTENDED debuff itself as a placement — this tags the extension CAPABILITY).
--   • Poison Explosion: 0 → populated (was unblocking Spider strategy C).
--   • AoE Decrease Defense: coverage fill (5 → +candidates).
-- champion_id join keys are champions.id UUIDs (no name-resolution ambiguity).
-- ============================================================================
`;
if (isNew) out += `insert into tags (name, description, is_debuff, bypasses_accuracy_check) values
  ('Increase Debuff Duration','Extends the remaining duration of debuffs (Poison/HP Burn/any) on enemies. Boosts DoT-team total damage and debuff uptime. Not a placement of the extended debuff (policy #11).', true, false)
on conflict (name) do nothing;

`;
out += `insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at,
   ascension_required, target_type, approved_by, approved_at)
values
`;
// re-resolve Increase Debuff Duration id via subselect since it may not exist at generation time
out += rows.join(',\n') + `\non conflict (champion_id, tag_id) do nothing;\n`;

// if the new tag's id was unknown at gen time, its rows used 'undefined' — guard against that
if (isNew) {
  // rewrite: for Increase Debuff Duration rows, use a subselect for tag_id
  out = out.replace(/'undefined'/g, "(select id from tags where name='Increase Debuff Duration')");
}

fs.writeFileSync('seeds/136_tag_enrichment.sql', out);
console.error('WROTE seeds/136_tag_enrichment.sql');
for (const [t, names] of Object.entries(report)) console.error(`  ${t}: ${names.length}  [${names.join(', ')}]`);
console.error(`  TOTAL rows: ${rows.length}${isNew ? '  (+1 new vocab tag)' : ''}`);
