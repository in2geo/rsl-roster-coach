-- ============================================================================
-- Seed 48 — Tidemaster Dexikos champion row + proposed tags (incl. aura) from
-- in-game skill text. Source: in-game champion Index / skill-detail popups,
-- captured verbatim from a screen recording of Tidemaster Dexikos (Lvl 49, 5★)
-- on 2026-07-07. source_type='in_game_index' (PRIMARY). status='proposed' —
-- HUMAN REVIEW REQUIRED; the match engine only reads status='approved' tags, so
-- nothing here changes behaviour until a human approves it. No auto-merge.
--
-- (0) CHAMPION ROW — Tidemaster Dexikos had NO champions row anywhere. NEW
--     champion (not in seeds/15 raid.guide scrape either). Identity read off the
--     in-game detail screen: Argonites / Magic (blue crystal affinity icon) /
--     Epic / Support. FIRST Argonites-faction champion in the DB (faction is
--     free text, no CHECK constraint — see reviewer flag).
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance:
--       A1 Aqueuos Bolt: "Attacks 1 enemy 2 times. Each hit heals the ally with
--         the lowest HP by 5% of this Champion's MAX HP." Dmg [ATK]. (Heal is
--         single-ally, lowest-HP-targeted, NOT AoE.)
--       A2 Tidemaster's Wrath (cd 5t; booked 3t via L4/L5 Cooldown -1): "Attacks
--         all enemies. Places a 60% [Increase DEF] buff on all allies for 2
--         turns." Dmg [ATK]. AoE damage + AoE ally buff.
--       A3 Rejuvenating Waters (cd 6t; booked 4t via L2/L3 Cooldown -1): "Revives
--         2 random allies with 40% HP and 20% Turn Meter. Heals all allies by 15%
--         of this Champion's MAX HP. Will heal all allies even if no allies were
--         revived. Places a [Perfect Veil] buff on all allies except this
--         Champion for 1 turn. Will place the buff even if no allies were
--         revived." Revive + AoE heal + AoE (ally-except-self) Perfect Veil.
--       Passive Safety of the Waves [P] (Lvl 1/1, unlocked — no ascension gate):
--         "At the start of this Champion's turn, places a [Shield] buff for 1
--         turn on all allies whose HP is less than 100%. The value of the
--         [Shield] is equal to 15% of the receiving Champion's MAX HP."
--       Aura: "Increases Ally HP in all Battles by 20%." (confirmed on the
--         dedicated AURA popup, not just the sidebar icon) -> HP Aura, 20%, all.
--
-- (2) TAGS PROPOSED (7): Healer, AoE Damage, Increase Defense, Revive,
--     Perfect Veil, Shield, HP Aura. See per-tag source_notes below.
--
--     NOT TAGGED (no clean vocabulary fit; surfaced, not dropped):
--       * A3's "20% Turn Meter" on the 2 revived allies — it is bound to the
--         revive and lands ONLY on revived allies, so tagging 'Increase Turn
--         Meter' would misrepresent Dexikos as a turn-meter booster (he is not).
--         Surfaced here for the reviewer instead of tagged.
--
-- >>> REVIEWER FLAGS <<<
--   (a) SUSTAIN VOCAB GAP. match-engine.js SUSTAIN_TAGS =
--       ['Continuous Heal','AoE Heal','Leech','Ally Protection','Strengthen',
--       'Healer'] but only 'Healer' and 'Ally Protection' exist in the tag
--       vocabulary (seeds/01,05) — 'AoE Heal'/'Continuous Heal'/'Leech'/
--       'Strengthen' are referenced by the engine yet UNSEEDED (the known
--       CLAUDE.md sustain gap). Dexikos is a heavy sustain anchor (all-ally heal
--       on A3 + all-ally Shield passive + Revive), but today only 'Healer' +
--       'Shield' capture that. If/when 'AoE Heal' is added to the vocabulary,
--       Dexikos's A3 all-ally heal qualifies — re-tag then.
--   (b) FACTION 'Argonites' — first champion of this faction in the DB. faction
--       is free text (no CHECK), so this inserts fine; confirm the spelling
--       matches however Argonites is referenced elsewhere before approving.
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/45 Xenomorph pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Tidemaster Dexikos', 'Argonites', 'Magic', 'Epic',
       'in-game Index champion detail screen (video, 2026-07-07)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Tidemaster Dexikos'
);

-- (1) Proposed tags incl. aura (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Healer',
   'A1 Aqueuos Bolt: each of 2 hits heals the ally with the LOWEST HP by 5% of Dexikos'' MAX HP (single-ally, lowest-HP-targeted — not AoE). A3 Rejuvenating Waters: additionally heals ALL allies by 15% of Dexikos'' MAX HP, even if no allies were revived (AoE heal — see reviewer flag (a): no ''AoE Heal'' tag exists yet). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('AoE Damage',
   'A2 Tidemaster''s Wrath (cd 5t unbooked, 3t booked via L4/L5 Cooldown -1): attacks ALL enemies. Dmg [ATK]. The only AoE-damage skill (A1 is single-target, A3 deals no damage). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Increase Defense',
   'A2 Tidemaster''s Wrath: places a 60% [Increase DEF] buff on ALL allies for 2 turns (guaranteed, no chance clause). AoE ally buff. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Revive',
   'A3 Rejuvenating Waters (cd 6t unbooked, 4t booked via L2/L3 Cooldown -1): revives 2 RANDOM allies with 40% HP and 20% Turn Meter. The 20% Turn Meter is revive-bound (only on revived allies) and is intentionally NOT tagged Increase Turn Meter — see NOT TAGGED note. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Perfect Veil',
   'A3 Rejuvenating Waters: places a [Perfect Veil] buff on ALL allies EXCEPT Dexikos for 1 turn, even if no allies were revived. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Shield',
   'Passive Safety of the Waves [P] (Lvl 1/1, unlocked — no ascension gate): at the START of Dexikos'' turn, places a [Shield] buff for 1 turn on ALL allies whose HP is < 100%. Shield value = 15% of the RECEIVING champion''s MAX HP. Verbatim in-game Index text, Level 1, captured 2026-07-07.'),
  ('HP Aura',
   'Aura: "Increases Ally HP in all Battles by 20%." Leader skill (applies only when Dexikos leads). Magnitude 20%, placement = all battles; kept in this source_note per the seeds/20 & 47 convention (not on the tag). Confirmed on the dedicated in-game AURA popup, captured 2026-07-07.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Tidemaster Dexikos'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
