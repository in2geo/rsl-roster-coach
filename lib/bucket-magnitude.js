// lib/bucket-magnitude.js — MAGNITUDE of a champion's delivery per bucket (SHADOW, Layer: evaluation).
//
// WHY: capability-based fill cannot grade a team. Every captured Don$Gnut team "covers" mitigation, so
// the bucket scorer returned ~the same number for a GRANDMASTER team and a team 3M behind it
// (INS-0031). What separates them is HOW MUCH of each job actually gets done — Pelops lands his
// Decrease ATK at ACC 214, Gnut lands the SAME debuff at ACC 20.
//
// THE MODEL (INS-0031):   delivery = effect size × uptime × land rate × build scale
//
// THIS FILE IS THE INTERIM CUT: **uptime × land rate only.** Effect size is deliberately deferred —
// extracting per-(champion,tag) magnitudes from skill text needs LLM extraction + advisor review
// (~1/3 of Decrease-ATK skills resist a naive regex: conditional, random-pool, multi-debuff prose).
// Uptime and land rate alone already separate Pelops from Gnut, which is the discrimination we need to
// test whether the pool model works at all. Add effect size only if this proves insufficient.
//
// PRIOR ART REUSED (do not rebuild): lib/power-model.js already had `dotLandRate` and
// `dotUptimeFromSkills` — calibrated against real battles and never wired into selection. This
// generalises that uptime idea from DoT-only to any tag, and keeps its conventions.
//
// CONVENTION INHERITED FROM power-model: **absence of data ⇒ 1.0, never 0.** A missing cooldown or
// unparseable skill text is a CAPTURE GAP, not evidence the champion is bad. Zero-crediting on absence
// would silently bench champions for our own data problems (the exact failure that made `?? 0` zero a
// whole team from one null champ).

/** Bracket forms as they appear in Plarium skill text, keyed by our tag name. Only tags that appear
 *  as [Brackets] need an entry; prose capabilities (Healer, Multi-Hit A1, Ally Attack) fall back to
 *  the default uptime and are not chance-gated. */
const TAG_BRACKET = {
  'Decrease Attack': 'Decrease ATK', 'Decrease Defense': 'Decrease DEF',
  'AoE Decrease Defense': 'Decrease DEF', 'Decrease Speed': 'Decrease SPD',
  'Decrease C.Rate': 'Decrease C\\. ?RATE', 'Decrease C.DMG': 'Decrease C\\. ?DMG',
  'Decrease ACC': 'Decrease ACC', 'Increase Defense': 'Increase DEF',
  'Increase RES': 'Increase RES', 'Increase Attack': 'Increase ATK',
  'Increase Speed': 'Increase SPD', 'Increase ACC': 'Increase ACC',
  'Increase C.Rate': 'Increase C\\. ?RATE', 'Increase C.DMG': 'Increase C\\. ?DMG',
  'Continuous Heal': 'Continuous Heal', 'Shield': 'Shield', 'AoE Shield': 'Shield',
  'Ally Protection': 'Ally Protection', 'Block Damage': 'Block Damage',
  'Unkillable': 'Unkillable', 'Block Debuffs': 'Block Debuffs', 'Strengthen': 'Strengthen',
  'Poison': 'Poison', 'HP Burn': 'HP Burn', 'Necrosis': 'Necrosis', 'Weaken': 'Weaken',
  'Provoke': 'Provoke', 'Taunt': 'Taunt', 'Counterattack': 'Counterattack',
  'Perfect Veil': 'Perfect Veil', 'Fatigue': 'Fatigue', 'Poison Sensitivity': 'Poison Sensitivity',
  'Heal Reduction': 'Heal Reduction', 'Magma Shield': 'Magma Shield', 'Stone Skin': 'Stone Skin',
  'Fervor': 'Fervor', 'Intercept': 'Intercept', 'Pain Link': 'Pain Link',
};

const num = (m) => (m ? Number(m[1]) : null);

/**
 * UPTIME for one tag on one champion: what fraction of the fight is this effect actually up?
 *   • placed by an A1 or a passive, or by a skill with no cooldown → 1.0 (every-turn engine)
 *   • otherwise duration ÷ cooldown, capped at 1
 * Takes the BEST provider if several skills place it. Returns 1.0 when nothing parses (capture gap).
 *
 * Books: `assumeBooked` picks `cooldown_booked` over `cooldown_base` where present. Books shorten
 * cooldowns materially (Fahrakin's A3: 6 unbooked → 4 booked = +50% uptime), so this is not cosmetic.
 * Boolean by design — the mobile audience can only supply one "fully booked" checkbox (INS-0033).
 */
export function tagUptime(tag, skillRows = [], { assumeBooked = false } = {}) {
  const bracket = TAG_BRACKET[tag];
  if (!bracket) return 1;                                  // prose capability — not duration-limited
  const re = new RegExp(`\\[${bracket}\\]`, 'i');
  let best = 0, found = false;
  for (const s of skillRows) {
    const txt = s.skill_summary || '';
    if (!re.test(txt)) continue;
    found = true;
    const slot = String(s.slot || '');
    const cd = Number((assumeBooked ? s.cooldown_booked : null) ?? s.cooldown_base) || null;
    if (/^A1/i.test(slot) || /passive/i.test(slot) || !cd) return 1;   // every-turn source
    const dur = num(txt.match(/for (\d+) turns?/)) ?? 2;
    best = Math.max(best, Math.min(1, dur / cd));
  }
  return found ? (best || 1) : 1;                          // absence ⇒ 1.0, never 0
}

/**
 * CHANCE the effect applies at all, from "has a NN% chance of placing a [X]" phrasing.
 * Returns 1 when no chance is stated (guaranteed placement) or nothing parses.
 */
export function tagChance(tag, skillRows = []) {
  const bracket = TAG_BRACKET[tag];
  if (!bracket) return 1;
  const re = new RegExp(`(\\d+)% chance[^.]{0,120}?\\[${bracket}\\]`, 'i');
  let best = 0, found = false;
  for (const s of skillRows) {
    const m = (s.skill_summary || '').match(re);
    if (!m) continue;
    found = true;
    best = Math.max(best, Number(m[1]) / 100);
  }
  return found ? best : 1;
}

/**
 * LAND RATE: does an ACC-gated debuff actually stick? Buffs, heals and shields always apply.
 * Floor of 0.15 mirrors team-constructor — a badly-built champion still contributes something.
 */
export function landRate(tag, champ, tagMeta, accFloor) {
  const meta = tagMeta?.[tag];
  const gated = meta?.is_debuff && !meta?.bypasses_accuracy_check;
  if (!gated || !accFloor) return 1;
  const acc = champ.estimated_stats?.acc ?? champ.acc ?? 0;
  return Math.max(0.15, Math.min(1, acc / accFloor));
}

/**
 * How much of `tag` this champion actually DELIVERS, 0..1.
 * SCOPE (Mike, 2026-07-18): a self-only effect protects one seat where a team-wide one protects five,
 * so it is worth ~0.2 of the team-wide equivalent. This is what correctly discounts Gnut's 1.39M of
 * SELF-healing (the team died sooner with him) without anyone having to catch it by hand.
 */
export const SELF_SCOPE = 0.2;

export function tagDelivery(tag, champ, skillRows, tagMeta, { accFloor = null, assumeBooked = false } = {}) {
  const up = tagUptime(tag, skillRows, { assumeBooked });
  const ch = tagChance(tag, skillRows);
  const lr = landRate(tag, champ, tagMeta, accFloor);
  return { uptime: up, chance: ch, land: lr, delivery: up * ch * lr };
}
