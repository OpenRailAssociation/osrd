DROP INDEX train_schedule_set_catalog_entry_name_published_unique;

-- This will intentionally fail in case of duplicates to avoid data loss
--
-- If you really want to migrate down, here's how to delete non-calendar
-- duplicates:
--
-- ```sql
-- DELETE FROM train_schedule_set AS ts1 WHERE ts1.published = TRUE AND ts1.timetable_type != 'CALENDAR' AND (SELECT TRUE FROM train_schedule_set AS ts2 WHERE ts2.name=ts1.name AND ts2.catalog_entry_id=ts1.catalog_entry_id  AND ts2.published = true AND ts2.id != ts1.id);
-- ```
CREATE UNIQUE INDEX train_schedule_set_catalog_entry_name_published_unique ON train_schedule_set (catalog_entry_id, name)
WHERE published = TRUE;
