-- This file should undo anything in `up.sql`

ALTER TABLE paced_train RENAME COLUMN main_category TO category;
ALTER TABLE train_schedule RENAME COLUMN main_category TO category;
