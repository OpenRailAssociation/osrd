DROP INDEX train_schedule_set_catalog_entry_name_published_unique;

CREATE UNIQUE INDEX train_schedule_set_catalog_entry_name_published_unique ON train_schedule_set (catalog_entry_id, name, timetable_type)
WHERE published = TRUE;
