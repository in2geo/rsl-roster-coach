-- ============================================================================
-- Seed 50 — Ninja: AoE Damage tag from in-game skill text (+ full-kit provenance)
-- Source: in-game champion Index / skill-detail popups, captured verbatim from a
-- screen recording of Ninja (Lvl 32, 5★, Legendary) on 2026-07-07.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- Ninja ALREADY has a champions row (seeds/07: Shadowkin / Magic / Legendary —
-- CONFIRMED by this video: blue-crystal Magic affinity icon, Shadowkin banner)
-- and four raid.guide tags (seeds/15): Decrease Defense, HP Burn, Perfect Veil,
-- AoE Freeze. The video CONFIRMS all four (see kit below) and adds ONE new tag.
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance:
--       A1 Shatterbolt (no cd): "Attacks 1 enemy. 45% chance of 60% [Decrease
--         DEF] 2t. Also fills this Champion's Turn Meter by 15% when used against
--         Bosses." Dmg [ATK]. -> confirms seeds/15 Decrease Defense.
--       A2 Hailburn (cd 4t; booked 3t via L6 Cooldown -1): "Attacks 3 times at
--         random. Each hit 75% chance [HP Burn] 3t. Also places [Perfect Veil]
--         on THIS Champion 2t. vs Bosses: instantly activates any [HP Burn]
--         debuffs, including those placed by this skill." Dmg [ATK]. -> confirms
--         seeds/15 HP Burn + Perfect Veil (Perfect Veil is SELF).
--       A3 Cyan Slash (cd 5t; booked 4t via L5 Cooldown -1): "Attacks ALL enemies.
--         75% chance [Freeze] 1t. When targeting a Boss: attacks ONLY the Boss
--         (not all enemies), ignores 50% of the target's DEF, and decreases the
--         cooldown of Hailburn by 1t." Dmg [ATK]. -> confirms seeds/15 AoE Freeze
--         AND yields the new AoE Damage tag below.
--       Passive Escalation [P] (locked, Unlocks at Ascension Level 3): "Increases
--         Ninja's ATK by 10% (up to 100%) and C.DMG by 5% (up to 25%) each time a
--         single enemy is hit by ALL THREE of Ninja's active skills in a single
--         Round (multiplicative, can recur on the same enemy). vs Bosses: ATK
--         +20% (up to 100%), C.DMG +10% (up to 25%) instead." Self-scaling buff.
--       AURA: NONE. Ninja has NO aura / leader skill — the in-game panel shows
--         SKILLS then BLESSING with NO AURA section (confirmed across all frames).
--         Recorded here so a future capture doesn't re-hunt for a non-existent aura.
--
-- (2) NEW TAG (1): AoE Damage — from A3 Cyan Slash ("Attacks ALL enemies" in
--     normal content; single-target only vs a Boss). raid.guide (seeds/15) tagged
--     A3's [Freeze] bracket as AoE Freeze but NOT the AoE damage itself — see
--     reviewer flag.
--
--     NOT TAGGED (no clean vocabulary fit; surfaced, not dropped):
--       * A1's self Turn-Meter fill (+15% vs Bosses only) — self-effect, no tag.
--       * A2's boss-only instant [HP Burn] detonation — a conditional activation,
--         not a placed debuff.
--       * A3's boss-mode single-target + ignore-50%-DEF + Hailburn cooldown cut —
--         boss-conditional behaviour, no tag.
--       * Passive Escalation's stacking self ATK/C.DMG buff — self-scaling, no tag.
--
-- >>> REVIEWER FLAG <<<
--   raid.guide's scraper (tools/scrape-champion-tags.js) emits tags only from
--   bracketed [debuff]/[buff] tokens in the skill text — it does NOT derive a
--   generic 'AoE Damage' tag from the plain phrase "Attacks all enemies". So
--   AoE-damage-only skills go untagged on every raid.guide-scraped champion
--   (here A3 got AoE Freeze from its [Freeze] bracket but no AoE Damage). This is
--   a SYSTEMIC gap, not unique to Ninja — worth a broader sweep of seeds/15
--   champions whose AoE skills carry no bracketed debuff.
-- ============================================================================

-- (2) New proposed tag: AoE Damage from A3 Cyan Slash. Idempotent.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
       'A3 Cyan Slash (cd 5t unbooked, 4t booked via L5 Cooldown -1): "Attacks ALL enemies" in normal content (also 75% [Freeze] 1t — already tagged AoE Freeze in seeds/15). vs a Boss it attacks ONLY the Boss (single-target) and ignores 50% DEF. AoE-damage in wave/non-boss content. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07. Fills a gap: raid.guide (seeds/15) tagged A3''s Freeze but not its AoE damage.',
       'in-game-index-video', now(), 0
from champions ch
join tags t on t.name = 'AoE Damage'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Ninja'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
  );
