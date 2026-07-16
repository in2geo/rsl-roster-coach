-- ============================================================================
-- Seed 144 — Debuff Activation / Buff Activation (Tag Review Policy #12, revised)
--
-- WHY: policy #12 said only "activates [X] debuffs → REJECT. Not a placement."
-- That is CORRECT (forcing a [Poison] to tick early does not mean you PLACE
-- Poison) but it DISCARDED the capability instead of relocating it — so the
-- activation ability was invisible to the engine for 32 champions. An untagged
-- ability is an invisible path (INS-0027), the same failure that hid Michelangelo
-- from the DAMAGE problem (seed 140) and TM-lock from Spider/Ice Golem.
--
-- Policy #19 already solved this shape for buff-strip: REJECT the false
-- placement, then TAG THE REAL ACTION (Buff Strip / Steal Buffs). #12 never got
-- its second half. This seed is that second half. CLAUDE.md policy #12 is
-- revised in the same commit; glossary entries land in data/keyword-glossary.json
-- (misc, beside the Debuff Spread / Buff Spread pair they mirror).
--
-- TWO TAGS, SPLIT BY SIDE (the #19 boundary rule, mirrored) — deliberately NOT
-- merged, because one is damage and the other is sustain, and a single tag would
-- let the engine credit a healer for damage:
--   • Debuff Activation — enemy DoT ([Poison]/[HP Burn]/[Necrosis]) ticks now.
--   • Buff Activation   — ally [Continuous Heal] ticks now.
--
-- NOT the neighbours: Poison Explosion DETONATES/consumes for %maxHP burst;
-- Poison Sensitivity AMPLIFIES each tick; Increase Debuff Duration EXTENDS.
-- Activation forces an early tick of what is already there.
--
-- WHY IT MATTERS (general, not per-team): the Clan Boss 10-debuff cap binds ONLY
-- when a team has NO activator — with one, the stack is cashed in before it can
-- saturate. So "cap your poison stackers" is right for one team and wrong for
-- another. That is a TEAM-level resolution (INS-0010 Layer 2, SATURATION), and
-- it is unreachable while the capability has no tag at all.
--
-- SCOPE / HONESTY:
--   • Derived from LIVE champion_skills.skill_summary matching 'instantly activat*'
--     (67 skills). Generated, not hand-typed.
--   • 28 enemy-side + 4 ally-side champions seeded below.
--   • 31 champions matched 'instantly activat*' but NO [bracket] was resolvable
--     from the clause (other phrasings / passive triggers). They are NOT seeded —
--     they need a human read. List: knowledge/activation-unclassified.txt.
--   • A bare scan for 'activat*' returns ~150 skills; ~83 of those are trigger
--     prose ("[Passive Effect] activates when…"), NOT the mechanic. Matching the
--     word instead of the mechanic is exactly the bracket-scraper error class
--     (policies #16-#19). Hence the narrower 'instantly activat*' match.
--
-- STATUS: proposed. No auto-merge — the engine reads approved-only.
-- REPLAY-SAFE: every insert guards with NOT EXISTS on (champion, tag).
-- ============================================================================

-- ── Vocabulary ──────────────────────────────────────────────────────────────
insert into tags (name, description, game_id, is_debuff, bypasses_accuracy_check)
select 'Debuff Activation',
       'Forces existing ENEMY damage-over-time debuffs ([Poison]/[HP Burn]/[Necrosis]) to tick IMMEDIATELY, out of turn. Damage ACCELERATION, not creation: realises DoT that was already placed, sooner — and by cashing the stack in, relieves enemy debuff-slot pressure (the CB 10-debuff cap binds only without an activator). DEF-INDEPENDENT (%maxHP, damage-mechanics §1). NOT Poison Explosion (detonates/consumes for burst), NOT Poison Sensitivity (amplifies ticks), NOT Increase Debuff Duration (extends).',
       'raid_shadow_legends', false, false
where not exists (select 1 from tags where name='Debuff Activation' and game_id='raid_shadow_legends');

insert into tags (name, description, game_id, is_debuff, bypasses_accuracy_check)
select 'Buff Activation',
       'Forces an existing ALLY buff ([Continuous Heal]) to tick IMMEDIATELY, out of turn. SUSTAIN acceleration — the ally-side mirror of Debuff Activation, as Buff Spread mirrors Debuff Spread. Value is turns-of-survival, not damage; sustain is multiplicative (damage-mechanics §3), and an on-demand heal answers burst that a start-of-turn tick would arrive too late for.',
       'raid_shadow_legends', false, false
where not exists (select 1 from tags where name='Buff Activation' and game_id='raid_shadow_legends');

-- ── Champion rows (generated from live skill_summary) ───────────────────────
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Alaz' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A3 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Aphidus' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Artak' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Ashnar Dragonsoul' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Balar' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Bladechorister Caldor' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A3 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Cinda' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Crohnam' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A1 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Dark Kael' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): Passive (Necrosis). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Embrys' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Ezio Auditore' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A1 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Frenzi the Cackler' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Gizmak' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A1 (Poison), A3 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Kosk' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Myciliac Priest Orn' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Nell' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Ninja' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A3 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Polara Fireheart' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): Passive (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Searsha' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Sicia' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Stokk' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Sulfuryion' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A2 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Supreme Galek' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A1 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Talenna' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A3 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Taya' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A3 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Teodor the Savant' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A1 (Poison). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Vizug' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces existing enemy DoTs to tick immediately (damage acceleration). Skill(s): A1 (HP Burn). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Walking Tomb Dreng' and t.name='Debuff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces an ally [Continuous Heal] to tick immediately (sustain acceleration). Skill(s): A1 (Continuous Heal). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Donatello' and t.name='Buff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces an ally [Continuous Heal] to tick immediately (sustain acceleration). Skill(s): A1 (Continuous Heal). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Lady of Ireth' and t.name='Buff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces an ally [Continuous Heal] to tick immediately (sustain acceleration). Skill(s): A1 (Continuous Heal). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Senna' and t.name='Buff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation',
  'Forces an ally [Continuous Heal] to tick immediately (sustain acceleration). Skill(s): A2 (Continuous Heal). Policy #12 (revised): activation is NOT a placement — it is its own action.',
  'claude-code-policy12-activation-2026-07-16'
from champions c cross join tags t
where c.game_id='raid_shadow_legends' and c.name='Wythir' and t.name='Buff Activation' and t.game_id='raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id=c.id and x.tag_id=t.id);

