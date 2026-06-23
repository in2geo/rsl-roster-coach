# Seed files — run order

Execute these in the Supabase SQL editor, one at a time, in order:

1. `01_tags.sql` — tag vocabulary (idempotent)
2. `02_dungeons.sql` — dungeons, stages, phases, goals, solutions (idempotent)
3. `03_champions.sql` — MVP champion list (idempotent)
4. `04_champion_tags.sql` — proposed champion→tag links (idempotent)

All `champion_tags` and `goal_solutions` rows are seeded as `status = 'proposed'`.
Before the matching engine uses them, review each row and set `status = 'approved'`
(and fill `approved_by` / `approved_at`). Nothing auto-merges.

## Approving a tag (SQL)

```sql
update champion_tags
set status = 'approved', approved_by = 'your-name', approved_at = now()
where status = 'proposed';
-- or filter to one champion:
-- where champion_id = (select id from champions where name = 'Kael');
```

## Approving a goal solution

```sql
update goal_solutions
set status = 'approved', approved_by = 'your-name', approved_at = now()
where status = 'proposed';
```

## QA check — tag coverage by rarity

```sql
select * from tag_coverage_by_rarity;
```

Low % at Common/Uncommon/Rare = the matching engine will silently have no fallback
champions for new players. Fix those gaps before going live.
