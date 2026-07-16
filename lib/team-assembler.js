// lib/team-assembler.js — the SELECTION layer above the problem model (Mike 2026-07-16).
//
// A dungeon needs a set of ROLES filled across 5 seats. You build a team by assigning each seat a
// PRIMARY role (the job it was picked for); a champ's other capabilities are BONUS. Multi-role champs
// are efficient — they cover a seat's job AND free another seat. This is universal across content.
//
// It's a LOOP, not a one-shot (Mike): a team is a hypothesis, the battle result is the test. The result
// says which ROLE fell short; then you re-solve under a hard CONSTRAINT — fix the short role WITHOUT
// dropping the roles that already worked. `assembleTeam` does the first pass; `fixTeam` does the
// constrained re-solve. The role model stays stable; only the LINEUP adapts to results.
//
// Champ shape: { name, caps:Set<string>, dev:number, exemplar?:{role,caveat} }
// roleDefs:   { ROLE: { label, tags:[capability strings] } }   order: [ROLE, …] (seat priority)

const rolesCovered = (champ, roleDefs, order) => order.filter(r => roleDefs[r].tags.some(t => champ.caps.has(t)));

/** First pass: cover every role across ≤5 seats, preferring multi-role champs, then quality (dev). */
export function assembleTeam(champs, roleDefs, order, maxSeats = 5) {
  const cand = champs.map(c => ({ ...c, roles: rolesCovered(c, roleDefs, order) })).filter(c => c.roles.length);
  const team = [], chosen = new Set(), uncovered = new Set(order);
  // greedy set-cover: repeatedly take the champ covering the MOST still-uncovered roles (tie → dev).
  while (uncovered.size && team.length < maxSeats) {
    let best = null, bestScore = -1;
    for (const c of cand) {
      if (chosen.has(c.name)) continue;
      const gain = c.roles.filter(r => uncovered.has(r)).length;
      if (!gain) continue;
      const score = gain * 1e9 + (c.dev || 0);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) break;
    const primary = order.find(r => uncovered.has(r) && best.roles.includes(r));
    team.push({ name: best.name, primary, bonus: best.roles.filter(r => r !== primary), roles: best.roles, dev: best.dev, exemplar: best.exemplar });
    chosen.add(best.name);
    for (const r of best.roles) uncovered.delete(r);
  }
  // depth: fill any leftover seats with the best multi-role champs available.
  while (team.length < maxSeats) {
    let best = null, bestScore = -1;
    for (const c of cand) { if (chosen.has(c.name)) continue; const s = c.roles.length * 1e9 + (c.dev || 0); if (s > bestScore) { bestScore = s; best = c; } }
    if (!best) break;
    team.push({ name: best.name, primary: best.roles[0], bonus: best.roles.slice(1), roles: best.roles, dev: best.dev, exemplar: best.exemplar, depth: true });
    chosen.add(best.name);
  }
  return { team, gaps: [...uncovered] };
}

/**
 * Constrained re-solve: the result says `shortRole` fell short. Return swaps (out → in) that REINFORCE
 * shortRole while preserving every role the team already covered. Ranked by incoming quality.
 * @returns [{ out, in, inRoles, drops:[roles only `out` provided], preserved:true, score }]
 */
export function fixTeam(teamChamps, shortRole, roster, roleDefs, order) {
  const team = teamChamps.map(c => ({ ...c, roles: rolesCovered(c, roleDefs, order) }));
  const teamNames = new Set(team.map(c => c.name));
  const originalRoles = new Set(team.flatMap(c => c.roles));
  const incoming = roster.filter(c => !teamNames.has(c.name))
    .map(c => ({ ...c, roles: rolesCovered(c, roleDefs, order) }))
    .filter(c => c.roles.includes(shortRole)); // must actually provide the short role
  const swaps = [];
  for (const seat of team) {
    const others = team.filter(x => x.name !== seat.name);
    const coveredByOthers = new Set(others.flatMap(x => x.roles));
    const drops = seat.roles.filter(r => !coveredByOthers.has(r)); // roles ONLY this seat provided
    for (const inC of incoming) {
      const after = new Set([...others.flatMap(x => x.roles), ...inC.roles]);
      const preserved = [...originalRoles].every(r => after.has(r)); // no role lost
      if (preserved && after.has(shortRole)) {
        swaps.push({ out: seat.name, in: inC.name, inRoles: inC.roles, drops, preserved: true, score: (inC.dev || 0) });
      }
    }
  }
  // prefer swaps that drop NOTHING unique, then higher incoming quality.
  swaps.sort((a, b) => a.drops.length - b.drops.length || b.score - a.score);
  return swaps;
}

// Map a captured battle RESULT to the role that fell short. Pure/heuristic — the diagnostic half of the
// loop. Judged by TIME, not turns (CLAUDE.md core principle: auto-battle within a ~5-min budget).
// `capture` = { result, stage, turns, durationSeconds, finishCause, heroes:[{name,survived,damage}] }.
// Returns { role|null, why, slowest? } — `slowest` is a soft "improve-this-to-go-faster" hint on an
// otherwise-fine win. A `deadSeat` (a fielded hero who died and was a sole role-provider) overrides.
export function diagnoseShortRole(capture, { timeBudgetSeconds = 300, deadSeatRole = null } = {}) {
  const c = capture || {};
  const lost = c.result && /def|loss|lose|fail/i.test(c.result);
  const reachedBoss = !/wave/i.test(c.finishCause || '') && !/wave/i.test(String(c.stage || ''));
  if (deadSeatRole && lost) return { role: deadSeatRole, why: `A champ whose only job was ${deadSeatRole} died — that role dropped out mid-fight.` };
  if (lost) {
    if (!reachedBoss) return { role: 'WAVE', why: 'Lost in the waves — never reached the boss.' };
    return (c.turns || 0) < 25
      ? { role: 'SURVIVE', why: "Died fast at the boss — the team couldn't outlast his turn(s) (TM-lock / survive short)." }
      : { role: 'DAMAGE', why: 'Reached the boss but couldn’t finish before the team attrited — damage too low.' };
  }
  if (c.result && /vic|win/i.test(c.result)) {
    const t = c.durationSeconds || 0;
    if (t > timeBudgetSeconds) return { role: 'DAMAGE', why: `Won but OVER the ~${Math.round(timeBudgetSeconds / 60)}-min budget (${t}s) — too slow; DAMAGE/lock is the lever.` };
    const slowest = t > timeBudgetSeconds * 0.8 ? 'DAMAGE' : null; // fine, but on the slow side
    return { role: null, slowest, why: `Clean win within the time budget (${t}s ≤ ${timeBudgetSeconds}s)${slowest ? ' — but on the slower side; DAMAGE is the seat to upgrade for a faster clear.' : ' — no change needed.'}` };
  }
  return null;
}
