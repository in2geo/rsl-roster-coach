-- seeds/2026-08-06_cb_skill_tags_roster.sql
-- Per-skill CB capability tags for the top-~25-by-usage CB roster (Archetype Selector critical path).
-- Authored from VERBATIM champion_skills.skill_summary (2026-08-06), applying the CLAUDE.md tag policies +
-- magnitude, LLM-drafted (5 parallel agents) then reviewed against source. Extends 2026-08-05_cb_skill_tags.sql
-- (Xenomorph/Ninja/Coldheart/Narma/Artak/Ezio). Idempotent upsert on (champion_id, tag_id, skill_slot).
--
-- NOTES: (1) chance_unbooked holds the STATED (booked/max) chance from the skill text — unbooked back-calc
-- deferred (no per-skill book-progression data); acceptable for a selection pruner, flag before any exact use.
-- (2) self-only effects carry condition 'self...' so the capability layer applies SELF_SCOPE (0.2).
-- (3) DROPPED Staltus Dragonbane — his DB skill_summary is PARAPHRASED not verbatim (generic skill names,
-- 'conditional' with no numbers) = a Morag-class mis-capture; needs a Tier-1 re-capture before tagging.
-- Apply via tools/apply-seed-pooler.mjs.

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 2, null, 100, 'approved', 'human_observation', 'Attacks 1 enemy 2 times', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 50, null, 2, null, 'on crit; self', 100, 'approved', 'human_observation', '50% Increase ATK on this Champion if either hit crit', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 60, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance 60% Decrease DEF 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance 50% Decrease ATK 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance Leech 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Leech' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, 2, null, 'self', 100, 'approved', 'human_observation', 'Taunt on this Champion 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Taunt' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A4', t.id, null, null, null, null, 'ally turtles join', 100, 'approved', 'human_observation', 'ally Leonardos/Donatellos/Michelangelos/Raphaels join the attack', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Ally Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A4'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A4', t.id, 300, null, 1, null, 'self; on hit', 100, 'approved', 'human_observation', 'Shield = 300% ATK on this Champion when hit', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'A4'
where c.name = 'Michelangelo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, 2, null, null, 35, 'approved', 'human_observation', '35% chance Leech 2t (+5%/enemy)', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Leech' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 60, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance 60% Decrease DEF 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'removes Heal Reduction + 1 random debuff from all allies', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Cleanse' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 20, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'heals all allies 20% of MAX HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, null, null, 'if all allies dead', 100, 'approved', 'human_observation', 'if all allies dead revives with 50% HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Revive' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, null, null, 'revived allies', 100, 'approved', 'human_observation', 'fills revived Turn Meters 50%', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 30, null, 1, null, 'self; last ally killed', 100, 'approved', 'human_observation', '30% Increase SPD on last-ally-killed', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, null, null, 1, null, 'self; last ally killed', 100, 'approved', 'human_observation', 'Block Damage on last-ally-killed', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Block Damage' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Uugo'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 50, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance 50% Decrease ATK 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Pelops the Victor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase ATK all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Pelops the Victor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 2, null, 'all allies; 30% MAX HP', 100, 'approved', 'human_observation', 'Magma Shield all allies = 30% MAX HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Magma Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Pelops the Victor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, 2, null, 'self', 100, 'approved', 'human_observation', 'Taunt on this Champion 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Taunt' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Pelops the Victor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, null, null, 2, null, 'when enemy attacks this champ', 100, 'approved', 'human_observation', '100% HP Burn on attacker 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'HP Burn' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Pelops the Victor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 2, null, 100, 'approved', 'human_observation', 'Attacks 1 enemy 2 times', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Tagoar'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 60, null, 2, null, 'ally lowest HP', 100, 'approved', 'human_observation', '60% Increase DEF on lowest-HP ally 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Tagoar'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '30% Increase SPD all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Tagoar'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 15, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'heals all allies 15% MAX HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Tagoar'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, null, null, 'all dead allies', 100, 'approved', 'human_observation', 'revives all dead allies 30% HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Revive' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Tagoar'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 20, null, 2, null, 'all allies; 20% MAX HP', 100, 'approved', 'human_observation', 'Shield all allies = 20% MAX HP 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Tagoar'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, null, '1 random Argonite ally', 100, 'approved', 'human_observation', 'attacks with 1 random Argonites ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Ally Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 10, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'heals all allies 10% MAX HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'removes all debuffs from all allies', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Cleanse' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, 2, null, 'all allies', 100, 'approved', 'human_observation', 'Block Debuffs all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Block Debuffs' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, 2, null, 'all allies', 100, 'approved', 'human_observation', 'Fervor all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Fervor' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, null, null, 'all dead allies', 100, 'approved', 'human_observation', 'revives all dead allies 50% HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Revive' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, null, null, 'revived allies', 100, 'approved', 'human_observation', 'revived allies 50% Turn Meter', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '30% Increase SPD all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 20, null, 1, null, 'ally on receiving debuff', 100, 'approved', 'human_observation', 'Shield 20% MAX HP on ally receiving a debuff', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 15, null, null, null, 'all allies; end of turn', 100, 'approved', 'human_observation', 'fills all allies Turn Meter 15% end of turn', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Glorious Pallas'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 2, null, 100, 'approved', 'human_observation', 'Attacks 1 enemy 2 times', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Duchess Lilitu'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 10, null, 2, null, 'self + lowest-HP ally', 100, 'approved', 'human_observation', 'Shield 10% MAX HP self + lowest ally 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Duchess Lilitu'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, 2, null, 'all allies', 100, 'approved', 'human_observation', 'Block Debuffs all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Block Debuffs' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Duchess Lilitu'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase ATK all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Duchess Lilitu'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 70, null, null, null, 'all dead allies', 100, 'approved', 'human_observation', 'revives all dead allies 70% HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Revive' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Duchess Lilitu'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 15, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '15% Continuous Heal all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Continuous Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Duchess Lilitu'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 5, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'heals all allies 5% MAX HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Donatello'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '30% Increase SPD all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Donatello'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'removes all debuffs from all allies', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Cleanse' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Donatello'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 15, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '15% Continuous Heal all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Continuous Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Donatello'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 20, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'fills all allies Turn Meter 20%', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Donatello'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A4', t.id, null, null, null, null, 'turtles join', 100, 'approved', 'human_observation', 'ally turtles join the attack', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Ally Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A4'
where c.name = 'Donatello'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, 2, null, 'if any buff stolen', 100, 'approved', 'human_observation', 'Block Debuffs all allies 2t if a buff stolen', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Block Debuffs' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Madame Serris'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, 'all enemies', 100, 'approved', 'human_observation', '50% Decrease ATK all enemies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Madame Serris'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 60, null, 2, null, 'all enemies', 100, 'approved', 'human_observation', '60% Decrease DEF all enemies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Madame Serris'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 10, null, null, null, 'self; start of turn', 100, 'approved', 'human_observation', 'Shield 10% MAX HP self each turn', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Madame Serris'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, 2, null, 'random ally', 100, 'approved', 'human_observation', 'Fervor 2t on a random ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Fervor' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Mavara the Web Diviner'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, null, 'self-combo(own Fervor)', 50, 'approved', 'human_observation', 'Fervor allies 50% join Fervor allies attacks', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Ally Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Mavara the Web Diviner'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase RES all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase RES' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Mavara the Web Diviner'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, null, null, 'an ally', 100, 'approved', 'human_observation', 'revives an ally 50% HP 50% TM', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Revive' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Mavara the Web Diviner'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, 2, null, 'self', 100, 'approved', 'human_observation', 'Unkillable on this Champion 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Unkillable' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Mavara the Web Diviner'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A4', t.id, 20, null, null, null, 'per 8 enemy buffs', 100, 'approved', 'human_observation', 'per 8 enemy buffs +20% ally TM', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A4'
where c.name = 'Mavara the Web Diviner'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A4', t.id, 20, null, null, null, 'per 16 ally buffs', 100, 'approved', 'human_observation', 'per 16 ally buffs heal all 20% MAX HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A4'
where c.name = 'Mavara the Web Diviner'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 2.5, 1, 2, null, null, 80, 'approved', 'human_observation', '80% chance 2.5% Poison 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Kael'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 25, null, null, null, 'self, per enemy killed', 100, 'approved', 'human_observation', 'self +25% TM per enemy killed', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Kael'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 5, 1, 2, null, null, 40, 'approved', 'human_observation', '40% chance 5% Poison 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Kael'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 2, null, 100, 'approved', 'human_observation', 'Attacks 1 enemy 2 times', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Seeker'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'fills all allies Turn Meter 30%', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Seeker'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase ATK all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Seeker'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 20, null, null, null, 'self; on crit hit taken', 100, 'approved', 'human_observation', 'heals self 20% when hit by crit', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Healer' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Seeker'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 60, null, 2, null, 'all allies; on crit hit taken', 100, 'approved', 'human_observation', '60% Increase DEF all allies when hit by crit', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Seeker'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 30, null, 2, null, null, 25, 'approved', 'human_observation', '25% chance 30% Decrease SPD 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'High Khatun'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 15, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'fills all allies TM 15%', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'High Khatun'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '30% Increase SPD all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'High Khatun'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 3, null, 100, 'approved', 'human_observation', 'Attacks 1 enemy 3 times', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Ruella'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 60, null, 2, null, 'per hit', 50, 'approved', 'human_observation', 'each hit 50% chance 60% Decrease DEF 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ruella'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 25, null, 2, null, 'per hit', 50, 'approved', 'human_observation', 'each hit 50% chance 25% Weaken 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Weaken' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ruella'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 2, null, 'per hit', 50, 'approved', 'human_observation', 'each hit 50% chance 30% Decrease SPD 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ruella'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 20, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'fills all allies TM 20%', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Ruella'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '30% Increase C.RATE all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase C.Rate' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Ruella'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 25, null, 2, null, 'target Boss/Corrupted/minion (applies vs CB)', 50, 'approved', 'human_observation', '50% chance 25% Weaken 2t vs Boss/Corrupted/minion', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Weaken' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Tholin Foulbeard'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 5, 5, null, null, 'stacks up to 25%', 100, 'approved', 'human_observation', 'each hit -5% target ATK (stacks to 25%)', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Tholin Foulbeard'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 5, 10, null, null, 'self; stacks up to 50%', 100, 'approved', 'human_observation', 'each hit +5% own ATK (stacks to 50%)', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Tholin Foulbeard'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, 'self', 100, 'approved', 'human_observation', '50% Increase ATK on this Champion 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Tholin Foulbeard'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 30, null, 2, null, null, 30, 'approved', 'human_observation', '30% chance 30% Decrease SPD 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Tuhanarak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 15, null, 1, null, 'ally lowest HP', 100, 'approved', 'human_observation', '15% Continuous Heal 1t on lowest-HP ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Continuous Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Tuhanarak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance 50% Decrease ATK 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Tuhanarak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 60, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '60% Increase DEF all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Tuhanarak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '30% Increase SPD all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Tuhanarak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, null, null, null, null, 'all allies; start of turn', 100, 'approved', 'human_observation', 'removes 1 debuff all allies each turn (2 under Cont Heal)', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Cleanse' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Tuhanarak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 2, null, 100, 'approved', 'human_observation', 'Attacks 1 enemy 2 times', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Fayne'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 5, 2, 2, null, null, 75, 'approved', 'human_observation', '75% chance two 5% Poison 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Fayne'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance 50% Decrease ATK 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Fayne'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 60, null, 3, null, 'first hit', 75, 'approved', 'human_observation', 'first hit 75% chance 60% Decrease DEF 3t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Fayne'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 25, null, 3, null, 'second hit', 75, 'approved', 'human_observation', 'second hit 75% chance 25% Weaken 3t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Weaken' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Fayne'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 30, null, 2, null, null, 75, 'approved', 'human_observation', '75% chance 30% Decrease SPD 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Bambus'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 2, null, 'all allies; 30% MAX HP', 100, 'approved', 'human_observation', 'Shield all allies = 30% MAX HP 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Bambus'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase ACC all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase ACC' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Bambus'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase ATK all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Bambus'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, 'all enemies', 75, 'approved', 'human_observation', '75% chance 50% Decrease ACC all enemies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease ACC' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Bambus'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 2, null, 'vs Boss', 75, 'approved', 'human_observation', '75% chance 50% Decrease ATK on Bosses 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Bambus'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase ATK all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Spirithost'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'removes all debuffs all allies', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Cleanse' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Spirithost'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, 1, null, 'all allies', 100, 'approved', 'human_observation', 'Block Debuffs all allies 1t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Block Debuffs' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Spirithost'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 30, null, 2, null, 'random ally', 40, 'approved', 'human_observation', '40% chance 30% Reflect Damage 2t random ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Reflect Damage' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 15, null, 3, null, 'target ally', 100, 'approved', 'human_observation', '15% Continuous Heal 3t target ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Continuous Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 3, null, 'target ally', 100, 'approved', 'human_observation', '30% Increase SPD 3t target ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 3, null, 'target ally', 100, 'approved', 'human_observation', '30% Reflect Damage 3t target ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Reflect Damage' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'all allies except self', 100, 'approved', 'human_observation', '50% Ally Protection all allies except self 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Ally Protection' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 60, null, 2, null, 'self', 100, 'approved', 'human_observation', '60% Increase DEF self 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 10, null, 2, null, 'self; on big hit', 100, 'approved', 'human_observation', 'Shield 10% MAX HP self on losing 10%+ HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Shield' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 15, null, 2, null, 'self; below 50% HP', 100, 'approved', 'human_observation', '15% Continuous Heal self when HP<50%', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Continuous Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Vergis'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 2, null, 100, 'approved', 'human_observation', 'Attacks 1 enemy 2 times', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Alice'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, null, null, 'ignores 20% DEF', 100, 'approved', 'human_observation', 'Attacks 1 enemy, ignore 20% DEF', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Single Target Damage' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Alice'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 5, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'heals all allies 5% MAX HP', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Iudex Artor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'all allies', 100, 'approved', 'human_observation', '50% Increase ATK all allies 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Iudex Artor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 15, null, null, null, 'all allies', 100, 'approved', 'human_observation', 'fills all allies TM 15%', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Iudex Artor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, null, null, 'an ally', 100, 'approved', 'human_observation', 'revives an ally 50% HP 50% TM', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Revive' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Iudex Artor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 50, null, 1, null, 'revived ally', 100, 'approved', 'human_observation', '50% Increase ATK 1t on revived ally', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Iudex Artor'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'all allies except self', 100, 'approved', 'human_observation', '50% Ally Protection all allies except self 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Ally Protection' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Visix'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, 1, null, 'self', 100, 'approved', 'human_observation', 'Taunt on this Champion 1t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Taunt' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Visix'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 2, null, null, 100, 'approved', 'human_observation', '30% Decrease SPD 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Visix'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 10, null, null, null, 'self; start of turn', 100, 'approved', 'human_observation', 'heals self 10% MAX HP each turn', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Healer' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Visix'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 60, null, 2, null, null, 40, 'approved', 'human_observation', '40% chance 60% Decrease DEF 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Fahrakin the Fat'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, 1, 2, null, null, 75, 'approved', 'human_observation', '75% chance HP Burn 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'HP Burn' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Fahrakin the Fat'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 5, 2, 2, null, null, 75, 'approved', 'human_observation', '75% chance two 5% Poison 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Fahrakin the Fat'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 3, null, 'all allies except self', 100, 'approved', 'human_observation', '30% Increase C.RATE all allies except self 3t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase C.Rate' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Fahrakin the Fat'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 3, null, 'all allies except self', 100, 'approved', 'human_observation', '30% Increase C.DMG all allies except self 3t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase C.DMG' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Fahrakin the Fat'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, null, null, 'all allies except self', 100, 'approved', 'human_observation', 'all allies except self attack 1 target', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Ally Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Fahrakin the Fat'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 30, null, null, null, null, 100, 'approved', 'human_observation', 'destroys target MAX HP by 30% of damage', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Enemy Max HP Damage' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Dark Elhain'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, 'self', 100, 'approved', 'human_observation', '50% Increase ATK self 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Dark Elhain'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 30, null, 2, null, null, 50, 'approved', 'human_observation', '50% chance 30% Decrease SPD 2t', 'cb-roster-tags-2026-08-06', 'cb-roster-tags-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Dark Elhain'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

