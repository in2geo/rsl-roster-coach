-- 115 - Reconcile fix: Vitrius Increase Defense is a buff-strip false positive
-- (A2 removes [Increase DEF] from enemies, never places it; policy #19). Worksheet v4.87.
update champion_tags set status='rejected', approved_by=null, approved_at=null
  where champion_id='ea019155-b47d-42a1-923f-728a093e7d77' and tag_id='98bbbae2-6d09-44bf-8a85-85027baddf77' and status='approved';
