-- ============================================================================
-- 2026-08-07 — Missing champions captured from HellHades (8 of 8) — APPLIED 2026-08-07 (verified live: all 8 resolve, skills+aura present)
--
-- Champions HellHades has that our DB lacked (newer than the 2026-07-13 refresh), surfaced by the
-- alias audit. Skills + aura + cooldowns: HellHades (Tier-2, human-read verbatim). Base stats: in-game
-- Index screenshots (Mike) — every base_hp validated as a multiple of 15. Identity (rarity/role/faction/
-- affinity): in-game screenshots. skill verification_status='proposed' (HUMAN REVIEW). new C-IDs assigned.
--
-- DEFERRED: (1) Heinrik Demondoom is a TRANSFORMING champion — only his BASE form is here; his Alternate
-- Form skills need an in-game capture. (2) champion_tags — generate from skill_summary per the tag policy
-- (separate pass, human-reviewed).
-- Apply via tools/apply-seed-pooler.mjs AFTER review.
-- ============================================================================
begin;

-- ── Heinrik Demondoom  (Mythical / Spirit / Defense / Sacred Order)  C000936  [TRANSFORMING — base form only]
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Heinrik Demondoom', 'Sacred Order', 'Spirit', 'Mythical', 'Defense', 19980, 936, 1586, 105, 15, 50, 50, 20, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Heinrik Demondoom');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000936-A1', 'A1', 'Sanctified Mace', 'Attacks 1 enemy 2 times. Each hit decreases the target''s Turn Meter by 10%. Each hit will decrease the target''s Turn Meter by 20% instead if the target is under a [Stun], [Sleep], [Sheep], [Fear], [True Fear], [Provoke], [Freeze] or [Petrification] debuff.', '0', '0', '2.5', 'DEF'),
    ('C000936-A2', 'A2', 'Evil Begone!', 'Attacks all enemies. Places a [Stun] debuff on each enemy for 1 turn, and a 30% [Decrease SPD] debuff on each enemy for 2 turns. If a target''s Turn Meter is equal to or greater than 50%, these debuffs will ignore [Block Debuffs] buffs.', '4', '3', '5', 'DEF'),
    ('C000936-A3', 'A3', 'Hateful Orator', 'Places a 30% [Increase SPD] buff and a 50% [Increase ACC] buff on all allies for 2 turns. Steals 50% of each enemy''s Turn Meter.', '4', '3', null, null),
    ('C000936-A4', 'A4', 'Metamorph', 'Transforms this Champion into their Alternate Form. Then grants an Extra Turn.', '4', '4', null, null),
    ('C000936-Passive', 'Passive', 'Renewed Purpose [P]', 'Whenever an enemy receives a [Stun], [Sleep], [Sheep], [Fear], [True Fear], [Provoke], [Freeze] or [Petrification] debuff, fills this Champion''s Turn Meter by 10%. Whenever an ally attacks an enemy under a [Stun], [Sleep], [Sheep], [Fear], [True Fear], [Provoke], [Freeze] or [Petrification] debuff, also fills that ally''s Turn Meter by 10%.', null, null, null, null)
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Heinrik Demondoom'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000936-AURA', 'SPD', '25%', 'All Battles', null, 'Increases Ally SPD in All Battles by 25%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Heinrik Demondoom'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Heinrik Demondoom');

-- ── Haggibah the Nestmaid  (Legendary / Force / HP / Dark Elves)  C000937
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Haggibah the Nestmaid', 'Dark Elves', 'Force', 'Legendary', 'HP', 23955, 705, 1277, 103, 15, 50, 30, 20, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Haggibah the Nestmaid');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000937-A1', 'A1', 'Blast Of Purification', 'Attacks 1 enemy. Has a 75% chance of placing a [HP Burn] debuff for 2 turns. Then places a [Perfect Veil] buff on this Champion for 1 turn.', '0', '0', '0.25', 'HP'),
    ('C000937-A2', 'A2', 'Insidious Eruption', 'Attacks all enemies. Instantly detonates all [Bomb] debuffs and activates one tick of all [HP Burn] debuffs on all enemies. Has a 75% chance of placing a [Leech] debuff for 2 turns.', '4', '3', '0.28', 'HP'),
    ('C000937-A3', 'A3', 'Larval Consumption', 'Steals all buffs from all enemies. Then has a 75% chance of placing two [Bomb] debuffs on all enemies that detonate after 2 turns. Will place [Bomb] debuffs that detonate after 1 turn instead against enemies with no buffs.', '4', '3', '0.32', 'HP'),
    ('C000937-Passive', 'Passive', 'Insect Lord''s Vessel [P]', 'This Champion is immune to [HP Burn] and [Bomb] debuffs, and will not receive any damage from [HP Burn] debuffs. Whenever an enemy tries to place a [Stun], [Freeze], [Sleep], [Provoke], [Fear], [True Fear], or [Petrification] debuff on this Champion or increase the cooldown of their skills, places a [Bomb] debuff on that enemy that detonates after 1 turn. These debuffs will ignore any [Block Debuffs] buffs.', null, null, '0.32', 'HP')
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Haggibah the Nestmaid'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000937-AURA', 'HP', '30%', 'All Battles', null, 'Increases Ally HP in All Battles by 30%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Haggibah the Nestmaid'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Haggibah the Nestmaid');

-- ── Celendiel the Opal Guardian  (Legendary / Void / Defense / High Elves)  C000938
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Celendiel the Opal Guardian', 'High Elves', 'Void', 'Legendary', 'Defense', 17670, 782, 1619, 98, 15, 63, 40, 0, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Celendiel the Opal Guardian');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000938-A1', 'A1', 'Opal Thrust', 'Attacks 1 enemy. When counterattacking, will repeat this attack against a random enemy. Has a 50% chance of placing a [Stun] debuff for 1 turn. This debuff cannot be resisted.', '0', '0', '3', 'DEF'),
    ('C000938-A2', 'A2', 'Agent Of Light', 'Attacks 1 enemy. Before attacking, places a 60% [Increase DEF] buff on all allies for 2 turns, and a 15% [Shatter] buff on this Champion for 2 turns. Will ignore 25% of the target''s DEF, as well as [Unkillable] and [Block Damage] buffs. Will ignore 50% of the target''s DEF instead, if the target is under any [Increase DEF] or [Strengthen] buffs, [Decrease DEF], [Stun], [Fear] or [True Fear] debuffs.', '5', '3', '4.1', 'DEF'),
    ('C000938-A3', 'A3', 'Eternal Defender', 'Attacks all enemies. Places an extra hit on enemies under any [Increase DEF], [Decrease DEF], [Strengthen], [Stun], [Fear] or [True Fear] debuffs. Will ignore any [Increase DEF] and [Strengthen] buffs. Increases the damage each enemy receives by 5% for each buff and debuff on them. (Stacks up to 100%). Places an [Unkillable] buff on all allies for 1 turn, and a [Counterattack] buff on all allies for 2 turns.', '6', '4', '3.4', 'DEF'),
    ('C000938-Passive', 'Passive', 'Glittering Guardian [P]', '[Passive Effect] This Champion is immune to [Decrease DEF], [Fear], [True Fear] and [Stun] debuffs. [Active Effect] Activates this Champion''s Agent Of Light skill whenever an enemy tries to place a [Decrease DEF], [Fear], [True Fear] or [Stun] debuff on this Champion. Does not set the Agent Of Light skill on cooldown.', null, null, null, null)
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Celendiel the Opal Guardian'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000938-AURA', 'DEF', '33%', 'All Battles', null, 'Increases Ally DEF in All Battles by 33%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Celendiel the Opal Guardian'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Celendiel the Opal Guardian');

-- ── Aria the Golden Hope  (Legendary / Spirit / Defense / Argonites)  C000939
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Aria the Golden Hope', 'Argonites', 'Spirit', 'Legendary', 'Defense', 18000, 760, 1619, 110, 15, 50, 30, 20, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Aria the Golden Hope');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000939-A1', 'A1', 'Blazing Glory', 'Attacks 1 enemy. Has a 75% chance of placing a 100% [Heal Reduction] debuff for 2 turns. [Passive Effect] Activates this skill on an enemy whenever their HP drops below 50%. The 100% [Heal Reduction] debuff cannot be removed, resisted, or blocked when this skill is activated in this way. Occurs once per turn. If there are multiple Champions on the team with this skill, only one will activate. This skill will not activate on duplicate copies of this Champion, if this particular Champion is dead.', '0', '0', '3.3', 'DEF'),
    ('C000939-A2', 'A2', 'Halcyon Boons', 'Attacks all enemies. Before attacking, has a 75% chance of transferring all debuffs from all allies to all enemies. Places a 25% [Fortify] buff and a 25% [Strengthen] buff on all allies for 2 turns.', '4', '3', '3.5', 'DEF'),
    ('C000939-A3', 'A3', 'Avatar Of Victory', 'Attacks all enemies. Has a 75% chance of stealing all buffs from all enemies. Also has a 75% chance of placing a [True Fear] debuff for 1 turn, and a [Block Passive Skills] debuff for 2 turns.', '5', '4', '3.8', 'DEF'),
    ('C000939-Passive', 'Passive', 'Surefire Success [P]', 'Before the start of each enemy''s turn, decreases the Turn Meters of all enemies by 5%. Does not work against Bosses and their minions. If there are multiple Champions on the team with this skill, only one will activate. Decreases the effectiveness of [Ignore DEF] effects against this Champion by 50%.', null, null, null, null)
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Aria the Golden Hope'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000939-AURA', 'SPD', '25%', 'All Battles', 'Spirit', 'Increases Spirit Ally SPD in All Battles by 25%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Aria the Golden Hope'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Aria the Golden Hope');

-- ── Holguk of the Hallowsights  (Legendary / Spirit / Support / Orcs)  C000940
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Holguk of the Hallowsights', 'Orcs', 'Spirit', 'Legendary', 'Support', 19650, 947, 1321, 105, 15, 50, 40, 20, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Holguk of the Hallowsights');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000940-A1', 'A1', 'Skull Staff Pummel', 'Attacks 1 enemy. Has an 80% chance of placing a 30% [Decrease C. RATE] debuff for 2 turns. Also places a 25% [Decrease C. DMG] debuff for 2 turns, if the target is under a [Hex] debuff.', '0', '0', '5.5', 'ATK'),
    ('C000940-A2', 'A2', 'Hallowhex', 'Attacks all enemies. Has a 75% chance of decreasing the duration of all buffs on all enemies by 2 turns. Also has a 75% chance of placing a [Block Buffs] debuff and a [Hex] debuff on all enemies for 2 turns. The [Hex] debuff cannot be removed, stolen, or transferred.', '4', '3', '5.1', 'ATK'),
    ('C000940-A3', 'A3', 'Spirit-Speaker', 'Revives all dead allies with 50% HP and 50% Turn Meter. Places a [Revive on Death] buff on all allies for 1 turn, and a [Shield] buff equal to 30% of this Champion''s MAX HP on all allies for 2 turns.', '6', '4', '0.3', 'HP'),
    ('C000940-Passive', 'Passive', 'Leader Of Exiles [P]', 'Whenever an ally is revived by a [Revive on Death] buff, fills that ally''s Turn Meter by 50%. Whenever an enemy under a [Hex] debuff is killed, decreases the Turn Meters of all enemies by 25%. Enemies under [Hex] debuffs will have their C. RATE decreased by 20%. If there are multiple Champions on the team with this skill, only one will activate. This skill will not activate on duplicate copies of this Champion, if this particular Champion is dead.', null, null, null, null)
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Holguk of the Hallowsights'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000940-AURA', 'SPD', '28%', 'Arena', null, 'Increases Ally SPD in Arena by 28%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Holguk of the Hallowsights'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Holguk of the Hallowsights');

-- ── Xanthe Seaflower  (Epic / Force / Defense / Argonites)  C000941
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Xanthe Seaflower', 'Argonites', 'Force', 'Epic', 'Defense', 18495, 738, 1332, 97, 15, 50, 30, 15, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Xanthe Seaflower');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000941-A1', 'A1', 'Arrow Of Languor', 'Attacks 1 enemy. Has a 50% chance of placing a [Block Buffs] debuff for 2 turns.', '0', '0', '3.9', 'DEF'),
    ('C000941-A2', 'A2', 'Passionroot Volley', 'Attacks all enemies. Has a 75% chance of placing a 50% [Decrease ATK] debuff for 2 turns. Heals all allies by 5% of this Champion''s MAX HP for each debuff placed.', '4', '3', '3.8', 'DEF'),
    ('C000941-A3', 'A3', 'Generous Friend', 'Places a 50% [Increase RES] buff and a protected 15% [Continuous Heal] buff on all allies for 2 turns.', '6', '4', null, null),
    ('C000941-Passive', 'Passive', 'Natural Remedy [P]', 'Removes 1 random debuff from this Champion at the start of their turn. Whenever a debuff is removed this way, places a 7.5% [Continuous Heal] buff on this Champion for 2 turns.', null, null, null, null)
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Xanthe Seaflower'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000941-AURA', 'DEF', '30%', 'Faction Wars', null, 'Increases Ally DEF in Faction Wars by 30%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Xanthe Seaflower'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Xanthe Seaflower');

-- ── Khamir Scald-eye  (Legendary / Magic / Support / Ogryn Tribes)  C000942
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Khamir Scald-eye', 'Ogryn Tribes', 'Magic', 'Legendary', 'Support', 20145, 903, 1332, 110, 15, 50, 40, 0, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Khamir Scald-eye');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000942-A1', 'A1', 'Dark Restoration', 'Attacks 1 enemy 2 times. Each hit restores all allies'' destroyed MAX HP by an amount equal to 5% of the total destroyed MAX HP. Each hit also heals all allies by 5% of this Champion''s MAX HP.', '0', '0', '5.5', 'ATK'),
    ('C000942-A2', 'A2', 'Gloom-Powered', 'Fills the Turn Meters of all allies by 25%. Places a 50% [Increase ATK] buff and a 30% [Increase SPD] buff on all allies for 2 turns.', '5', '3', null, null),
    ('C000942-A3', 'A3', 'Death Is Weakness', 'Revives all dead allies with 50% HP and 50% Turn Meter. Places a 60% [Increase DEF] buff and a [Strengthen] buff on all allies for 2 turns.', '6', '4', null, null),
    ('C000942-Passive', 'Passive', 'Murderous Zeal [P]', 'Whenever an ally is killed, heals this Champion by 25% of his MAX HP and fills this Champion''s Turn Meter by 25%. Also heals all allies by 10% of this Champion''s MAX HP and fills their Turn Meters by 10%.', null, null, '0.25', 'HP')
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Khamir Scald-eye'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000942-AURA', 'SPD', '20%', 'All Battles', null, 'Increases Ally SPD in All Battles by 20%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Khamir Scald-eye'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Khamir Scald-eye');

-- ── Xalgaze Fangwall  (Legendary / Magic / Defense / Demonspawn)  C000943
insert into champions (game_id, name, faction, affinity, rarity, role, base_hp, base_atk, base_def, base_spd, base_crit_rate, base_crit_dmg, base_res, base_acc, source_citation)
select 'raid_shadow_legends', 'Xalgaze Fangwall', 'Demonspawn', 'Magic', 'Legendary', 'Defense', 18990, 859, 1454, 103, 15, 63, 30, 10, 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  where not exists (select 1 from champions where game_id='raid_shadow_legends' and name='Xalgaze Fangwall');
insert into champion_skills (champion_id, skill_id, slot, skill_name, skill_summary, cooldown_base, cooldown_booked, damage_multiplier, multiplier_type, ascension_required, verification_status, source)
select ch.id, v.skill_id, v.slot, v.nm, v.summ, v.cdb, v.cdbk, v.mult, v.mt, 0, 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch join (values
    ('C000943-A1', 'A1', 'Unsettling Warrior', 'Attacks 1 enemy 1 time. Has a 50% chance to place a [True Fear] debuff for 1 turn. Also has a 50% chance to place a [Block Active Skills] debuff for 1 turn, if the target is under a [Leech] debuff.', '0', '0', '4.3', 'DEF'),
    ('C000943-A2', 'A2', 'Horrific Mission', 'Attacks all enemies 2 times. Each hit will ignore 15% of each target''s DEF. The first hit has a 75% chance of placing a [Leech] debuff for 2 turns. The second hit has a 75% chance of placing a 50% [Decrease RES] debuff for 2 turns.', '4', '3', '2.1', 'DEF'),
    ('C000943-A3', 'A3', 'Unholy Resilience', 'Places a 60% [Increase DEF] buff, a 50% [Increase ACC] buff, and a 30% [Reflect Damage] buff on all allies for 2 turns.', '5', '3', null, null),
    ('C000943-Passive', 'Passive', 'Construct Of Siroth [P]', 'All [Reflect Damage] buffs on this Champion and their allies reflect 30% more damage. If there are multiple Champions on the team with this skill, only one will activate. This skill will not activate on duplicate copies of this Champion, if this particular Champion is dead. Whenever this Champion is attacked, reflects 50% of the damage this Champion receives back to the attacker. Heals this Champion by 50% of any damage received from enemy skills while under a [Reflect Damage] buff.', null, null, null, null)
  ) as v(skill_id, slot, nm, summ, cdb, cdbk, mult, mt) on true
  where ch.game_id='raid_shadow_legends' and ch.name='Xalgaze Fangwall'
  and not exists (select 1 from champion_skills s where s.skill_id=v.skill_id);
insert into champion_auras (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, 'C000943-AURA', 'DEF', '30%', 'All Battles', null, 'Increases Ally DEF in All Battles by 30%.', 'proposed', 'HellHades (skills/aura, human-read) + in-game Index (stats) 2026-08-07 — missing-champion capture'
  from champions ch where ch.game_id='raid_shadow_legends' and ch.name='Xalgaze Fangwall'
  and not exists (select 1 from champion_auras au join champions c2 on c2.id=au.champion_id where c2.name='Xalgaze Fangwall');

commit;
