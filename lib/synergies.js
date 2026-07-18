// synergies.js — a SYNERGY is an emergent benefit that only exists from a COMBINATION of
// champions (the whole exceeding the parts), NOT a single champion's skill. It is evaluated over
// the fielded team and is completely separate from tags (tags = "what one champion does alone").
// An active synergy is a "punch above spec" enabler that GENERALIZES to anyone who owns the combo
// — which is exactly what lets a weak roster beat content it shouldn't (see engine-feedback-loop).
//
// Rule types:
//   tag_count        — N+ team members carry a tag (e.g. 2+ Ally Attack → attacks cascade)
//   tag_pair         — tag A on one champion + tag B on a DIFFERENT one (the general form of a
//                      "combo": an enabler and a payload that need each other)
//   champion_faction — a named champion + ≥1 ally of a faction (Glorious Pallas + an Argonites attacker)
//   champion_set     — a named champion + ≥1 ally from a named set (Donatello + another TMNT)
//   pair             — two specific champions together (LAST RESORT: prefer tag_pair. A named pair
//                      only covers the two champions you thought of; the tag rule covers everyone
//                      who owns the mechanic, which is the whole point — see INS-0027, an untagged
//                      /unmodelled ability is an invisible path.)
//
// COST — `passive` vs `skill` (Mike, 2026-07-18). A synergy's worth depends on what it COSTS to
// fire, not just what it delivers. `passive` = free: it rides something the champion was doing
// anyway, no skill slot, no cooldown, no turn surrendered (Pallas pulling an Argonite ally into her
// normal attack). `skill` = paid for with a used skill and its cooldown (Fahrakin's A3 Beatdown),
// so it competes with everything else that turn could have done. Free damage compounds every round;
// skill-cost damage is bounded by cooldown and opportunity cost. Recorded on each rule; NOT yet a
// scoring input — the constructor currently reads `magnitude` only. Wiring cost into the score is
// deliberately deferred until there is a captured run to calibrate the gap against.
//
// Seeded from literal skill text (Tier-1). Extend as more combos are confirmed.

const norm = (x) => String(x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const SYNERGIES = [
  {
    // CORRECTED 2026-07-18 (Mike). Two things were wrong with the original 'high' cascade framing:
    //
    // 1. THEY DO NOT CASCADE. On a team with Pelops + Pallas + Fahrakin, "both ally attacks would
    //    kick in SEPARATELY in the battle" — they do not chain off one another. The original effect
    //    text ("trigger each other … cascade") described a mechanic that does not happen.
    // 2. IT DOUBLE-PAID A SOLO SKILL. An Ally Attack is a champion's OWN capability (seed 78:
    //    Fahrakin's A3 Beatdown is "a team-damage-multiplier mechanic" he delivers unaided), already
    //    priced as his role/tag coverage. Counting the same skill again as half a synergy paid him
    //    twice for one ability — which is exactly how he took a seat he had not earned.
    //
    // What remains is a REAL but MODEST emergent increment (more total hits per round → more
    // Warmaster / Giant Slayer procs on CB), NOT the sum of the two skills. Hence `medium`, per
    // Mike's "medium at most". The synergy must only ever pay the INCREMENT; each champion's own
    // ally attack is already paid by `extra_hits`.
    id: 'ally_attack_stack', type: 'tag_count', tag: 'Ally Attack', count: 2, magnitude: 'medium',
    cost: 'skill',
    effect: 'Two or more Ally Attack champions each fire their own ally attack — they do NOT chain, but the extra hits per round stack up (more Warmaster / Giant Slayer procs on Clan Boss).',
    source_note: 'Mike 2026-07-18: on a Pelops+Pallas+Fahrakin team "both ally attacks would kick in separately in the battle." Downgraded from `high` + de-cascaded; each champion\'s own Ally Attack is already credited as their solo capability (seed 78).',
  },
  {
    // PASSIVE (FREE) DAMAGE — the reason this earns full credit in team building (Mike, 2026-07-18):
    // Pallas's ally attack rides her normal attack, so the Argonite ally's damage costs NOTHING —
    // no skill slot, no cooldown, no turn given up. Contrast Fahrakin, whose ally attack "is at the
    // expense of a used skill" (A3, CD 6/4): his damage competes with whatever else that turn could
    // have done. "Those are very different" — free damage compounds every round; skill-cost damage
    // is bounded by cooldown and opportunity cost. This is why Pallas+Pelops deserves the bonus and
    // a second skill-cost ally attacker does not (see ally_attack_stack above).
    id: 'pallas_argonite', type: 'champion_faction', champion: 'Glorious Pallas', faction: 'Argonites', magnitude: 'high',
    cost: 'passive',
    effect: 'Glorious Pallas attacks with a random Argonites ally (using their default skill) each turn — FREE damage that costs no skill slot or cooldown, on top of her team revive. A large boost for an Argonite carry (e.g. Pelops).',
    source_note: 'Spear of Serenity: "Attacks 1 enemy with 1 random ally from the Argonites Faction." Cost classification (passive/free vs skill-cost) per Mike 2026-07-18.',
  },
  {
    // STACK-AND-DETONATE (Mike, 2026-07-16: "ezio and xeno are a dynamic duo … almost a married
    // couple" → then, correctly: "it should be by tag right? poison activation loves poisoners").
    // GENERALISED DELIBERATELY. Xenomorph+Ezio is the instance we measured, but a NAMED pair only
    // ever covers the two champions someone thought of. Expressed by tag it covers the mechanic:
    // 28 approved Debuff Activation champions × 86 Poison champions, on any roster.
    //
    // THE MECHANIC: an ACTIVATOR forces every [Poison] on the target to tick immediately, out of
    // turn (Ezio A2: "Instantly activates all [Poison] debuffs on enemies under 4 or more debuffs";
    // Artak A2 does the same for [HP Burn]). The activator is a detonator with nothing to detonate
    // unless someone STACKS the DoT — and the stackers' damage otherwise arrives on the boss's
    // schedule instead of on demand. Each needs the other. Poison Sensitivity on the activator
    // amplifies every tick it fires, compounding it further.
    //
    // WHY THE ENGINE NEEDS THIS SPELLED OUT: goal coverage is a CHECKBOX. One poisoner ticks the
    // DoT goal, so the scan reads it as solved and values every additional poisoner at ZERO — it
    // benched the best DoT champion on the roster and spent the seat on AoE Damage.
    //
    // MEASURED (GuapoDonni, Ice Golem 20, 6 captures 2026-07-16/17):
    //   WITH activator + stacker:  151 / 152 / 178 / 182 / 198s — Xenomorph TOP damage all five
    //                              (1.83M / 1.29M / 1.46M / 1.75M / 1.46M)
    //   activator, NO stacker (the engine's own pick, Sun Wukong in the seat): 241s, and Sun Wukong
    //                              DIED for 414k — least damage on the team.
    //   => ~60% of clear time, on TIME, which is the metric the project judges by.
    id: 'dot_activation_engine', type: 'tag_pair',
    tag_a: 'Debuff Activation', tag_b: ['Poison', 'HP Burn'], magnitude: 'high',
    effect: 'Stack-and-detonate DoT engine: a Debuff Activation champion forces every [Poison]/[HP Burn] on the target to tick instantly, out of turn — cashing in the stack on demand instead of waiting on the boss\'s turn. Worthless without a DoT stacker to detonate, and the stacker is far slower without it. Measured at ~60% of clear time on Ice Golem 20.',
    source_note: 'Tag-level generalisation of the Xenomorph+Ezio pair (Mike 2026-07-16: "poison activation loves poisoners"). Skill text (Tier-1): Ezio A2 "Instantly activates all [Poison] debuffs on enemies under 4 or more debuffs"; Xenomorph A1 "Places a 5% [Poison] debuff … three … if this attack is critical". Debuff Activation tag = seed 144 (28 champions), from Tag Policy #12 revised.',
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

    } else if (syn.type === 'tag_pair') {
      // An ENABLER (tag_a) plus a PAYLOAD (any of tag_b) on a DIFFERENT champion. The "different
      // champion" test is the point: a champion carrying both tags is already self-sufficient and
      // is NOT a synergy — the emergent benefit only exists across two seats. (Ezio carries both
      // Poison and Debuff Activation; he alone must not light this up. Pair him with Xenomorph and
      // it fires, which is exactly the distinction the engine kept missing.)
      const wants = Array.isArray(syn.tag_b) ? syn.tag_b : [syn.tag_b];
      const enablers = members.filter(m => (m.tags ?? []).includes(syn.tag_a));
      if (!enablers.length) continue;
      const payloads = members.filter(m => wants.some(t => (m.tags ?? []).includes(t))
        && !enablers.some(e => norm(e.name) === norm(m.name)));
      if (payloads.length) {
        active.push({ ...syn, members: [...enablers.map(m => m.name), ...payloads.map(m => m.name)] });
      }

    } else if (syn.type === 'pair') {
      if ((syn.champions ?? []).every(c => has(c))) active.push({ ...syn, members: syn.champions });
    }
  }
  return active;
}
