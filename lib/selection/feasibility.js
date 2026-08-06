// lib/selection/feasibility.js — Archetype Selector Stage 4: can this roster COMPLETE an archetype?
//
// A cheap necessary pre-check before team generation. Requirements come in two KINDS:
//   • 'cover'  — is there ≥1 roster champ whose profile meets it (some `anyOf` capability ≥ minScore)?
//   • 'budget' — can the roster POSSIBLY reach a team-level weighted sum ≥ minTotal? The necessary
//                condition is roster-max = Σ (best coverage per component across the pool) ≥ minTotal.
//                (The actual 5-champ budget is enforced by the candidate generator/validator.)
//
// Necessary, not sufficient: feasibility proves each function is coverable/reachable SOMEWHERE in the
// roster, not that everything fits within five champions — that is the generator + validator's job.
// Output doubles as candidate lists / component contributors that Stage 5 reuses.

/** Best coverage for a set of capabilities among one champ's profile. */
export function bestCapCoverage(profile, anyOf) {
  let bestCap = null, bestCov = -1;
  for (const cap of anyOf) {
    const v = profile?.[cap];
    if (v && v.coverage > bestCov) { bestCov = v.coverage; bestCap = cap; }
  }
  return bestCap ? { cap: bestCap, coverage: bestCov } : null;
}

/** Team-level survival budget: Σ over components of the best coverage any team member provides. */
export function computeBudget(members, budgetReq, profileByName) {
  const breakdown = budgetReq.components.map((comp) => {
    let by = null, cov = 0;
    for (const n of members) {
      const b = bestCapCoverage(profileByName[n], comp.anyOf);
      if (b && b.coverage > cov) { cov = b.coverage; by = { name: n, cap: b.cap }; }
    }
    return { key: comp.key, coverage: cov, by };
  });
  const total = breakdown.reduce((s, c) => s + c.coverage, 0);
  return { total, breakdown, met: total >= budgetReq.minTotal };
}

export function assessFeasibility(rosterProfiles, archetype) {
  const profileByName = Object.fromEntries(rosterProfiles.map((c) => [c.name, c.profile]));
  const requirements = archetype.hardRequirements.map((req) => {
    if (req.kind === 'budget') {
      // Roster-max per component (necessary condition — a single team may not gather all of them).
      const components = req.components.map((comp) => {
        const contributors = rosterProfiles
          .map((c) => { const b = bestCapCoverage(c.profile, comp.anyOf); return b ? { name: c.name, cap: b.cap, coverage: b.coverage } : null; })
          .filter(Boolean).sort((a, b) => b.coverage - a.coverage);
        return { key: comp.key, anyOf: comp.anyOf, best: contributors[0] ?? null, contributors };
      });
      const rosterMax = components.reduce((s, c) => s + (c.best?.coverage ?? 0), 0);
      return { key: req.key, kind: 'budget', minTotal: req.minTotal, met: rosterMax >= req.minTotal, rosterMax, components };
    }
    // cover requirement
    const candidates = [];
    for (const c of rosterProfiles) {
      const b = bestCapCoverage(c.profile, req.anyOf);
      if (b && b.coverage >= req.minScore) candidates.push({ name: c.name, cap: b.cap, coverage: b.coverage });
    }
    candidates.sort((a, b) => b.coverage - a.coverage);
    return { key: req.key, kind: 'cover', minScore: req.minScore, anyOf: req.anyOf, met: candidates.length > 0, candidates };
  });

  const candidatesByReq = Object.fromEntries(requirements.filter((r) => r.kind === 'cover').map((r) => [r.key, r.candidates]));
  const missing = requirements.filter((r) => !r.met).map((r) => r.key);
  return { archetype: archetype.id, feasible: missing.length === 0, requirements, missing, candidatesByReq };
}

/** Run feasibility for several archetypes; returns those the roster can complete. */
export function feasibleArchetypes(rosterProfiles, archetypes) {
  return archetypes.map((a) => assessFeasibility(rosterProfiles, a)).filter((r) => r.feasible);
}
