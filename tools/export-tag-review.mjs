#!/usr/bin/env node
// Export a self-contained TAG REVIEW BUNDLE for an external reviewer (human or agent).
//
// WHY THIS EXISTS: a tag review needs the verbatim skill text, the current tags, and the
// policies. It does NOT need database access. Handing out SUPABASE_POOLER_URL grants
// superuser write/delete on every table for a read-only job, and .env.local also holds an
// ANTHROPIC_API_KEY and a VERCEL_OIDC_TOKEN. This exports the data instead — no credentials
// leave the machine, and the reviewer gets a deterministic snapshot with no round-trips and
// no exposure to the PostgREST 1000-row cap.
//
// USAGE:
//   node --env-file=.env.local tools/export-tag-review.mjs [outdir]
//
// EMITS (default ./output/tag-review/):
//   champions.json    one object per Rare+ champion: identity + verbatim skills + current tags
//   vocabulary.json   the tag vocabulary
//   POLICIES.md       the Tag Review Policies, copied verbatim from CLAUDE.md
//   README.md         what to do with it, and how to hand findings back
//
// The reviewer returns FINDINGS (champion, tag, verdict, the verbatim clause that justifies
// it). Those become a seed. Nothing here can write to the DB — by design.
import fs from 'fs';
import path from 'path';

const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
if (!base || !key) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing (use --env-file=.env.local)'); process.exit(1); }
const H = { apikey: key, Authorization: `Bearer ${key}` };
const outdir = process.argv[2] || 'output/tag-review';

async function getAll(p) {   // PostgREST caps at 1000/response regardless of Range — MUST page.
  let o = [], f = 0;
  for (;;) {
    const r = await fetch(`${base}/rest/v1/${p}`, { headers: { ...H, Range: `${f}-${f + 999}` } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const b = await r.json(); o = o.concat(b);
    if (b.length < 1000) break; f += 1000;
  }
  return o;
}

console.log('Pulling…');
const champs  = await getAll('champions?game_id=eq.raid_shadow_legends&select=id,name,rarity,faction,affinity,role&order=name');
const skills  = await getAll('champion_skills?select=champion_id,slot,skill_name,skill_summary,cooldown_base,ascension_required&order=champion_id');
const auras   = await getAll('champion_auras?select=champion_id,aura_type,aura_value,aura_area,aura_restriction,aura_summary');
const tags    = await getAll('champion_tags?select=champion_id,tag_id,status,source_type,source_note');
const vocab   = await getAll('tags?select=id,name,description');
const aliases = await getAll('champion_aliases?select=champion_id,alias,source');
const tagName = new Map(vocab.map(t => [t.id, t.name]));

const idx = (rows, k='champion_id') => rows.reduce((m,r)=>{(m[r[k]] ||= []).push(r); return m;},{});
const S = idx(skills), A = idx(auras), T = idx(tags), AL = idx(aliases);

const OUT_OF_SCOPE = ['Common','Uncommon'];   // Rare+ only, per CLAUDE.md
const bundle = champs.filter(c => !OUT_OF_SCOPE.includes(c.rarity)).map(c => ({
  name: c.name,
  rarity: c.rarity, faction: c.faction, affinity: c.affinity, role: c.role,
  aliases: (AL[c.id]||[]).map(a => a.alias),
  skills: (S[c.id]||[]).sort((a,b)=>String(a.slot).localeCompare(String(b.slot))).map(s => ({
    slot: s.slot, name: s.skill_name,
    text: s.skill_summary,            // VERBATIM Plarium text — this is the ground truth
    cooldown: s.cooldown_base, ascension_required: s.ascension_required,
  })),
  aura: (A[c.id]||[]).map(a => ({
    type: a.aura_type, value: a.aura_value, area: a.aura_area,
    restriction: a.aura_restriction, summary: a.aura_summary,
  })),
  current_tags: (T[c.id]||[]).map(t => ({
    tag: tagName.get(t.tag_id), status: t.status, source_type: t.source_type, note: t.source_note,
  })).filter(t => t.tag),
}));

fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(path.join(outdir,'champions.json'), JSON.stringify(bundle, null, 2));
fs.writeFileSync(path.join(outdir,'vocabulary.json'), JSON.stringify(vocab.map(v=>({name:v.name,description:v.description})), null, 2));

// Copy the Tag Review Policies verbatim out of CLAUDE.md — they ARE the review criteria.
const claude = fs.readFileSync('CLAUDE.md','utf8');
const start = claude.indexOf('## Tag Review Policies');
const end   = claude.indexOf('## Reasoning discipline', start);
if (start < 0 || end < 0) throw new Error('Could not locate the Tag Review Policies section in CLAUDE.md — do not ship a bundle without it.');
fs.writeFileSync(path.join(outdir,'POLICIES.md'), claude.slice(start, end).trim() + '\n');

const withText = bundle.filter(c => c.skills.some(s => s.text)).length;
fs.writeFileSync(path.join(outdir,'README.md'), `# Tag review bundle

Snapshot: ${new Date().toISOString().slice(0,10)}. Read-only. Nothing here can write to the database.

| file | what |
|---|---|
| \`champions.json\` | ${bundle.length} Rare+ champions: identity, aliases, VERBATIM skill text, aura, current tags |
| \`vocabulary.json\` | ${vocab.length} tags in the controlled vocabulary |
| \`POLICIES.md\` | the Tag Review Policies, verbatim from CLAUDE.md — **these are the review criteria** |

## The job

For each champion, decide whether \`current_tags\` is what \`skills[].text\` actually supports,
per \`POLICIES.md\`. **\`skills[].text\` is verbatim Plarium text and is the ground truth.**
Judge against the text, never against a tier list, a guide, or prior belief.

${bundle.length - withText} of ${bundle.length} champions have NO skill text — they cannot be
reviewed. Report them as \`no_evidence\`; do not infer tags for them.

## Rules that catch most errors

The recurring failure is a bracket scraper mistaking a NON-PLACEMENT clause for a placement.
A \`[Bracket]\` is NOT a placement when it sits after:
- **ignore** — "ignores [Shield] buffs" (policy #16)
- **remove / strip / steal** — "removes all [Increase DEF]" earns *Buff Strip*, not Increase DEF (#19)
- **instantly activates** — forcing an existing [Poison] to tick early is *Debuff Activation* (#12)
- **immune to** (#10), **increases the duration of** (#11), **transfers/redirects** (#13), **except** (#14)
- **a self-condition** — "while this Champion is under a [Veil] buff" is a PREREQUISITE she must
  receive from elsewhere, not a buff she places. (Proposed policy #20, 2026-07-17 — 7 known
  instances; see \`seeds/166_*_PROPOSED.sql\`.)

Distinctions that are load-bearing:
- **[Veil] ≠ [Perfect Veil]** — different buffs, both in the vocabulary. Three champions place
  Perfect Veil and were wrongly tagged Veil off a condition clause.
- **#17 vs #20** — "this debuff cannot be resisted if this Champion is under [Veil]" → the DEBUFF
  is still placed, so tag it (#17 APPROVE). But [Veil] itself is not hers (#20 REJECT). Both
  halves of one sentence.
- **Self-combo (#1 exception)** — if the SAME champion places the prerequisite debuff herself,
  she delivers the chain unaided → APPROVE (Frozen Banshee, Coldheart).

## Handing findings back

Return a list, not SQL:

\`\`\`json
[{ "champion": "Rhaia", "tag": "Veil", "verdict": "reject",
   "policy": "#20",
   "evidence": "<the VERBATIM clause from skills[].text that decides it>",
   "confidence": "high" }]
\`\`\`

\`verdict\`: \`keep\` | \`reject\` | \`add\` | \`no_evidence\` | \`unsure\`.
**\`evidence\` must be a verbatim quote from \`skills[].text\`.** A finding without one will not be
actioned — that is the rule that keeps this reviewable.

Findings become a committed \`seeds/*.sql\` file and are human-approved before going live
(CLAUDE.md: "No auto-merge"). Flag anything ambiguous as \`unsure\` rather than guessing; being
wrong is more expensive than being uncertain.
`);

console.log(`\nWrote ${outdir}/`);
console.log(`  champions.json   ${bundle.length} Rare+ champions (${withText} with skill text, ${bundle.length-withText} without)`);
console.log(`  vocabulary.json  ${vocab.length} tags`);
console.log(`  POLICIES.md      Tag Review Policies (verbatim from CLAUDE.md)`);
console.log(`  README.md        the brief + how to hand findings back`);
const totalTags = bundle.reduce((n,c)=>n+c.current_tags.length,0);
console.log(`\n  ${totalTags} champion_tags rows included.`);
console.log('\nNo credentials in the bundle. Hand over the folder, not .env.local.');
