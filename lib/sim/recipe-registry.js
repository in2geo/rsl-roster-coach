// lib/sim/recipe-registry.js — a tiny, dependency-free registry that lets engine.js and interpreter.js share
// the ONE recipe dispatch without a static engine→interpreter import at module-eval time.
//
// Why it exists: engine.js needs the recipe engine (recipeFor||kitToRecipe→applyRecipe, defined in
// interpreter.js) so it can retire applySkill, but a direct engine→interpreter import at load would form a
// cycle whose registration ran during engine's dependency phase — before engine's own body initialised the
// holder — a temporal-dead-zone crash. This module has NO imports, so its body (the `_fn` holder) is fully
// evaluated before either engine.js or interpreter.js runs; interpreter registers into it at load, engine reads
// it at dispatch time. All cross-calls are at battle RUNTIME, long after both modules are loaded.
let _fn = null;
export function registerRecipeEngine(fn) { _fn = fn; }
export function dispatchViaRegistry(state, actor, skill) { return _fn ? _fn(state, actor, skill) : false; }
