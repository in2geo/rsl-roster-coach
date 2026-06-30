-- ============================================================================
-- Migration — de-duplicate near-duplicate tags (abbreviation vs full word)
-- ============================================================================
-- The tags table accumulated abbreviated duplicates of full-word tags. Canonical
-- form is the FULL WORD (matches the table's dominant convention: Decrease
-- Defense, Increase Attack, Decrease Turn Meter, and the variant that already
-- carries champion usage). Found via normalized-name grouping (ATK→Attack,
-- SPD→Speed, etc.).
--
-- Duplicate groups (dup → canonical), with reference counts at authoring time:
--   "Decrease ATK"  (0 champ / 0 sol)  ->  "Decrease Attack"  (4 champ / 0 sol)
--   "Decrease SPD"  (0 champ / 0 sol)  ->  "Decrease Speed"   (0 champ / 0 sol)
--   "Increase SPD"  (0 champ / 0 sol)  ->  "Increase Speed"   (3 champ / 0 sol)
--
-- All duplicates-to-remove have 0 references, so the repoint is a no-op today;
-- it is written defensively (collision-safe against the unique constraints on
-- champion_tags(champion_id, tag_id) and goal_solution_tags(goal_solution_id,
-- tag_id)) in case references are added before this is applied.
--
-- NOT auto-applied — review, then run via the service-role admin path. Idempotent:
-- re-running after the dup rows are gone is a harmless no-op (subselects -> null).
-- ============================================================================

do $$
declare
  m record;
  dup_id   uuid;
  canon_id uuid;
begin
  for m in select * from (values
    ('Decrease ATK', 'Decrease Attack'),
    ('Decrease SPD', 'Decrease Speed'),
    ('Increase SPD', 'Increase Speed')
  ) as t(dup_name, canon_name)
  loop
    select id into dup_id   from tags where name = m.dup_name;
    select id into canon_id from tags where name = m.canon_name;
    if dup_id is null or canon_id is null then
      continue;  -- already merged, or canonical missing — skip
    end if;

    -- Repoint champion_tags, skipping rows that would collide with an existing
    -- (champion_id, canonical) pair; then drop any leftover dup rows.
    update champion_tags ct set tag_id = canon_id
      where ct.tag_id = dup_id
        and not exists (
          select 1 from champion_tags x
          where x.champion_id = ct.champion_id and x.tag_id = canon_id
        );
    delete from champion_tags where tag_id = dup_id;

    -- Same for goal_solution_tags.
    update goal_solution_tags gst set tag_id = canon_id
      where gst.tag_id = dup_id
        and not exists (
          select 1 from goal_solution_tags x
          where x.goal_solution_id = gst.goal_solution_id and x.tag_id = canon_id
        );
    delete from goal_solution_tags where tag_id = dup_id;

    -- Finally remove the now-unreferenced duplicate tag row.
    delete from tags where id = dup_id;

    raise notice 'merged "%" -> "%"', m.dup_name, m.canon_name;
  end loop;
end $$;

-- ── Verification (run after applying) ────────────────────────────────────────
-- Expect: no rows (all three duplicates gone, canonicals remain).
-- select name from tags where name in
--   ('Decrease ATK','Decrease SPD','Increase SPD');
