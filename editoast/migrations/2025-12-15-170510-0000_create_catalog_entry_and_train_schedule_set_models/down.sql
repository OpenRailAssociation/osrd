-- This file should undo anything in `up.sql`
DROP INDEX IF EXISTS train_schedule_set_catalog_entry_name_published_unique;
DROP TABLE IF EXISTS train_schedule_set;
DROP TABLE IF EXISTS catalog_entry;
