-- Your SQL goes here

ALTER TABLE paced_train RENAME COLUMN category TO main_category;
ALTER TABLE train_schedule RENAME COLUMN category TO main_category;
