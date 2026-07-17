ALTER TABLE train_schedule
ALTER COLUMN interval DROP NOT NULL,
DROP CONSTRAINT interval_strictly_positive
;
