// lib/sim/ai.js — the AUTO-BATTLE AI's real behaviour.
//
// Source: `knowledge/AUTO_BATTLE_AI.md` (Mike, 2026-07-22). CLAUDE.md's first architecture principle
// is "recommend for AUTO-BATTLE" — ~99% of the audience plays on auto — so these rules are not a
// simulation detail, they ARE the thing being predicted. A capability the AI will not fire is a
// capability the player does not have.
//
// ⚠ THE FINDING THIS ENCODES. A composite skill gets ONE classification, and whichever half did not
// drive it is spent at the wrong moment:
//     revive + buffs -> the REVIVE governs: held until a death, the buffs NEVER land proactively
//     heal   + buffs -> the BUFFS  govern: fired at full HP, the raw heal is WASTED
// It is asymmetric — not "strongest effect wins". So a champion's contribution is NOT the sum of its
// clauses, and any kit-as-capability-list model (i.e. our entire tag layer) OVER-credits composite
// supports, always optimistically. Worked example: Tagoar is hit by BOTH rules at once — his A2 heal
// fires early and overheals, his A3 shield never lands because it rides on a revive.

const CC_DEBUFFS = new Set(['Stun', 'Freeze', 'Sleep', 'Provoke', 'Fear', 'True Fear', 'Petrification', 'Block Active Skills']);

// Thresholds from AUTO_BATTLE_AI.md §2b. NOMINAL where a range was given; flagged at the call site.
export const HOARD_SINGLE = 0.75;   // pure single-target heal: hold until an ally is below 75%
export const HOARD_AOE    = 0.60;   // pure AoE heal: hold until an ally is below ~50-60%

/**
 * Which bucket does the AI put this skill in? The bucket decides WHEN it fires, which for a
 * support decides almost everything.
 */
export function classifySkill(s) {
  if (s.revives) return 'revive';                        // hard lock, dominates any buff it carries
  if (s.healPct && (s.buffs?.length)) return 'heal_buff';// reclassified as a BUFF -> fires at full HP
  if (s.healPct && s.cleanses) return 'heal_cleanse';    // triggered by DEBUFF STATUS, not HP
  if (s.healPct) return s.aoeHeal ? 'heal_aoe' : 'heal_single';
  if (s.cleanses) return 'cleanse';
  return 'normal';
}

/** Will the AI actually use this skill in this state? */
export function canUseSkill(s, state, actor) {
  const allies = state.allies;
  const live = allies.filter(a => a.alive);
  const lowest = live.length ? Math.min(...live.map(a => a.hp / a.maxHp)) : 1;
  const anyDead = allies.some(a => !a.alive);
  const anyCC = live.some(a => a.debuffs.some(d => CC_DEBUFFS.has(d.type)));

  switch (classifySkill(s)) {
    case 'revive':       return anyDead;                    // STRICT lock — the buffs come along or not at all
    case 'heal_buff':    return true;                       // treated as a buff: fired on priority, wasting the heal
    case 'heal_cleanse': return anyCC || lowest < HOARD_SINGLE;
    case 'cleanse':      return anyCC;
    case 'heal_single':  return lowest < HOARD_SINGLE;
    case 'heal_aoe':     return lowest < HOARD_AOE;
    default:             return true;
  }
  // NOT MODELLED: execution skills (skipped until an enemy is in the executable range) — we do not
  // know what HP% counts as executable. Open question 2 in AUTO_BATTLE_AI.md. Rather than guess a
  // threshold, such skills currently fire normally; readSkillKit flags them.
}

// ── kit extraction from verbatim skill text ──────────────────────────────────
// HEURISTIC, and deliberately so: `damage_multiplier` is only 38% populated and there are no `hits`
// or `targeting` columns, so the structured fields do not exist yet. This parses what it can from
// `skill_summary` (verbatim Plarium text, which we own for ~934 champions) and REPORTS what it could
// not read. When the extraction pass lands these become real columns and this function shrinks.
const num = (v) => { const m = String(v ?? '').match(/[\d.]+/); return m ? +m[0] : null; };

export function readSkillKit(rows = []) {
  const out = [];
  for (const r of rows) {
    const t = r.skill_summary ?? '';
    const slot = String(r.slot ?? '').toUpperCase();
    if (!slot) continue;

    const aoe = /attacks all enemies/i.test(t);
    const hitsEnemies = /attacks?\s+(1 enemy|all enemies|\d+ enem)/i.test(t);
    const revives = /\brevives?\b/i.test(t) && !/block revive/i.test(t);
    const cleanses = /removes? (all )?debuffs? from|cleanses?/i.test(t);
    const healMatch = t.match(/heals? all allies by (\d+)%/i) || t.match(/heals? .{0,30}by (\d+)%/i);

    // buffs this skill places on the ALLY side (recipient decides the tag — policy #21)
    const buffs = [];
    for (const [re, type] of [
      [/(\d+)%\s*\[Increase ATK\]/i, 'Increase ATK'], [/(\d+)%\s*\[Increase DEF\]/i, 'Increase DEF'],
      [/(\d+)%\s*\[Increase SPD\]/i, 'Increase SPD'], [/\[Shield\]/i, 'Shield'],
      [/\[Magma Shield\]/i, 'Magma Shield'], [/\[Continuous Heal\]/i, 'Continuous Heal'],
      [/\[Taunt\]/i, 'Taunt'], [/\[Perfect Veil\]/i, 'Perfect Veil'], [/\[Counterattack\]/i, 'Counterattack'],
    ]) { const m = t.match(re); if (m) buffs.push({ type, value: num(m[1]) ?? null, turns: 2, self: /on this Champion/i.test(t) && !/all allies/i.test(t) }); }

    // debuffs placed on ENEMIES
    const debuffs = [];
    for (const [re, type, extra] of [
      [/(\d+)%\s*\[Decrease DEF\]/i, 'Decrease Defense', {}],
      [/(\d+)%\s*\[Decrease ATK\]/i, 'Decrease Attack', {}],
      [/(\d+)%\s*\[Weaken\]/i, 'Weaken', {}],
      [/(\d+)%\s*\[Poison\]/i, 'Poison', { stacking: true, maxStacks: 10 }],
      [/\[HP Burn\]/i, 'HP Burn', { maxStacks: 1 }],
    ]) { const m = t.match(re); if (m) debuffs.push({ type, pct: type === 'Poison' ? (num(m[1]) ?? 5) / 100 : null, value: num(m[1]), turns: 2, ...extra }); }

    const s = {
      slot, name: r.skill_name, cooldown: num(r.cooldown_base) ?? 0, cdLeft: 0,
      coeff: parseCoeff(r.damage_multiplier),
      hitsEnemies, aoe, revives, cleanses,
      healPct: healMatch ? +healMatch[1] / 100 : null,
      aoeHeal: /heals? all allies/i.test(t),
      buffs, debuffs,
      unread: [],
    };
    if (s.hitsEnemies && s.coeff == null) s.unread.push('damage_multiplier');
    if (/\bexecut|if the target'?s HP is below/i.test(t)) s.unread.push('execute-threshold');
    out.push(s);
  }
  return out;
}

/** `damage_multiplier` is free text in three shapes: "4.65" | "2.5 ATK" | "0.02 Enemy MAX HP / 2.5 ATK". */
export function parseCoeff(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  const m = t.match(/([\d.]+)\s*ATK/i);
  if (m) return +m[1];
  if (/^[\d.]+$/.test(t)) return +t;
  return null;
}
