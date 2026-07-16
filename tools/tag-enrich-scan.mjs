// tools/tag-enrich-scan.mjs — RESEARCH SCAN (read-only, writes nothing) for the 4 tag-enrichment
// gaps. For each target capability it: (1) pattern-matches champion_skills.skill_summary, (2) checks
// which matched champions already carry the tag, (3) prints the NEW candidates with the matched
// sentence so a human (LLM+advisor) can apply the Tag Review Policies. NO tags are written here.
// Run: node tools/tag-enrich-scan.mjs [poison-det|dur|cooldown|aoe-def|all]
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// paginate (REST caps at 1000 rows) — the exact bug that produced the false "HP Burn:0" alarm.
async function all(pathBase) {
  const out = []; let from = 0; const step = 1000;
  for (;;) {
    const rows = await (await fetch(`${BASE}/rest/v1/${pathBase}`, { headers: { ...H, Range: `${from}-${from + step - 1}` } })).json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows); if (rows.length < step) break; from += step;
  }
  return out;
}

const which = process.argv[2] || 'all';

// Each target: the tag name to check existing coverage against, and a matcher over a skill sentence.
const norm = (s) => (s || '').toLowerCase();
const TARGETS = {
  'poison-det': {
    tag: 'Poison Explosion',
    // "detonate"/"explode"/"activate/trigger" Poison(s) → %MAX-HP burst. Policy #12 (activates [X])
    // says a plain "activates [X] debuffs" is NOT a PLACEMENT of X — but DETONATION is its own
    // capability tag (deal instant damage from existing poisons), not a claim the champ PLACES poison.
    test: (t) => /poison/.test(t) && (
      /\b(detonat|explod)\w*/.test(t)
      || /(activat|trigger)\w*[^.]*poison/.test(t)
      || /poison[^.]*(instantly deal|deal[^.]*damage equal)/.test(t)
    ),
  },
  'dur': {
    tag: 'Increase Debuff Duration',
    // NOTE policy #11: "increases the duration of [X]" is REJECTED as a PLACEMENT of X. But an
    // "Increase Debuff Duration" CAPABILITY tag (extends the team's DoT/debuff uptime) is legitimate
    // and is what DoT teams want. Match duration-extension of debuffs (not of buffs).
    test: (t) => /(increas\w*|extend\w*)[^.]*\bduration\b[^.]*\bdebuff/.test(t)
      || /\bdebuff[^.]*\bduration[^.]*\b(increas|extend)/.test(t)
      || /increas\w*[^.]*duration of all[^.]*debuff/.test(t),
  },
  'cooldown': {
    tag: 'Reset Cooldowns',
    // reset OR reduce ally skill cooldowns (utility — re-fires nukes/debuffs faster). Exclude
    // "increase cooldown" (that's an ENEMY debuff = Increase Cooldowns/Block-cooldown family) and
    // "cannot be … cooldown".
    test: (t) => (/(reduc\w*|decreas\w*|reset\w*)[^.]*\bcooldown/.test(t) || /\bcooldown[^.]*\b(reduc|reset|refresh)/.test(t))
      && !/increas\w*[^.]*cooldown/.test(t),
  },
  'aoe-def': {
    tag: 'AoE Decrease Defense',
    // Decrease DEF on ALL enemies. Match Decrease DEF placement with an AoE marker in the same skill.
    test: (t) => /decreas\w*\s+def/.test(t)
      && /(all enemies|each enemy|every enemy|aoe)/.test(t),
  },
};

const VOCAB = new Set((await rest('tags?select=name')).map(t => t.name));
const skills = await all('champion_skills?select=champion_id,skill_summary');
const champs = await rest('champions?select=id,type_id,name,rarity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const byType = {};
for (const c of champs) {
  const tags = new Set((c.champion_tags ?? []).filter(ct => ct.status === 'approved').map(ct => ct.tags?.name).filter(Boolean));
  const propTags = new Set((c.champion_tags ?? []).filter(ct => ct.status === 'proposed').map(ct => ct.tags?.name).filter(Boolean));
  byType[c.id] = { name: c.name, rarity: c.rarity, tags, propTags };
}

// group skill text by champion (join on champions.id)
const textByType = {};
for (const s of skills) {
  if (s.champion_id == null) continue;
  (textByType[s.champion_id] ??= []).push(s.skill_summary || '');
}

const sentences = (txt) => txt.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean);

// per-target flags: mark sentences a policy would likely REJECT so a human doesn't have to eyeball all.
const flagFor = (key, s) => {
  if (key === 'dur') {
    if (/removed from the duration|cannot be (removed|.*increased)|decreas\w* the duration of a buff/.test(s)) return 'REJECT? removal/immutable/buff-duration — not a debuff-duration extension';
    if (/attempt\w* to place/.test(s)) return 'REVIEW trigger-list passive (context)';
  }
  if (key === 'cooldown') {
    if (/cannot be (decreased|reset)/.test(s)) return 'REJECT negation (cannot be reduced)';
    const ally = /ally|allies|all .* skills|target( ally)?/.test(s) && !/this skill|this champion.?s skills? by/.test(s);
    const selfKill = /this skill('|’)?s? cooldown|cooldown of this skill|cooldown of (the )?\[?[a-z ]+\]? skill/.test(s) && /kill/.test(s);
    if (/ally|allies/.test(s)) return 'ALLY-cooldown (team utility ✔)';
    if (selfKill) return 'SELF-on-kill (minor — own skill only)';
    return 'SELF/own-skill (minor)';
  }
  if (key === 'poison-det') {
    if (/\[bomb\][^.]*detonat[^.]*poison|detonat[^.]*places[^.]*poison/.test(s)) return 'REJECT bomb→places poison (placement, not detonation)';
  }
  return '';
};

for (const key of (which === 'all' ? Object.keys(TARGETS) : [which])) {
  const T = TARGETS[key];
  // baseline: total current population of this tag across ALL champs (not just text matches)
  let approvedPop = 0, proposedPop = 0;
  for (const c of Object.values(byType)) { if (c.tags.has(T.tag)) approvedPop++; if (c.propTags.has(T.tag)) proposedPop++; }
  const hits = [];
  for (const [tid, texts] of Object.entries(textByType)) {
    const c = byType[tid]; if (!c) continue;
    let matched = null;
    for (const txt of texts) { for (const sen of sentences(txt)) { if (T.test(norm(sen))) { matched = sen; break; } } if (matched) break; }
    if (matched) hits.push({ tid, name: c.name, rarity: c.rarity, has: c.tags.has(T.tag), prop: c.propTags.has(T.tag), sentence: matched, flag: flagFor(key, norm(matched)) });
  }
  const already = hits.filter(h => h.has).length;
  const fresh = hits.filter(h => !h.has && !h.prop);
  const rejects = fresh.filter(h => h.flag.startsWith('REJECT'));
  const clean = fresh.filter(h => !h.flag.startsWith('REJECT'));
  console.log(`\n${'='.repeat(92)}\n[${key}] tag="${T.tag}"  in-vocab=${(approvedPop + proposedPop) > 0 || VOCAB.has(T.tag) ? 'YES' : 'NO (new tag)'}`);
  console.log(`   current pop: ${approvedPop} approved / ${proposedPop} proposed   |   text matches: ${hits.length} (${already} already have it)`);
  console.log(`   NEW: ${clean.length} candidates + ${rejects.length} likely-reject\n${'='.repeat(92)}`);
  for (const h of clean.slice(0, 60)) {
    console.log(`  ${h.name} [${h.rarity}]${h.flag ? '  «' + h.flag + '»' : ''}`);
    console.log(`     "${h.sentence.replace(/\s+/g, ' ').slice(0, 165)}"`);
  }
  if (clean.length > 60) console.log(`  … +${clean.length - 60} more candidates`);
  if (rejects.length) { console.log(`  --- likely REJECT (${rejects.length}): ${rejects.map(h => h.name).join(', ')}`); }
}
