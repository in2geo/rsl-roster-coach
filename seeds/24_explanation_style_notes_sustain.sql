-- 24 — explanation_style_notes for the sustain / CC-as-sustain / gear-assumption layer.
-- Guidance for the AI explanation layer (not engine-read tags). game_id defaults to
-- 'raid_shadow_legends'. Each insert is guarded on topic so re-running is idempotent.

insert into explanation_style_notes (topic, note)
select 'CC-as-sustain ACC dependency',
  'When a team relies on Crowd Control (Freeze, Stun, Provoke) as its primary sustain — '
  'rather than healing or damage reduction — the ACC check becomes a survival check, not '
  'just a debuff check. Surface this explicitly: "Your team survives by keeping enemies '
  'frozen — if [champion]''s ACC is too low, the freeze won''t land and your team will take '
  'heavy damage." Do not bury this in a generic ACC warning.'
where not exists (select 1 from explanation_style_notes where topic = 'CC-as-sustain ACC dependency');

insert into explanation_style_notes (topic, note)
select 'No Lifesteal assumption disclosure',
  'When the recommendation output includes a sustain gap warning, always explain why the '
  'assumption exists: "We assume your champions are using damage or speed gear, not Lifesteal '
  '— so your team needs a healer champion to stay alive." Never assume the player knows this; '
  'state it plainly every time the sustain gap fires.'
where not exists (select 1 from explanation_style_notes where topic = 'No Lifesteal assumption disclosure');

insert into explanation_style_notes (topic, note)
select 'Sustain gap — named champion suggestion',
  'When surfacing a sustain gap, always name a specific champion from the player''s roster who '
  'could fill it, if one exists. Do not say "add a healer" — say "Uugo can fill the healer role '
  'here if you add her to this team." If no owned champion covers sustain, say that explicitly: '
  '"None of your champions provide healing — consider farming [content] for a healer before '
  'attempting this."'
where not exists (select 1 from explanation_style_notes where topic = 'Sustain gap — named champion suggestion');

insert into explanation_style_notes (topic, note)
select 'Heal Reduction invalidates healing sustain',
  'If the enemy can place Heal Reduction and the team''s only sustain is healing-based, the '
  'sustain collapses. When recommending a healer as sustain for Ice Golem or any content with '
  'Heal Reduction in the boss_exceptions, add: "Bring a Cleanser or build high RES — if Heal '
  'Reduction lands on your healer, your team loses its sustain entirely."'
where not exists (select 1 from explanation_style_notes where topic = 'Heal Reduction invalidates healing sustain');

insert into explanation_style_notes (topic, note)
select 'Decrease ATK uptime gap on Clan Boss stun',
  'Decrease ATK as sustain requires 100% uptime. The Clan Boss stuns one champion every 3 turns '
  '— if the stunned champion is the Decrease ATK source, the boss hits at full damage that turn. '
  'Surface this as a risk: "Your Decrease ATK may drop for one turn when [champion] gets stunned. '
  'A Cleanser who acts before your debuffer recovers will close that gap."'
where not exists (select 1 from explanation_style_notes where topic = 'Decrease ATK uptime gap on Clan Boss stun');
