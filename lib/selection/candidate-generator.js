// lib/selection/candidate-generator.js — Archetype Selector Stage 5: generate valid 5-champ teams.
//
// NO FORCING (Mike, 2026-08-06: "I don't want to mandate anything — he should be selected because he
// SHOULD be selected"). The archetype is a COHERENCE gate, not a blinder, and champions are chosen by
// their VALUE (contribution to the CB objective, lib/selection/team-score.js), so the account's dominant
// champ surfaces on merit rather than by mandate.
//
// Requirements are of two kinds:
//   • 'cover'  — some ONE champ must provide the capability at ≥ minScore (poison engine, stun plan).
//   • 'budget' — a TEAM-LEVEL weighted sum (survival = suppression+protection+recovery) ≥ minTotal;
//                substitutable, so heals/shields can stand in for Decrease ATK.
//
// Search: cover the scarcest cover-requirement first (multi-role champs free seats) → complete to 5 by
// (1) reaching the survival budget, then (2) filling remaining seats with the highest-VALUE champs (which
// naturally prefers poison stackers AND dominant multi-role champs like a maxed Michelangelo). Validate
// the budget at team level. Bounded: top-K branch, cap total teams, LOG truncation (§11.5).

import { computeBudget } from './feasibility.js';
import { champValue } from './team-score.js';

const key = (members) => [...members].sort().join('|');

export function generateTeams(rosterProfiles, archetype, feasibility, { K = 6, teamSize = 5, cap = 2000 } = {}) {
  if (!feasibility.feasible) return { teams: [], truncated: false, generated: 0 };

  const profileByName = Object.fromEntries(rosterProfiles.map((c) => [c.name, c.profile]));
  const valueOf = (n) => champValue(profileByName[n]);
  const budgetReqs = archetype.hardRequirements.filter((r) => r.kind === 'budget');

  const coverFeas = feasibility.requirements.filter((r) => r.kind === 'cover');
  const satisfiers = {};
  for (const r of coverFeas) satisfiers[r.key] = new Set(r.candidates.map((c) => c.name));
  const coverReqs = coverFeas
    .map((r) => ({ key: r.key, branch: r.candidates.slice(0, K).map((c) => c.name), size: r.candidates.length }))
    .sort((a, b) => a.size - b.size);
  const covers = (members, reqKey) => members.some((n) => satisfiers[reqKey].has(n));

  // Complete a cover-set to 5: reach every survival budget (greedy marginal gain), then fill remaining
  // seats with the highest-VALUE available champs. Value credits ALL damage + survival + tempo, so a
  // dominant multi-role champ wins a spare seat over a marginal single-function filler — on merit.
  const fillTeam = (base) => {
    const members = [...base];
    const used = new Set(members);
    const avail = () => rosterProfiles.map((c) => c.name).filter((n) => !used.has(n));
    for (const breq of budgetReqs) {
      while (members.length < teamSize) {
        const cur = computeBudget(members, breq, profileByName);
        if (cur.total >= breq.minTotal) break;
        let best = null, bestGain = 1e-9, bestVal = -1;
        for (const cand of avail()) {
          const gain = computeBudget([...members, cand], breq, profileByName).total - cur.total;
          if (gain > bestGain - 1e-9 && gain > 1e-9 && (gain > bestGain + 1e-9 || valueOf(cand) > bestVal)) {
            bestGain = Math.max(bestGain, gain); bestVal = valueOf(cand); best = cand;   // tie-break budget gain by value
          }
        }
        if (!best) break;
        members.push(best); used.add(best);
      }
    }
    const rest = avail().sort((a, b) => valueOf(b) - valueOf(a));
    while (members.length < teamSize && rest.length) { const n = rest.shift(); members.push(n); used.add(n); }
    return members;
  };

  const seen = new Set();
  const teams = [];
  let truncated = false;

  const emit = (coverMembers) => {
    const members = fillTeam(coverMembers);
    if (members.length !== teamSize) return;
    const budgets = {};
    for (const breq of budgetReqs) { const b = computeBudget(members, breq, profileByName); if (!b.met) return; budgets[breq.key] = b; }
    const k = key(members);
    if (seen.has(k)) return;
    seen.add(k);
    const coverage = {};
    for (const r of coverFeas) {
      let by = null, cov = -1;
      for (const n of members) for (const cap of r.anyOf) {
        const v = profileByName[n]?.[cap];
        if (v && satisfiers[r.key].has(n) && v.coverage > cov) { cov = v.coverage; by = { name: n, cap }; }
      }
      coverage[r.key] = by ? { by: by.name, cap: by.cap, coverage: cov } : null;
    }
    teams.push({ members, coverage, budgets, value: members.reduce((s, n) => s + valueOf(n), 0) });
  };

  const recurse = (idx, members) => {
    if (teams.length >= cap) { truncated = true; return; }
    while (idx < coverReqs.length && covers(members, coverReqs[idx].key)) idx++;
    if (idx >= coverReqs.length) { emit(members); return; }
    if (members.length >= teamSize) return;
    for (const cand of coverReqs[idx].branch) {
      if (teams.length >= cap) { truncated = true; break; }
      if (members.includes(cand)) continue;
      recurse(idx + 1, [...members, cand]);
    }
  };
  recurse(0, []);

  return { teams, truncated, generated: teams.length };
}
