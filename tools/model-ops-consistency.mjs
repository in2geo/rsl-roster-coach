// tools/model-ops-consistency.mjs — P0 RUNG: one source of truth for operations.
//
// The Model had op status in 3+ hand-maintained places that drifted: the operations.js registry
// (`implemented` flags), the interpreter's actual dispatch (interpreter.OP_HANDLERS / IMPLEMENTED_OPS),
// and the recipes' `deferred[]` prose. This rung makes them reconcile or it FAILS — so an op added to the
// interpreter without updating the registry, or a `deferred[]` note claiming a now-built capability is
// "not built", is caught by a test instead of rotting silently. No DB needed.
//
// Blocks (exit 1) on ANY inconsistency. Wired into tools/model-qa.mjs.

import { OPERATIONS } from '../lib/sim/operations.js';
import { IMPLEMENTED_OPS } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

const failures = [];
const impl = new Set(IMPLEMENTED_OPS);                                   // what the interpreter can actually run
const registryImpl = new Set(Object.entries(OPERATIONS).filter(([, v]) => v.implemented === true).map(([k]) => k));

// 1. interpreter runs an op the registry does not mark implemented:true (registry under-reports capability).
for (const op of impl) if (!registryImpl.has(op)) failures.push(`interpreter runs '${op}' but operations.js does not mark it implemented:true (add/flip it)`);
// 2. registry claims implemented:true for an op the interpreter has no handler for (registry over-reports).
for (const op of registryImpl) if (!impl.has(op)) failures.push(`operations.js marks '${op}' implemented:true but the interpreter has no OP_HANDLER (remove the claim or build it)`);
// 3. a recipe action names an op the registry has never heard of (typo / fabricated op).
for (const [key, r] of Object.entries(RECIPES)) for (const a of (r.actions || [])) if (a.op && !(a.op in OPERATIONS)) failures.push(`recipe ${key} uses op '${a.op}' that is not in the operations.js registry`);
// 4. a `deferred[]` note claims a capability that NOW EXISTS is "not built" (stale backlog prose).
//    Catches "EXTRA_TURN op (not built)" once EXTRA_TURN is implemented, and "conditional placement (op not
//    built)" once conditional PLACE_DEBUFF is implemented. "op exists; not yet wired" is the honest form.
const namesBuiltOp = (s) => [...impl].some((op) => s.includes(op)) || (/conditional placement/i.test(s) && impl.has('PLACE_DEBUFF'));
for (const [key, r] of Object.entries(RECIPES)) for (const d of (r.deferred || [])) {
  if (/not built/i.test(d) && namesBuiltOp(d)) failures.push(`recipe ${key} deferred note is STALE (capability now exists): "${d}"`);
}

const pass = failures.length === 0;
console.log(`\nOP CONSISTENCY — interpreter ops: ${impl.size}, registry implemented: ${registryImpl.size}`);
if (pass) console.log('  ✓ registry ↔ interpreter ↔ deferred notes all agree');
else { console.log(`  ✗ ${failures.length} inconsistency(ies):`); for (const f of failures) console.log(`    - ${f}`); }
console.log('QA_JSON ' + JSON.stringify({ rung: 'ops-consistency', pass: pass ? 1 : 0, fail: failures.length, failures }));
process.exit(pass ? 0 : 1);
