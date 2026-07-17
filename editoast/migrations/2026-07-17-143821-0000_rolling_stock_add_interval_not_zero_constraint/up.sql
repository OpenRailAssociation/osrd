ALTER TABLE train_schedule
ALTER COLUMN interval SET NOT NULL,
ADD CONSTRAINT interval_strictly_positive
CHECK ('0'::interval < interval)
;
