// synergies.js — a SYNERGY is an emergent benefit that only exists from a COMBINATION of
// champions (the whole exceeding the parts), NOT a single champion's skill. It is evaluated over
// the fielded team and is completely separate from tags (tags = "what one champion does alone").
// An active synergy is a "punch above spec" enabler that GENERALIZES to anyone who owns the combo
// — which is exactly what lets a weak roster beat content it shouldn't (see engine-feedback-loop).
//
// Rule types:
//   tag_count        — N+ team members carry a tag (e.g. 2+ Ally Attack → attacks cascade)
//   champion_faction — a named champion + ≥1 ally of a faction (Glorious Pallas + an Argonites attacker)
//   champion_set     — a named champion + ≥1 ally from a named set (Donatello + another TMNT)
//   pair             — two specific champions together
//
// Seeded from literal skill text (Tier-1). Extend as more combos are confirmed.

const norm = (x) => String(x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const SYNERGIES = [
  {
    id: 'ally_attack_stack', type: 'tag_count', tag: 'Ally Attack', count: 2, magnitude: 'high',
    effect: 'Multiple Ally Attack champions trigger each other — the attacks cascade for far more damage per turn than either delivers alone.',
    source_note: 'Two or more Ally Attack skills chain off one another.',
  },
  {
    id: 'pallas_argonite', type: 'champion_faction', champion: 'Glorious Pallas', faction: 'Argonites', magnitude: 'high',
    effect: 'Glorious Pallas attacks with a random Argonites ally (using their default skill) each turn — a large damage boost for an Argonite carry (e.g. Pelops), on top of her team revive.',
    source_note: 'Spear of Serenity: "Attacks 1 enemy with 1 random ally from the Argonites Faction."',
  },
  {
    id: 'donatello_tmnt', type: 'champion_set', champion: 'Donatello',
    set: ['Leonardo', 'Donatello', 'Michelangelo', 'Raphael'], magnitude: 'high',
    effect: 'Donatello’s attacks are joined by any TMNT ally (Leonardo / Michelangelo / Raphael) — extra hits every turn.',
    source_note: 'I Got You Bro! [P]: "any ally Leonardos, Donatellos, Michelangelos, and Raphaels will join in that attack."',
  },
];

/**
 * Detect active synergies in a fielded team.
 * @param {Array} team - [{ name, faction, role, tags: string[] }]
 * @returns {Array} active synergies, each { id, effect, magnitude, members: string[], source_note }
 */
export function detectSynergies(team) {
  const members = team ?? [];
  const has = (name) => members.some(m => norm(m.name) === norm(name));
  const active = [];

  for (const syn of SYNERGIES) {
    if (syn.type === 'tag_count') {
      const hit = members.filter(m => (m.tags ?? []).includes(syn.tag));
      if (hit.length >= syn.count) active.push({ ...syn, members: hit.map(m => m.name) });

    } else if (syn.type === 'champion_faction') {
      if (!has(syn.champion)) continue;
      const allies = members.filter(m => norm(m.name) !== norm(syn.champion)
        && m.faction === syn.faction && (!syn.ally_role || m.role === syn.ally_role));
      if (allies.length) active.push({ ...syn, members: [syn.champion, ...allies.map(m => m.name)] });

    } else if (syn.type === 'champion_set') {
      if (!has(syn.champion)) continue;
      const allies = members.filter(m => norm(m.name) !== norm(syn.champion)
        && syn.set.some(s => norm(s) === norm(m.name)));
      if (allies.length) active.push({ ...syn, members: [syn.champion, ...allies.map(m => m.name)] });

    } else if (syn.type === 'pair') {
      if ((syn.champions ?? []).every(c => has(c))) active.push({ ...syn, members: syn.champions });
    }
  }
  return active;
}
