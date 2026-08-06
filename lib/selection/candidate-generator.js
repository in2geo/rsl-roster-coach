// lib/selection/candidate-generator.js — Archetype Selector Stage 5: constructively generate valid
// 5-champ teams for an archetype, anchored on the SCARCEST requirement.
//
// The old pool selector seeded the top-5 by development and repaired the shortest bucket — which gets
// trapped in a locally-good but structurally-incoherent team. Instead we build AROUND the hardest
// requirements: cover the scarcest function first, then the next, letting a champion that satisfies
// several functions FREE a seat (multi-role dedup), then fill spare seats with the archetype's
// fillPreference (a 2nd DoT carrier — CB is a stacking race). See knowledge/ARCHETYPE_SELECTOR_SPEC.md §5.
//
// Bounds (§11.5, no silent caps): branch on top-K candidates per requirement; cap total teams and LOG
// truncation. A champion still COUNTS as covering a requirement via the full candidate list even when
// it wasn't in that requirement's top-K (so multi-role coverage is never missed) — we only limit which
// champs we actively BRANCH on.

const key = (members) => [...members].sort().join('|');

/**
 * @param {Array<{name:string, profile:object}>} rosterProfiles
 * @param {object} archetype                    - spec from lib/archetypes/clan-boss.js
 * @param {object} feasibility                  - assessFeasibility() output (its candidate lists are reused)
 * @param {object} [opts] { K=6, teamSize=5, cap=2000 }
 * @returns {{ teams: Array, truncated: boolean, generated: number }}
 *   each team: { members:[names], coverage:{reqKey:{by,coverage}}, filled:[names] }
 */
export function generateTeams(rosterProfiles, archetype, feasibility, { K = 6, teamSize = 5, cap = 2000 } = {}) {
  if (!feasibility.feasible) return { teams: [], truncated: false, generated: 0 };

  const profileByName = Object.fromEntries(rosterProfiles.map((c) => [c.name, c.profile]));
  // Full satisfier set per requirement (for multi-role coverage checks) + top-K to branch on (scarcity order).
  const satisfiers = {};                                   // reqKey -> Set(all names that meet it)
  for (const r of feasibility.requirements) satisfiers[r.key] = new Set(r.candidates.map((c) => c.name));
  const reqs = feasibility.requirements
    .map((r) => ({ key: r.key, branch: r.candidates.slice(0, K).map((c) => c.name), size: r.candidates.length }))
    .sort((a, b) => a.size - b.size);                       // scarcest first

  const covers = (members, reqKey) => members.some((n) => satisfiers[reqKey].has(n));

  // FILL spare seats: best fillPreference champs (stacking DoT), then best-of-anything, up to teamSize.
  const fillCoverage = (name) => Math.max(0, ...(archetype.fillPreference || []).map((cap2) => profileByName[name]?.[cap2]?.coverage ?? 0));
  const anyCoverage = (name) => { const p = profileByName[name] || {}; let m = 0; for (const k in p) m = Math.max(m, p[k].coverage || 0); return m; };
  const fillTeam = (members) => {
    if (members.length >= teamSize) return { members: members.slice(0, teamSize), filled: [] };
    const inTeam = new Set(members);
    const pool = rosterProfiles.map((c) => c.name).filter((n) => !inTeam.has(n));
    pool.sort((a, b) => (fillCoverage(b) - fillCoverage(a)) || (anyCoverage(b) - anyCoverage(a)));
    const filled = pool.slice(0, teamSize - members.length);
    return { members: [...members, ...filled], filled };
  };

  const seen = new Set();
  const teams = [];
  let truncated = false;

  const emit = (coverMembers) => {
    const { members, filled } = fillTeam(coverMembers);
    if (members.length !== teamSize) return;               // roster too small to reach 5
    const k = key(members);
    if (seen.has(k)) return;
    seen.add(k);
    // Attribute each requirement to its highest-coverage member (for explanation / scoring later).
    const coverage = {};
    for (const r of feasibility.requirements) {
      let by = null, cov = -1;
      for (const n of members) {
        for (const cap2 of r.anyOf) {
          const v = profileByName[n]?.[cap2];
          if (v && satisfiers[r.key].has(n) && v.coverage > cov) { cov = v.coverage; by = { name: n, cap: cap2 }; }
        }
      }
      coverage[r.key] = by ? { by: by.name, cap: by.cap, coverage: cov } : null;
    }
    teams.push({ members, coverage, filled });
  };

  const recurse = (idx, members) => {
    if (teams.length >= cap) { truncated = true; return; }
    while (idx < reqs.length && covers(members, reqs[idx].key)) idx++;   // skip already-covered
    if (idx >= reqs.length) { emit(members); return; }                  // all covered
    if (members.length >= teamSize) return;                             // out of seats, still uncovered
    for (const cand of reqs[idx].branch) {
      if (teams.length >= cap) { truncated = true; break; }
      if (members.includes(cand)) continue;
      recurse(idx + 1, [...members, cand]);
    }
  };
  recurse(0, []);

  return { teams, truncated, generated: teams.length };
}
