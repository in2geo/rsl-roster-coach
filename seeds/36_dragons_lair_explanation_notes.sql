-- 36 — Dragon's Lair Chunk 5: explanation style notes.
-- Guarded on topic (idempotent). NOTE: matchRoster derives the dungeon topic key as
-- "Dragon Lair" (from "Dragon's Lair") and looks up style notes via ilike '%Dragon Lair%'.
-- These topics start with "Dragon " (not "Dragon Lair"), so the current matchRoster reader
-- won't surface them — see the follow-up. Kept verbatim as provided.

insert into explanation_style_notes (topic, note)
select 'Dragon Scorch mechanic explanation',
  'Explain Scorch in plain terms every time — never assume the player
    knows it: "The Dragon winds up every few turns. Your team gets one
    hit before he unleashes a massive attack that stuns everyone and
    ignores your defense. Deal enough damage in that one window to stop
    it. Poison and HP Burn work because they keep ticking damage every
    turn — they do not need to land in that specific window." Never
    say "clear the purple bar" without explaining what that means.'
where not exists (select 1 from explanation_style_notes where topic = 'Dragon Scorch mechanic explanation');

insert into explanation_style_notes (topic, note)
select 'Dragon TM immunity warning',
  'When a player brings a champion whose primary value is Turn Meter
    reduction on bosses (Coldheart, Armiger, Lyssandra): "This champion
    is great in many places but her main skill does not work on the
    Dragon — he is immune to Turn Meter reduction. She can still deal
    damage, but the most important part of her kit is wasted here.
    At stage 21 and above this gets even worse." Do not refuse to
    recommend her — flag the limitation and let the player decide.'
where not exists (select 1 from explanation_style_notes where topic = 'Dragon TM immunity warning');

insert into explanation_style_notes (topic, note)
select 'Dragon ACC floor explanation',
  'Do not give the player a raw number without context. Say: "Your
    debuffers need high Accuracy to land Poison and Weaken on the
    Dragon — he resists debuffs heavily at stage 15 and above. If
    your Poison keeps getting resisted, build more Accuracy on your
    debuffer. A Perception set adds flat Accuracy and is the fastest
    fix." At stage 20 specifically: "The Dragon at stage 20 has 200
    Resistance — your debuffers need at least 225 Accuracy to land
    reliably."'
where not exists (select 1 from explanation_style_notes where topic = 'Dragon ACC floor explanation');

insert into explanation_style_notes (topic, note)
select 'Dragon stage 20 vs stage 21 transition',
  'When a player is farming stage 20 successfully and asks about
    pushing to stage 21: "Stage 21 changes the rules — the Dragon
    gains two new passives that cap HP-scaling damage and reduce
    Turn Meter control effects. Champions that carried you through
    stage 20 (Coldheart, HP-scalers like Stag Knight) will
    underperform at stage 21. You need a stronger roster before
    pushing past 20, not just better gear."'
where not exists (select 1 from explanation_style_notes where topic = 'Dragon stage 20 vs stage 21 transition');
