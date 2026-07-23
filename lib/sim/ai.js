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

/**
 * WHEN does a passive fire? A passive is never CAST (pickSkill skips it), but its effects still have
 * to land at the right trigger. v0 recognises the three we can place faithfully:
 *   startOfTurn   — "...at the start of each turn" (self-buff renewal)
 *   startOfRound  — "...at the start of each Round" (Ezio's [Perfect Veil]). The sim has no explicit
 *                   round concept, so the engine fires these at BATTLE START and again each turn — a
 *                   2-turn buff re-upped that often is effectively permanent, which matches reality
 *                   (Ezio is untargetable ~all fight). Approximation, flagged here not hidden.
 *   startOfBattle — "at the start of the battle ..."
 * Every other real trigger (on-hit, on-death, on-crit, on-kill) returns null — the engine FLAGS such a
 * passive as unmodelled rather than firing it at a guessed moment. Match the mechanic, not the word.
 */
export function classifyPassiveTrigger(text) {
  const t = String(text ?? '');
  if (/(?:start|beginning) of (?:each |their |this Champion'?s |the )?turn/i.test(t)) return 'startOfTurn';
  if (/(?:start|beginning) of (?:each |the )?round/i.test(t)) return 'startOfRound';
  if (/(?:start|beginning) of (?:the )?battle/i.test(t)) return 'startOfBattle';
  // onAttacked: fires when an ENEMY attacks this Champion, placing a debuff ON THE ATTACKER
  // (Pelops' Master of Games -> [HP Burn] on every mob that hits him — the mob-kill engine).
  if (/(?:whenever|when|each time) (?:an enemy attacks this Champion|this Champion is attacked)/i.test(t)) return 'onAttacked';
  return null;
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

/** Lifesteal fraction from a build's gear_sets (the observed-build carries them as strings, e.g.
 *  "Lifesteal (4-set: heals 30% of damage dealt)"). A 4-set is required; returns 0 otherwise. */
export function gearLifesteal(gearSets = []) {
  for (const g of gearSets) { const m = String(g).match(/lifesteal[^%]*?(\d+)%/i); if (m || /lifesteal/i.test(String(g))) return (m ? +m[1] : 30) / 100; }
  return 0;
}

export function readSkillKit(rows = []) {
  const out = [];
  for (const r of rows) {
    const t = r.skill_summary ?? '';
    const slot = String(r.slot ?? '').toUpperCase();
    if (!slot) continue;

    // TAG POLICIES #16 / #19, re-learned the hard way: a [Bracket] after "ignore" / "remove" /
    // "steal" is NOT something this skill places. Ezio's A3 "will ignore ... [Shield] and
    // [Strengthen] buffs" was being read as Ezio CASTING a shield, 100 times per suite run.
    // Strip those clauses before any bracket matching.
    let placeable = t.replace(/(?:will +)?(?:ignores?|removes?|steals?|strips?)[^.]*[.]/gi, ' ');
    // TAG POLICY #20: a [Bracket] inside a self-CONDITION ("...cannot be resisted if this Champion is
    // under a [Veil] or [Perfect Veil] buff") is a PREREQUISITE, not a placement. Without this, Ezio's
    // A1/A2/A3 each "place" [Perfect Veil] on the whole team off their own condition clause — which then
    // TRIPS the all-veiled "no cover" fallback and re-exposes him. Strip the condition before matching.
    placeable = placeable.replace(/(?:if|while|when)[^.]*?under (?:a |an )?\[[^\]]+\](?:\s*(?:or|and)\s*\[[^\]]+\])*\s*buffs?/gi, ' ');

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
      [/\[Magma Shield\]/i, 'Magma Shield'], [/(\d+)%\s*\[Continuous Heal\]/i, 'Continuous Heal'],
      [/\[Taunt\]/i, 'Taunt'], [/\[Perfect Veil\]/i, 'Perfect Veil'], [/\[Counterattack\]/i, 'Counterattack'],
      [/(\d+)%\s*\[Ally Protection\]/i, 'Ally Protection'],
    ]) { const m = placeable.match(re); if (m) buffs.push({ type, value: num(m[1]) ?? null, turns: 2, self: /on this Champion/i.test(t) && !/all allies/i.test(t) }); }
    // PER-BUFF RECIPIENT: a composite skill can buff DIFFERENT recipients per buff — Pelops A3 shields
    // ALL allies but taunts only THIS Champion. Refine each buff's `self` from the "on X" clause nearest
    // its own bracket, overriding the whole-skill guess above (else his Taunt lands on the whole team).
    for (const b of buffs) {
      const esc = b.type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const near = t.match(new RegExp('\\[' + esc + '\\][^.]{0,45}?on (this Champion|all allies|a target ally|an ally)', 'i'));
      if (near) b.self = /this Champion/i.test(near[1]);
    }
    // SHIELD SIZE. "[Shield] buff ... equal to 30% of this Champion's MAX HP" — the pool scales off
    // the CASTER, so gearing the shielder raises the whole team's effective HP. Stored as a fraction
    // and multiplied by the caster's maxHp at cast time (engine.applySkill).
    const shieldPct = t.match(/equal to (\d+)%\s*of this Champion[’']?s MAX HP/i)
                   ?? t.match(/\[(?:Magma )?Shield\][^.]{0,60}?(\d+)%\s*of this Champion[’']?s MAX HP/i);
    if (shieldPct) for (const b of buffs) if (/Shield/.test(b.type)) b.pctOfCasterMaxHp = +shieldPct[1] / 100;

    // debuffs placed on ENEMIES
    const debuffs = [];
    for (const [re, type, extra] of [
      [/(\d+)%\s*\[Decrease DEF\]/i, 'Decrease Defense', {}],
      [/(\d+)%\s*\[Decrease ATK\]/i, 'Decrease Attack', {}],
      [/(\d+)%\s*\[Weaken\]/i, 'Weaken', {}],
      [/(\d+)%\s*\[Poison\]/i, 'Poison', { stacking: true, maxStacks: 10 }],
      [/\[HP Burn\]/i, 'HP Burn', { maxStacks: 1 }],
    ]) { const m = placeable.match(re); if (m) debuffs.push({ type, pct: type === 'Poison' ? (num(m[1]) ?? 5) / 100 : null, value: num(m[1]), turns: 2, ...extra }); }

    // PASSIVES ARE NOT CASTABLE ACTIONS. Marked here because slot strings sort badly:
    // "PASSIVE" > "A4" > "A3" alphabetically, so a descending sort picks the passive FIRST and
    // — having no cooldown — it wins every turn forever. That bug made every champion do nothing
    // for an entire battle while the boss sat at 100%. Detected by slot or the "[P]" name suffix
    // (Tagoar's passive is in slot A4, so slot alone is not enough).
    const isPassive = /passive/i.test(slot) || /\[P\]\s*$/.test(String(r.skill_name ?? '').trim());
    // WHEN the passive's effects land (the passive-trigger system). A passive is not cast, but its
    // buffs still have to land at the right moment — see engine.firePassives. null = a trigger we
    // cannot yet read (on-hit / on-death / on-crit / every-round); the engine FLAGs those rather than
    // firing them at a guessed time.
    const passiveTrigger = isPassive ? classifyPassiveTrigger(t) : null;

    // multiplier_type: the DB COLUMN is the authority for the scaling stat (Vergis is stored as
    // damage_multiplier '3.9' + multiplier_type 'DEF'); parseCoeff's text-embedded stat is only a
    // fallback for rows that pack it into the value string. Column → text → ATK default.
    const cc = parseCoeff(r.damage_multiplier);
    const maxHpPct = parseMaxHpPct(r.damage_multiplier, r.multiplier_type);   // %-of-target-MAX-HP nuke (DEF-independent)
    const mtStat = normStat(r.multiplier_type);                              // the COLUMN is the authority for the scaling stat
    // multiplier_type overrides the stat ONLY for a bare-number formula (Vergis '3.9' + 'DEF'); an
    // embedded-stat formula ("2.5 ATK + 0.2 HP") carries its own per-term stats and keeps them.
    let coeffTerms = maxHpPct != null ? null : (cc?.terms ?? null);
    if (coeffTerms && cc.bareNumber && mtStat) coeffTerms = coeffTerms.map(tm => ({ ...tm, stat: mtStat }));
    const s = {
      slot, name: r.skill_name, isPassive, passiveTrigger, cooldown: num(r.cooldown_base) ?? 0, cdLeft: 0,
      coeff: maxHpPct != null ? null : (cc?.value ?? null),                   // a pure %maxHP skill has no attacker-scaling coeff
      coeffStat: mtStat ?? cc?.stat ?? 'atk',
      coeffTerms,                                                             // full stat-sum; the engine sums these, single-coeff callers ignore it
      perTargetDebuff: maxHpPct != null ? null : (cc?.perTargetDebuff ?? null),
      maxHpPct,
      hitsEnemies, aoe, revives, cleanses,
      healPct: healMatch ? +healMatch[1] / 100 : null,
      aoeHeal: /heals? all allies/i.test(t),
      buffs, debuffs,
      unread: [],
    };
    // A PASSIVE that "attacks" with no stated multiplier deals its damage with the DEFAULT skill (A1)
    // — that is Raid convention (e.g. Thor's Sky Rupture proc). So a coeff-less passive is NOT a
    // missing-data gap; only an ACTIVE enemy-hitting skill without a coefficient is. (Passives are never
    // cast anyway — pickSkill skips them — so this changes reporting, not combat.)
    if (s.hitsEnemies && s.coeff == null && maxHpPct == null && !isPassive) s.unread.push('damage_multiplier');
    if (/Enemy\s*MAX\s*HP/i.test(String(r.damage_multiplier ?? '')) && cc != null) s.unread.push('maxHP+ATK-compound');
    if (cc?.dynamic) s.unread.push('dynamic-coeff');   // static base modelled; dynamic modifier (HP%/buff/dead-allies) flagged, not dropped
    if (/\bexecut|if the target'?s HP is below/i.test(t)) s.unread.push('execute-threshold');
    if (isPassive && !passiveTrigger && (buffs.length || debuffs.length)) s.unread.push('passive-trigger');
    out.push(s);
  }
  return out;
}

/**
 * `damage_multiplier` is free text: "4.65" | "2.5 ATK" | "0.4 HP" | "3.9 DEF" |
 * "0.02 Enemy MAX HP / 2.5 ATK". Returns `{ value, stat }` where `stat ∈ 'atk'|'hp'|'def'` names the
 * ATTACKER'S OWN stat the coefficient scales off (multiplier_type). Default 'atk'.
 *
 * A pure "X Enemy MAX HP" (%maxHP-of-the-TARGET damage) is a DIFFERENT mechanic and is NOT modelled —
 * it returns null so the caller FLAGs a missing coeff rather than mis-reading it as attacker HP. When
 * an ATK term is present in a compound form, it wins (matches the pre-multiplier_type behaviour).
 */
/** Normalise the champion_skills.multiplier_type COLUMN (the authority) to the attacker stat a
 * coefficient scales off. 'ATK'/'HP'/'DEF' → atk/hp/def; anything else (null, 'Enemy MAX HP or ATK',
 * 'formula') → null, so the caller falls back to the text-embedded stat, then the ATK default. Those
 * non-simple types (%maxHP-of-target, formula skills) are separate unimplemented mechanics. */
export function normStat(v) {
  const t = String(v ?? '').trim().toLowerCase();
  return t === 'atk' ? 'atk' : t === 'hp' ? 'hp' : t === 'def' ? 'def' : null;
}

export function parseCoeff(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  // MULTI-TERM: a skill can scale off a SUM of the attacker's stats ("2.5 ATK + 0.2 HP", "4 DEF + 1.2
  // ATK"). Collect every "N STAT" term. A number must sit adjacent to the stat, so "Enemy MAX HP" (no
  // adjacent number) is never mistaken for attacker HP — it is read by parseMaxHpPct instead.
  const terms = [];
  const re = /([\d.]+)\s*(ATK|DEF|SPD|HP)\b/gi;
  let m; while ((m = re.exec(t))) terms.push({ coeff: +m[1], stat: m[2].toLowerCase() });
  // "(A + <dynamic>) STAT" — take the STATIC base A (scaling STAT, default ATK); the dynamic part is
  // flagged below. Covers "(2 + Total Debuff) ATK", "(4.9 + 2 * Current HP%) ATK", "(4 + Dead Allies) * DEF".
  if (!terms.length) { const p = t.match(/\(([\d.]+)\s*[+*][^)]*\)\s*[*x]?\s*(ATK|DEF|SPD|HP)?/i);
    if (p) terms.push({ coeff: +p[1], stat: (p[2] || 'ATK').toLowerCase() }); }
  let bareNumber = false;
  if (!terms.length && /^[\d.]+$/.test(t)) { terms.push({ coeff: +t, stat: 'atk' }); bareNumber = true; }  // bare number defaults to ATK
  // ADDITIVE per-target-debuff bonus: "(2 + Total Debuff) ATK" adds 1×ATK per debuff on the target.
  const perTargetDebuff = /Total Debuff|per debuff|\+\s*(?:the\s*)?(?:number of\s*)?debuffs?\b/i.test(t) ? 1 : null;
  // dynamic modifiers whose STATIC BASE we take but cannot yet fully evaluate — flagged, never silently dropped.
  const dynamic = /Current HP%|\bBuff\b|Dead All|SKILL USED|SPD\s*\/|debuffs on enemy|\bShield\b/i.test(t);
  if (!terms.length && perTargetDebuff == null) return null;       // e.g. pure "0.02 Enemy MAX HP" — read by parseMaxHpPct
  const primary = terms.find(x => x.stat === 'atk') ?? terms[0] ?? { coeff: 0, stat: 'atk' };   // for single-coeff callers
  return { value: primary.coeff, stat: primary.stat, terms, perTargetDebuff, bareNumber, dynamic };
}

// %-of-TARGET-MAX-HP damage ("deals damage equal to X% of the target's MAX HP") — a DIFFERENT mechanic
// from an attacker-scaling coefficient: it is DEF-INDEPENDENT (damage-mechanics.js §1, family
// `enemy_max_hp`) and scales off the DEFENDER, not the attacker. Returns the FRACTION per hit, or null.
// SCOPE: PURE %maxHP only. A compound "0.02 Enemy MAX HP / 2.5 ATK" (whichever-higher) has an ATK term,
// so parseCoeff returns non-null and this yields null — the ATK portion is modelled, the %maxHP portion
// is flagged (readSkillKit `unread: maxHP+ATK-compound`), never double-counted.
const MAXHP_TYPES = new Set(['enemy max hp', 'target max hp', 'max hp', 'maxhp', '%maxhp', '% max hp']);
export function parseMaxHpPct(v, multiplierType) {
  const t = String(v ?? '').trim();
  const mt = String(multiplierType ?? '').trim().toLowerCase();
  if (MAXHP_TYPES.has(mt)) { const m = t.match(/([\d.]+)/); return m ? +m[1] : null; }   // column is the authority
  if (parseCoeff(v) != null) return null;                          // attacker-scaling / compound → not a pure %maxHP nuke
  const m = t.match(/([\d.]+)\s*(?:x\s*)?(?:of\s*)?(?:the\s*)?(?:target'?s?\s*|enemy\s*)?MAX\s*HP/i);
  return m ? +m[1] : null;
}
