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
    // THE STACK-AND-DETONATE PAIR (Mike, 2026-07-16: "a dynamic duo … almost a married couple").
    // Xenomorph STACKS: A1 Tail Stab places a 5% [Poison] — THREE of them on a crit — every turn,
    // and refreshes his own [Perfect Veil] so he keeps taking those turns.
    // Ezio DETONATES: A2 Da Vinci's Design "Instantly activates all [Poison] debuffs on enemies
    // under 4 or more debuffs", and adds [Poison Sensitivity] which amplifies every tick it fires.
    // Neither is this good alone: Xenomorph's stack ticks on the boss's schedule instead of being
    // cashed in on demand, and Ezio's detonator has little to detonate. Together the stack is
    // repeatedly converted to damage the moment it crosses 4 debuffs.
    // WHY THE ENGINE NEEDS THIS SPELLED OUT: goal coverage is a CHECKBOX. Ezio alone ticks
    // [Poison], so the scan considers the DoT goal solved and values Xenomorph's poison at ZERO —
    // it benched the best DoT champion on the roster and spent the seat on AoE Damage.
    // MEASURED (GuapoDonni, Ice Golem 20, 6 captures 2026-07-16/17):
    //   WITH the pair:    151s / 152s / 178s / 182s / 198s  — Xenomorph TOP damage in all five
    //                     (1.83M / 1.29M / 1.46M / 1.75M / 1.46M)
    //   WITHOUT Xenomorph (engine's own pick, Sun Wukong in the seat): 241s, and Sun Wukong DIED
    //                     for 414k while doing the least damage on the team.
    //   => the pair is worth ~60% of clear time on this content. TIME is the judging metric.
    id: 'xenomorph_ezio_poison_engine', type: 'pair', champions: ['Xenomorph', 'Ezio Auditore'],
    magnitude: 'high',
    effect: 'Stack-and-detonate poison engine: Xenomorph stacks [Poison] every turn (three on a crit) under permanent [Perfect Veil]; Ezio instantly activates the whole stack once the target is under 4+ debuffs, with [Poison Sensitivity] amplifying each tick. Repeatedly cashes the stack in instead of waiting on the boss\'s turn. Worth ~60% of clear time on Ice Golem 20 vs. either alone.',
    source_note: 'Skill text (Tier-1): Xenomorph A1 "Places a 5% [Poison] debuff … three 5% [Poison] debuffs if this attack is critical. Also places a [Perfect Veil]"; Ezio A2 "Instantly activates all [Poison] debuffs on enemies under 4 or more debuffs" + 25% [Poison Sensitivity]. Confirmed by Mike 2026-07-16 and measured across 6 Ice Golem 20 captures.',
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
