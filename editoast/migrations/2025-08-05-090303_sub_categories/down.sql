-- This file should undo anything in `up.sql`

ALTER TABLE train_schedule DROP CONSTRAINT IF EXISTS only_one_category;
ALTER TABLE train_schedule DROP CONSTRAINT IF EXISTS fk_train_schedule_sub_category;
ALTER TABLE train_schedule DROP COLUMN IF EXISTS sub_category;

ALTER TABLE paced_train DROP CONSTRAINT IF EXISTS only_one_category;
ALTER TABLE paced_train DROP CONSTRAINT IF EXISTS fk_paced_train_sub_category;
ALTER TABLE paced_train DROP COLUMN IF EXISTS sub_category;

DROP TABLE IF EXISTS sub_categories;
