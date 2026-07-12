// Damage-multiplier ranking (recommendation-engine Phase 5).
//
// Ranks champions who cover the SAME tags by the strength of their role-relevant
// damage skill, using champion_skills.damage_multiplier + multiplier_type. This is
// a TIEBREAKER only — it never changes which goals a champion covers, so it cannot
// regress the deterministic tag-coverage logic. Support champions are not ranked
// (their value is utility, not raw damage).
//
// damage_multiplier values are mostly a bare float ("3.5") but some are compound
// ("0.02 Enemy MAX HP / 2.5 ATK") or formula-shaped ("0.25 HP * (1 + ...)"). We only
// ever compare multipliers of the SAME stat (gated by the champion's role), so the
// enemy-MAX-HP portion of a compound string is correctly ignored for an ATK champ.

const ROLE_STAT = { Attack: 'ATK', Defense: 'DEF', HP: 'HP', Support: null };

export function roleStat(role) {
  return ROLE_STAT[role] ?? null;
}

// Extract the numeric coefficient that scales off `stat` (ATK/DEF/HP) from a
// damage_multiplier string. Returns a number or null.
//   ("3.5", "ATK", "ATK")                        -> 3.5   (bare float, type matches)
//   ("0.02 Enemy MAX HP / 2.5 ATK", *, "ATK")    -> 2.5   ("<n> ATK" token)
//   ("0.25 HP * (1 + 0.05*d)", "formula", "HP")  -> 0.25  ("<n> HP" token)
//   ("3.5", "HP", "ATK")                          -> null  (bare float, wrong type)
export function parseMultiplier(damage_multiplier, multiplier_type, stat) {
  if (!stat || damage_multiplier == null) return null;
  const s = String(damage_multiplier).trim();
  if (!s) return null;

  // Bare numeric: only counts when the declared type is exactly this stat.
  if (/^[0-9]*\.?[0-9]+$/.test(s)) {
    return String(multiplier_type ?? '').toUpperCase() === stat.toUpperCase()
      ? parseFloat(s)
      : null;
  }
  // Compound/formula: find "<number> <stat>" (e.g. "2.5 ATK", "0.25 HP").
  const m = s.match(new RegExp(`([0-9]*\\.?[0-9]+)\\s*${stat}\\b`, 'i'));
  return m ? parseFloat(m[1]) : null;
}

// Highest role-relevant damage multiplier across a champion's skills. null when the
// champion has no role-relevant multiplier (Support, or damage data not captured).
export function championDamageScore(skills, role) {
  const stat = roleStat(role);
  if (!stat) return null;
  let best = null;
  for (const sk of skills ?? []) {
    const v = parseMultiplier(sk.damage_multiplier, sk.multiplier_type, stat);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}

// Fetches champion_skills for the given champion ids and attaches
// `damage_multiplier_score` to each mapped champion (mutates + returns). Skills with
// no damage_multiplier are skipped. Safe to call with an empty roster.
export async function attachDamageScores(mapped, supabase) {
  const ids = [...new Set((mapped ?? []).map(c => c.id).filter(Boolean))];
  if (!ids.length) return mapped;
  const { data: rows } = await supabase
    .from('champion_skills')
    .select('champion_id, damage_multiplier, multiplier_type')
    .in('champion_id', ids)
    .not('damage_multiplier', 'is', null);
  const byChamp = {};
  for (const r of rows ?? []) (byChamp[r.champion_id] ??= []).push(r);
  for (const c of mapped ?? []) {
    c.damage_multiplier_score = championDamageScore(byChamp[c.id], c.role);
  }
  return mapped;
}
