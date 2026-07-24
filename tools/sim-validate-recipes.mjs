// tools/sim-validate-recipes.mjs — the IMPORT-PIPELINE VALIDATOR (design-doc steps 3–6).
//
//   step 3  validate required parameters BY OPERATION TYPE          (lib/sim/operations.js)
//   step 4  compare the structured recipe BACK AGAINST THE SOURCE   (both directions, below)
//             · omission:    every source clause ([bracket]/keyword) is accounted for in an action OR `deferred`
//             · fabrication: every recipe effect type traces to a word/bracket in the source
//   step 5  mark ambiguous / incomplete skills  →  REVIEW REQUIRED
//   step 6  promote only complete, accounted skills  →  EXECUTABLE  (accounted-but-deferred = PARTIAL)
//
// The step-4 tokenizer is the bracket-scraper used as a COVERAGE GUARD, not a tag GENERATOR — it only asks
// "did we notice every clause?", it never decides what a clause means. It fails LOUDLY on the current gaps
// (e.g. Bambus A3 has no recipe). Source of truth = live DB skill_summary. Run:
//   node --env-file=.env.local tools/sim-validate-recipes.mjs

import { RECIPES, FORMULAS, CONDITIONS } from '../lib/sim/recipes.js';
import { validateAction, isImplemented } from '../lib/sim/operations.js';

if (!process.env.SUPABASE_URL) { console.log('\n⏳ step 4 needs the DB. Run: node --env-file=.env.local tools/sim-validate-recipes.mjs\n'); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const HDR = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: HDR })).json();

// bracket-name ↔ engine-name aliases (so [Decrease DEF] and 'Decrease Defense' match either way)
const ALIASES = [['decrease def', 'decrease defense'], ['decrease atk', 'decrease attack'], ['decrease spd', 'decrease speed']];
const forms = (s) => { const t = s.toLowerCase().trim(); const out = new Set([t]); for (const [a, b] of ALIASES) { if (t === a) out.add(b); if (t === b) out.add(a); } return [...out]; };

// key action keywords: [ source-regex, label, coverage-regex ]. A source clause is accounted if its
// coverage-regex matches the recipe's coverage text (op names + effect types + deferred notes) — matched by
// CONCEPT, not exact phrase, so "steal all buffs" in a deferred note satisfies the «steal buffs» clause.
const KEYWORDS = [
  [/attacks?\b/i, 'attack', /deal_damage|attack/],
  [/revives?\b/i, 'revive', /reviv/],
  [/heals?\b/i, 'heal', /heal/],
  [/steals? (all )?buffs?/i, 'steal buffs', /steal/],
  [/transfer/i, 'transfer', /transfer/],
  [/instantly activates/i, 'activate', /activat/],
  [/turn meter/i, 'turn meter', /turn.?meter/],
  [/counterattack/i, 'counterattack', /counter/],
  [/extra turn/i, 'extra turn', /extra turn/],
  [/increases? the duration|decreas\w+ the duration/i, 'change duration', /duration/],
];

const isPassive = (r) => /passive/i.test(String(r.slot || '')) || /\[P\]\s*$/.test(String(r.skill_name || '').trim());

// build the recipe's "coverage text" — everything we can claim we accounted for
function coverageText(rec) {
  if (!rec) return '';
  const parts = [rec.name || ''];
  // an effect's placement type PLUS the debuffs it CONDITIONS on (unresistable-if / chance-if-caster-under):
  // those source brackets are prerequisites the recipe now handles in data, not placements — but they must
  // still count as accounted so the source's [HP Burn]/[Decrease DEF] conditions don't read as unaccounted.
  const pushEffect = (ef) => {
    if (!ef) return;
    if (ef.type) parts.push(ef.type);
    if (ef.unresistableIfTargetUnder) parts.push(ef.unresistableIfTargetUnder);
    if (ef.chanceIfCasterUnder?.debuff) parts.push(ef.chanceIfCasterUnder.debuff);
  };
  for (const a of rec.actions || []) {
    parts.push(a.op);
    if (a.op === 'DEAL_DAMAGE') parts.push('attack damage');
    pushEffect(a.effect);
  }
  // passive TRIGGERS (event → response actions) and continuous MODIFIERS carry the card's clauses too
  for (const tr of rec.triggers || []) {
    parts.push(tr.on || '');
    for (const a of tr.actions || []) { parts.push(a.op); pushEffect(a.effect); }
    if (tr.when?.arg) parts.push(tr.when.arg);
  }
  for (const m of rec.modifiers || []) { parts.push('damage reduction ' + (m.kind || '')); if (m.when?.arg) parts.push(m.when.arg); }
  for (const im of rec.immune || []) parts.push('immune ' + im);   // passive immunities
  parts.push(...(rec.deferred || []));
  return parts.join(' | ').toLowerCase();
}

// structural labels, not effects — never a placement to account for
const IGNORE_BRACKETS = new Set(['active effect', 'passive effect']);
function checkCoverage(rec, source) {
  const cov = coverageText(rec);
  const brackets = [...new Set([...source.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]))].filter((b) => !IGNORE_BRACKETS.has(b.toLowerCase()));
  const unaccounted = [];
  for (const b of brackets) if (!forms(b).some((f) => cov.includes(f))) unaccounted.push(`[${b}]`);
  for (const [re, tok, covRe] of KEYWORDS) if (re.test(source) && !covRe.test(cov)) unaccounted.push(`«${tok}»`);
  // fabrication: every authored effect.type must appear in the source
  const fabricated = [];
  for (const a of rec?.actions || []) if (a.effect?.type && !forms(a.effect.type).some((f) => source.toLowerCase().includes(f))) fabricated.push(a.effect.type);
  return { unaccounted, fabricated };
}

async function main() {
  const champs = ['Bambus', 'Ezio', 'Pelops', 'Tagoar', 'Vergis'];
  const rows = [];
  for (const q of champs) {
    const cs = await rest(`champions?game_id=eq.raid_shadow_legends&name=ilike.*${q}*&select=id,name`);
    const c = cs.find((x) => x.name.split(' ')[0].toLowerCase() === q.toLowerCase()) || cs[0];
    if (!c) continue;
    const sk = await rest(`champion_skills?champion_id=eq.${c.id}&select=slot,skill_name,skill_summary&order=slot`);
    for (const s of sk) rows.push({ champ: q, ...s });
  }

  let executable = 0, partial = 0, review = 0, deferredPassive = 0;
  console.log('\n══ RECIPE VALIDATOR — pipeline steps 3–6 (against live DB source) ══\n');
  for (const s of rows) {
    const key = `${s.champ.toUpperCase()}-${String(s.slot).toUpperCase()}`;
    const rec = RECIPES[key];
    const src = s.skill_summary || '';
    const reasons = [];

    if (!rec) {
      if (isPassive(s)) { deferredPassive++; console.log(`  ⏸ DEFERRED   ${key.padEnd(11)} ${s.skill_name?.slice(0, 20).padEnd(20)} passive → II-D (no recipe expected yet)`); continue; }
      review++; console.log(`  ✗ REVIEW     ${key.padEnd(11)} ${String(s.skill_name).slice(0, 20).padEnd(20)} NO RECIPE — active skill not authored`);
      // still show what it contains, so the gap is legible
      const cov = checkCoverage(null, src);
      if (cov.unaccounted.length) console.log(`                 source clauses: ${cov.unaccounted.join(' ')}`);
      continue;
    }

    // step 3 — params by op type
    for (const a of rec.actions || []) {
      const v = validateAction(a, { FORMULAS, CONDITIONS });
      if (!v.ok) reasons.push(`params[${a.op}]: ${v.missing.join(', ')}`);
      if (!v.implemented) reasons.push(`op '${a.op}' not implemented`);
    }
    // step 4 — coverage vs source
    const { unaccounted, fabricated } = checkCoverage(rec, src);
    if (unaccounted.length) reasons.push(`unaccounted: ${unaccounted.join(' ')}`);
    if (fabricated.length) reasons.push(`NOT IN SOURCE: ${fabricated.join(', ')}`);

    // step 5/6 — status
    const deferredN = (rec.deferred || []).length;
    if (reasons.length) { review++; console.log(`  ✗ REVIEW     ${key.padEnd(11)} ${String(rec.name).slice(0, 20).padEnd(20)} ${reasons.join(' · ')}`); }
    else if (deferredN) { partial++; console.log(`  ~ PARTIAL    ${key.padEnd(11)} ${String(rec.name).slice(0, 20).padEnd(20)} accounted; ${deferredN} clause(s) deferred`); }
    else { executable++; console.log(`  ✓ EXECUTABLE ${key.padEnd(11)} ${String(rec.name).slice(0, 20).padEnd(20)} complete`); }
  }

  console.log(`\n══ ${executable} EXECUTABLE · ${partial} PARTIAL (accounted, deferred) · ${review} REVIEW REQUIRED · ${deferredPassive} passive-deferred ══`);
  console.log('   Step 3 (params) + Step 4 (source coverage, both directions) + Step 5/6 (status) enforced.\n');
  process.exit(review ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
