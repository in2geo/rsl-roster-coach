-- ============================================================================
-- 129 — Xenomorph Clan Boss skill AI config (INS-0010, first annotation).
-- Theory until run data confirms → validated=false. Xenomorph's CB value is his
-- %maxHP Poison, which rides on his Perfect Veil uptime; A2/A3 break that window
-- (and A3's CC is non-functional on the CC-immune boss). So: A1 only, disable A2/A3.
-- Idempotent (upsert on champion+slot+content). Requires migration 2026-07-15_skill_ai_configs.
-- ============================================================================
insert into skill_ai_configs
  (champion_id, skill_slot, content_key, recommended_setting, condition, priority, ai_condition_notes, auto_reliable, rationale, validated, confidence_pct, source)
select ch.id, v.slot, 'clan_boss', v.setting, v.cond, v.prio, v.notes, v.autorel, v.rationale, false, 70, 'INS-0010 annotation 2026-07-15'
from champions ch
join (values
  ('A1', 'always_use', null,                     1,    null,                                             true,  'Poison engine — his %maxHP Poison is the bulk of his CB damage; fire every turn.'),
  ('A2', 'never_use',  null,                      null, null,                                             null,  'Breaks the Perfect Veil uptime window his Poison damage depends on — net damage LOSS on CB.'),
  ('A3', 'never_use',  null,                      null, 'CC (Stun/Fear) non-functional vs CB immunity',   null,  'CC does nothing to the immune boss and it also risks the Veil window — disable.')
) as v(slot, setting, cond, prio, notes, autorel, rationale) on true
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Xenomorph'
on conflict (champion_id, skill_slot, content_key) do update set
  recommended_setting = excluded.recommended_setting,
  condition = excluded.condition, priority = excluded.priority,
  ai_condition_notes = excluded.ai_condition_notes, auto_reliable = excluded.auto_reliable,
  rationale = excluded.rationale, confidence_pct = excluded.confidence_pct, source = excluded.source;
