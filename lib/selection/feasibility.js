// lib/selection/feasibility.js — Archetype Selector Stage 4: can this roster COMPLETE an archetype?
//
// A cheap necessary pre-check before team generation: for each of the archetype's hardRequirements,
// is there at least one roster champion whose capability profile meets the requirement (some `anyOf`
// capability at coverage ≥ minScore)? If every requirement has ≥1 candidate, the archetype is FEASIBLE
// and candidate generation (Stage 5) will try to fit the functions into 5 seats. If any requirement has
// zero candidates, the archetype is infeasible for this roster and we say WHICH function is missing.
//
// This is necessary, not sufficient: feasibility only proves each function is coverable SOMEWHERE in the
// roster, not that all functions fit within five champions — that is the team-validator's job.
//
// Output doubles as the candidate lists Stage 5 consumes (candidatesByReq), so we don't recompute.

/**
 * @param {Array<{name:string, profile:object}>} rosterProfiles  - champ name → capabilityProfile()
 * @param {object} archetype  - a spec from lib/archetypes/clan-boss.js
 * @returns {{ archetype:string, feasible:boolean, requirements:Array, missing:string[], candidatesByReq:object }}
 */
export function assessFeasibility(rosterProfiles, archetype) {
  const requirements = archetype.hardRequirements.map((req) => {
    const candidates = [];
    for (const c of rosterProfiles) {
      // Best (highest-coverage) capability among this requirement's anyOf that clears the floor.
      let bestCap = null, bestCov = -1;
      for (const cap of req.anyOf) {
        const v = c.profile?.[cap];
        if (v && v.coverage >= req.minScore && v.coverage > bestCov) { bestCov = v.coverage; bestCap = cap; }
      }
      if (bestCap) candidates.push({ name: c.name, cap: bestCap, coverage: bestCov });
    }
    candidates.sort((a, b) => b.coverage - a.coverage);
    return { key: req.key, minScore: req.minScore, anyOf: req.anyOf, met: candidates.length > 0, candidates };
  });

  const candidatesByReq = Object.fromEntries(requirements.map((r) => [r.key, r.candidates]));
  const missing = requirements.filter((r) => !r.met).map((r) => r.key);
  return { archetype: archetype.id, feasible: missing.length === 0, requirements, missing, candidatesByReq };
}

/** Run feasibility for several archetypes; returns those the roster can complete, best-covered first. */
export function feasibleArchetypes(rosterProfiles, archetypes) {
  return archetypes
    .map((a) => assessFeasibility(rosterProfiles, a))
    .filter((r) => r.feasible);
}
