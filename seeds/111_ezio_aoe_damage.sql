-- ============================================================================
-- 111 - Ezio Auditore AoE Damage tag (2026-07-12). A2 Da Vinci's Design attacks
-- all enemies. Restored from seed 42's original analysis per user request /
-- seed 42-43 reconciliation. Mirrors worksheet v4.84. Idempotent.
-- ============================================================================
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at,
   ascension_required, target_type, approved_by, approved_at)
values
  ('00404172-1b85-49eb-b353-a0aaaf9cca1f','8dd046f2-679c-4ff5-9b38-987b7a6af674','approved','in_game_index','A2 Da Vinci''s Design: attacks all enemies (AoE damage, scales off ATK). Restored from seed 42 analysis per reconciliation.','seed42-reconcile-2026-07-12',now(),0,'aoe','seed42-reconcile-2026-07-12',now())
on conflict (champion_id, tag_id) do update
  set status='approved', approved_by='seed42-reconcile-2026-07-12', approved_at=now()
  where champion_tags.status<>'approved';
