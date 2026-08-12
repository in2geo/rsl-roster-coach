// tools/recipe-authoring-integrate.mjs — STEP B.3 of the recipe-authoring loop (see
// knowledge/RECIPE_AUTHORING_RUNBOOK.md). Turns an agent-authoring workflow's `drafts` array into
// committed recipe CODE: recomputes keys via champKey, drops null-multiplier DEAL_DAMAGE, keeps only
// supported trigger events, then CRLF-safely patches the FORMULAS + RECIPES blocks into
// lib/sim/recipes.js. Idempotent: skips any recipe key that already exists.
//
// Usage:
//   node tools/recipe-authoring-integrate.mjs <drafts.json> [--dry-run]
// <drafts.json> is the workflow result's `drafts` array (save it from the task output; see the
// runbook). --dry-run prints the report + writes nothing.
import fs from 'fs';
import { RECIPES, FORMULAS, champKey } from '../lib/sim/recipes.js';

const DRAFTS = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!DRAFTS || DRAFTS.startsWith('--')) { console.error('Usage: node tools/recipe-authoring-integrate.mjs <drafts.json> [--dry-run]'); process.exit(1); }

const SUPPORTED_TRIG = new Set(['attacked', 'hit_taken', 'hp_below', 'start_of_turn', 'round_start', 'ally_death', 'enemy_frozen']);
const isDamageless = (f) => (f.multiplier == null && f.maxHpPct == null && !(f.terms && f.terms.length));

let drafts = JSON.parse(fs.readFileSync(DRAFTS, 'utf8'));
if (drafts && drafts.result && Array.isArray(drafts.result.drafts)) drafts = drafts.result.drafts;   // accept the raw task output too
if (!Array.isArray(drafts)) { console.error('drafts file must be an array of champion drafts (or a task-output object with result.drafts)'); process.exit(1); }

const existing = new Set(Object.keys(RECIPES));
const existingF = new Set(Object.keys(FORMULAS));
const formulasOut = [], recipesOut = [], report = [];
let skipped = 0;
for (const c of drafts) {
  const prefix = champKey(c.champion);
  const skipF = new Set(); const fLines = [];
  for (const f of (c.formulas || [])) {
    if (isDamageless(f)) { skipF.add(f.id); continue; }
    if (existingF.has(f.id)) continue;   // idempotent: never re-emit an existing formula
    const { id, note, flags, ...rest } = f;
    fLines.push(`  ${id}: { ${Object.entries(rest).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}, flags: { ...DMG_FLAGS } },`);
  }
  const rLines = []; const dropped = [];
  for (const r of (c.recipes || [])) {
    const key = `${prefix}-${String(r.slot).toUpperCase()}`;
    if (existing.has(key)) { skipped++; continue; }   // idempotent: never double-insert
    let actions = (r.actions || []).filter((a) => !(a.op === 'DEAL_DAMAGE' && skipF.has(a.formulaId)));
    const deferred = [...(r.deferred || [])];
    if ((r.actions || []).length !== actions.length) deferred.push('damage multiplier not in DB — DEAL_DAMAGE omitted');
    const triggers = (r.triggers || []).filter((t) => SUPPORTED_TRIG.has(t.on));
    for (const t of (r.triggers || [])) if (!SUPPORTED_TRIG.has(t.on)) { dropped.push(`${key}:${t.on}`); deferred.push(`reactive trigger on "${t.on}" — event not built`); }
    const obj = { champion: c.champion, slot: r.slot, name: r.name, type: r.type || 'active', cooldown: r.cooldown ?? null };
    if (actions.length) obj.actions = actions;
    if (triggers.length) obj.triggers = triggers;
    obj.covers = r.covers || []; obj.deferred = deferred;
    rLines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(obj)},`);
  }
  formulasOut.push(...fLines); recipesOut.push(...rLines);
  report.push(`  ${c.champion.padEnd(24)} key=${prefix.padEnd(12)} F:${fLines.length}/${(c.formulas || []).length} R:${rLines.length}${dropped.length ? ' dropTrig=' + dropped.join(',') : ''}`);
}

console.log('\n=== integration report ===');
console.log(report.join('\n'));
console.log(`\nTOTAL: ${formulasOut.length} formulas, ${recipesOut.length} recipes${skipped ? ` (${skipped} already-existing recipe keys skipped)` : ''}`);

if (DRY) { console.log('\n--dry-run: recipes.js NOT modified.'); process.exit(0); }
if (!recipesOut.length) { console.log('\nNothing new to insert. recipes.js unchanged.'); process.exit(0); }

let src = fs.readFileSync('lib/sim/recipes.js', 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const fBlock = formulasOut.join(nl), rBlock = recipesOut.join(nl);
const tag = new Date().toISOString().slice(0, 10);   // note: run under a normal node (Date is available here, unlike inside a Workflow script)
if (!/export const FORMULAS = \{\r?\n/.test(src) || !/export const RECIPES = \{\r?\n/.test(src)) { console.error('ANCHOR MISSING — recipes.js structure changed; patch manually.'); process.exit(1); }
src = src.replace(/export const FORMULAS = \{\r?\n/, (m) => `${m}  // batch (agent-authored ${tag})${nl}${fBlock}${nl}`);
src = src.replace(/export const RECIPES = \{\r?\n/, (m) => `${m}  // batch (agent-authored ${tag}; keys via champKey; damageless/unsupported-trigger deferred)${nl}${rBlock}${nl}`);
fs.writeFileSync('lib/sim/recipes.js', src);
console.log(`\n✓ Patched lib/sim/recipes.js (+${formulasOut.length} formulas, +${recipesOut.length} recipes).`);
console.log('Now run the validation ladder (RECIPE_AUTHORING_RUNBOOK.md §B.4): ops-consistency, model-golden, sim-selftest, sim-validate-recipes, recipe-authoring-smoke, sim-suite.');
