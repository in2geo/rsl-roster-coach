-- ============================================================================
-- Vocabulary expansion: 14 tags for RSL mechanics the scraper found unmapped
-- (Provoke, Unkillable, Veil/Perfect Veil, Fear/True Fear, Decrease ACC,
-- Increase C.Rate/C.DMG, Block Buffs, Hex, Bomb, Reflect Damage, Block Active
-- Skills). Human-approved 2026-07-01. Unblocks tagging for 100+ champions.
--
-- bypasses_accuracy_check: only True Fear = true (unresistable). Assigning True
-- Fear to a champion still requires literal Index confirmation per project rules —
-- the tag existing does not authorize a champion_tags row without verification.
-- ============================================================================

insert into tags (name, description, bypasses_accuracy_check) values

('Provoke',
 'Forces the target to attack only this champion for the debuff duration. On Ice Golem: Pelops uses Taunt (functionally equivalent to Provoke) to draw all minion attacks to himself, enabling his HP Burn passive to activate repeatedly.',
 false),

('Unkillable',
 'Prevents the champion from dying — incoming damage that would reduce HP to 0 is blocked. The champion survives with 1 HP. Clan Boss stun priority actively avoids champions with Unkillable active.',
 false),

('Perfect Veil',
 'Hides the champion from enemy targeting — enemies cannot select this champion as a direct attack target for the duration. Does not protect against AoE attacks.',
 false),

('Veil',
 'A lesser version of Perfect Veil — hides the champion from targeting but with a lower chance of being pierced. Check exact skill text before assigning; some sources conflate Veil and Perfect Veil.',
 false),

('Fear',
 'Causes the target to use only their default A1 skill and move to a random position. Subject to ACC/RES check.',
 false),

('True Fear',
 'Same as Fear but cannot be resisted — bypasses the ACC/RES check entirely. Verify via literal skill text before assigning this tag; do not assume Fear is True Fear.',
 true),

('Decrease ACC',
 'Reduces enemy Accuracy, making their debuffs less likely to land. Ice Golem Numbing Chill places 50% Decrease ACC on all enemies for 2 turns — the most dangerous non-damage mechanic in that fight.',
 false),

('Increase C.Rate',
 'Increases ally Critical Rate. Relevant for champions whose damage scales with crits (Staltus, Elder Skarg, Kael).',
 false),

('Increase C.DMG',
 'Increases ally Critical Damage multiplier. Pairs with Increase C.Rate for burst damage compositions.',
 false),

('Block Buffs',
 'Prevents the target from receiving new buffs for the duration. On Clan Boss: Uugo''s Block Buffs is 100% chance AoE — prevents boss from gaining offensive multipliers.',
 false),

('Hex',
 'Marks the target so they can be hit by skills that would otherwise be unable to target them. On Hydra: the Head of Mischief cannot be targeted by single-target skills unless Hexed.',
 false),

('Bomb',
 'Places a timed charge on the target that detonates after a set number of turns, dealing damage based on the bomb''s value.',
 false),

('Reflect Damage',
 'Causes a portion of incoming damage to be reflected back to the attacker. On Ice Golem: DANGEROUS — reflected damage can trigger Frigid Vengeance HP thresholds unexpectedly.',
 false),

('Block Active Skills',
 'Prevents the target from using any skill except their default A1 for the duration. Similar effect to Daze but applied as a debuff rather than a crowd control.',
 false)

on conflict (name) do nothing;
