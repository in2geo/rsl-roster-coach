-- seeds/2026-08-05_cb_skill_tags.sql — PER-SKILL CB capability tags + magnitude (contribution model, spec §6).
-- Authored from VERBATIM champion_skills.skill_summary (2026-08-05), Xenomorph/Ninja/Coldheart/Narma/Artak/Ezio.
-- Portable: resolves champion/skill/tag by NAME. Idempotent upsert on (champion_id, tag_id, skill_slot).
-- Apply via tools/apply-seed-pooler.mjs.

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 5, 1, 2, null, null, 100, 'approved', 'human_observation', 'Tail Stab: 5% Poison 2t (THREE on crit)', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Xenomorph'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 5, null, 2, null, 'on-attacked', 25, 'approved', 'human_observation', 'Caustic Blood: 5% Poison on attacker 25%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Xenomorph'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 20, null, null, null, 'self-combo(own Poison)', null, 'approved', 'human_observation', 'Caustic Blood: -20% DEF vs poisoned target', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Xenomorph'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 60, null, 2, null, null, 45, 'approved', 'human_observation', 'Shatterbolt: 60% Decrease DEF 2t 45%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Ninja'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, 3, 3, null, 75, 'approved', 'human_observation', 'Hailburn: 3x 75% HP Burn 3t; self-activates HP Burns on bosses', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'HP Burn' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ninja'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, null, null, 'boss', null, 'approved', 'human_observation', 'Hailburn: instantly activates HP Burns on bosses', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Debuff Activation' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ninja'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 100, null, 2, 4, null, 25, 'approved', 'human_observation', 'Flurry of Arrows: 100% Heal Reduction 2t, 4x 25%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Heal Reduction' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Coldheart'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 1, null, null, 30, 'approved', 'human_observation', 'Art of Pain: 50% Decrease ACC 1t 30%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Decrease ACC' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Coldheart'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 5, null, 2, null, 'self-combo(Heal Reduction)', 100, 'approved', 'human_observation', 'Art of Pain: 5% Poison 2t ONLY if Heal Reduction present — conditional afterthought', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Coldheart'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, null, null, null, null, 'approved', 'human_observation', 'Heartseeker: damage scales with enemy MAX HP (CAPPED on Demon Lord by Infernal Resilience)', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Enemy Max HP Damage' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Coldheart'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 100, null, null, null, null, null, 'approved', 'human_observation', 'Heartseeker: 100% TM reduction — DEAD on Demon Lord (TM-immune)', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Decrease Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Coldheart'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 3, null, null, 75, 'approved', 'human_observation', 'Weirding Dance: 50% Decrease ATK 3t 75% + poison-scaling heal', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Narma the Returned'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, null, null, null, null, 'approved', 'human_observation', 'Weirding Dance: heal 15% maxHP +2% per Poison on target', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'AoE Heal' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Narma the Returned'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 5, 3, 3, null, null, 75, 'approved', 'human_observation', 'Toxin Trance: THREE 5% Poison 3t 75%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Narma the Returned'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 25, null, 3, null, null, 75, 'approved', 'human_observation', 'Toxin Trance: 25% Poison Sensitivity 3t 75%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison Sensitivity' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Narma the Returned'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, null, null, 40, 'approved', 'human_observation', 'Hell Crescent: +1t to 3 random debuffs 40%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Increase Debuff Duration' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Narma the Returned'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'Passive', t.id, 5, null, 2, null, 'on-attacked', 25, 'approved', 'human_observation', 'Caustic Rebuttal: 5% Poison on attacker 25/50%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'Passive'
where c.name = 'Narma the Returned'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, null, null, 2, null, null, 75, 'approved', 'human_observation', 'Purifyre: HP Burn 2t 75% (AoE, first hit)', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'HP Burn' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Artak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, null, null, null, null, 'approved', 'human_observation', 'Dogs of War: instantly activates one tick of all HP Burns', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Debuff Activation' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Artak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 50, null, 2, null, null, 75, 'approved', 'human_observation', 'Dogs of War: 50% Decrease ATK 2t 75%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Decrease Attack' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Artak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, null, null, 35, 'approved', 'human_observation', 'Chaosrazor: extend HP Burns +1t 35%', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Increase Debuff Duration' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Artak'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 60, null, 2, null, 'veil-unresistable', 75, 'approved', 'human_observation', 'Eagle Dive: 60% Decrease DEF 2t 75% (unresistable under Veil)', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Decrease Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Ezio Auditore'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 5, 2, 2, null, null, 75, 'approved', 'human_observation', 'Da Vincis Design: two 5% Poison 2t 75% AoE (unresistable under Veil)', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ezio Auditore'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, 25, null, 2, null, null, 75, 'approved', 'human_observation', 'Da Vincis Design: 25% Poison Sensitivity 2t', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Poison Sensitivity' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ezio Auditore'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, null, null, '4+ debuffs', null, 'approved', 'human_observation', 'Da Vincis Design: instantly activates all Poison on enemies under 4+ debuffs', 'cb-skill-tags-2026-08-05', 'cb-skill-tags-2026-08-05', now()
from champions c join tags t on t.name = 'Debuff Activation' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Ezio Auditore'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, source_note=excluded.source_note, status=excluded.status;

