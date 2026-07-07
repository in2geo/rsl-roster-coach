-- ============================================================================
-- Seed 52 — Approve the in-game-index champion_tags proposed in seeds 47–51.
-- Reviewed 2026-07-07 (tag-review worksheet). Per CLAUDE.md's hard rule, an
-- approval is a content change and must live in a committed seed so the DB stays
-- reconstructable — this file IS the record of that human review, not an ad-hoc
-- query run against the live DB.
--
-- Scope: EXACTLY the 20 rows added by seeds 47–51, addressed by (champion, tag)
-- pair. Deliberately NOT a blanket `proposed_by='in-game-index-video'` filter —
-- seeds 40–46 (Coldheart, Artak, Ezio, Xenomorph, Michelangelo, and Venomage's
-- seed-44 kit) share that proposed_by and have their own still-pending rows that
-- were NOT part of this review. Approving those is a separate decision.
--
-- The `and ct.status='proposed'` guard makes this idempotent and non-destructive:
--   * re-running after approval no-ops (rows are already 'approved');
--   * it will NOT resurrect a row a human later set to 'rejected'.
--
-- The Rathalos aura appears as BOTH ('Rathalos Blademaster','Attack Aura') and
-- ('…','ATK Aura'): whichever tag name exists post/pre the seeds/… dedupe-migration
-- rename matches; the other pair simply matches no tag row and no-ops.
--
-- Expect: 20 rows updated (21 pairs listed; the ATK/Attack Aura alias contributes
-- one match). If FEWER than 20, a seed (47–51) has not been applied yet — apply it
-- first, then re-run this.
-- ============================================================================

update champion_tags ct
set status = 'approved', approved_by = 'mike', approved_at = now()
from champions c, tags t
where ct.champion_id = c.id
  and ct.tag_id = t.id
  and ct.status = 'proposed'
  and c.game_id = 'raid_shadow_legends'
  and (c.name, t.name) in (
    ('Venomage','ACC Aura'),
    ('Tidemaster Dexikos','Healer'),
    ('Tidemaster Dexikos','AoE Damage'),
    ('Tidemaster Dexikos','Increase Defense'),
    ('Tidemaster Dexikos','Revive'),
    ('Tidemaster Dexikos','Perfect Veil'),
    ('Tidemaster Dexikos','Shield'),
    ('Tidemaster Dexikos','HP Aura'),
    ('Sun Wukong','Stun'),
    ('Sun Wukong','Sheep'),
    ('Sun Wukong','Steal Buffs'),
    ('Sun Wukong','Block Buffs'),
    ('Sun Wukong','AoE Damage'),
    ('Sun Wukong','Speed Aura'),
    ('Ninja','AoE Damage'),
    ('Rathalos Blademaster','Decrease Defense'),
    ('Rathalos Blademaster','AoE Damage'),
    ('Rathalos Blademaster','Increase C.DMG'),
    ('Rathalos Blademaster','Increase Speed'),
    ('Rathalos Blademaster','Attack Aura'),
    ('Rathalos Blademaster','ATK Aura')
  );

-- Verify (expect 20 approved across these five champions):
-- select c.name, count(*) filter (where ct.status='approved' and ct.proposed_by='in-game-index-video') as approved
-- from champion_tags ct join champions c on c.id = ct.champion_id
-- where c.name in ('Venomage','Tidemaster Dexikos','Sun Wukong','Ninja','Rathalos Blademaster')
-- group by c.name order by c.name;
