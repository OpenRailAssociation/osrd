-- Add temporary column to store legacy paced_train IDs
ALTER TABLE train_schedule ADD COLUMN legacy_paced_train_id int8;

-- Migrate paced_train rows with NULL interval back to train_schedule
INSERT INTO train_schedule (
    train_name,
    labels,
    rolling_stock_name,
    timetable_id,
    start_time,
    schedule,
    margins,
    initial_speed,
    comfort,
    path,
    constraint_distribution,
    speed_limit_tag,
    power_restrictions,
    options,
    main_category,
    sub_category,
    legacy_paced_train_id
)
SELECT
    train_name,
    labels,
    rolling_stock_name,
    timetable_id,
    start_time,
    schedule,
    margins,
    initial_speed,
    comfort,
    path,
    constraint_distribution,
    speed_limit_tag,
    power_restrictions,
    options,
    main_category,
    sub_category,
    id  -- legacy_paced_train_id
FROM paced_train
WHERE interval IS NULL;

-- Migrate round trips using the legacy ID mapping
INSERT INTO train_schedule_round_trips (left_id, right_id)
SELECT
    ts_left.id AS left_id,
    ts_right.id AS right_id
FROM paced_train_round_trips
INNER JOIN train_schedule ts_left ON ts_left.legacy_paced_train_id = paced_train_round_trips.left_id
LEFT JOIN train_schedule ts_right ON ts_right.legacy_paced_train_id = paced_train_round_trips.right_id
WHERE EXISTS (
    SELECT 1 FROM paced_train pt
    WHERE pt.id = paced_train_round_trips.left_id
    AND pt.interval IS NULL
);

-- Delete the migrated paced_train rows and their round trips
DELETE FROM paced_train_round_trips
WHERE left_id IN (SELECT id FROM paced_train WHERE interval IS NULL)
   OR right_id IN (SELECT id FROM paced_train WHERE interval IS NULL);

DELETE FROM paced_train WHERE interval IS NULL;

-- Drop the temporary column
ALTER TABLE train_schedule DROP COLUMN legacy_paced_train_id;

-- Remove the constraint
ALTER TABLE paced_train DROP CONSTRAINT paced_train_null_paced;

-- Make time_window and interval NOT NULL again
ALTER TABLE paced_train ALTER COLUMN interval SET NOT NULL;
ALTER TABLE paced_train ALTER COLUMN time_window SET NOT NULL;
