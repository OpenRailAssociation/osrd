-- Make time_window and interval nullable in paced_train table
ALTER TABLE paced_train ALTER COLUMN time_window DROP NOT NULL;
ALTER TABLE paced_train ALTER COLUMN interval DROP NOT NULL;

-- Add constraint to ensure proper nullability:
-- Either both time_window and interval are NULL with exceptions = '[]'::jsonb
-- OR both time_window and interval are NOT NULL
ALTER TABLE paced_train
ADD CONSTRAINT paced_train_null_paced CHECK (
    (time_window IS NULL AND interval IS NULL AND exceptions = '[]'::jsonb)
    OR (time_window IS NOT NULL AND interval IS NOT NULL)
);

-- Add temporary column to store legacy train_schedule IDs
ALTER TABLE paced_train ADD COLUMN legacy_train_schedule_id int8;

-- Migrate train_schedule rows to paced_train with NULL paced fields
INSERT INTO paced_train (
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
    time_window,
    interval,
    main_category,
    sub_category,
    exceptions,
    legacy_train_schedule_id
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
    NULL,  -- time_window
    NULL,  -- interval
    main_category,
    sub_category,
    '[]'::jsonb,  -- exceptions
    id  -- legacy_train_schedule_id
FROM train_schedule;

-- Migrate round trips using the legacy ID mapping
INSERT INTO paced_train_round_trips (left_id, right_id)
SELECT
    pt_left.id AS left_id,
    pt_right.id AS right_id
FROM train_schedule_round_trips
INNER JOIN paced_train pt_left ON pt_left.legacy_train_schedule_id = train_schedule_round_trips.left_id
LEFT JOIN paced_train pt_right ON pt_right.legacy_train_schedule_id = train_schedule_round_trips.right_id;

-- Delete old train schedule round trips and train schedules
DELETE FROM train_schedule_round_trips;
DELETE FROM train_schedule;

-- Drop the temporary column
ALTER TABLE paced_train DROP COLUMN legacy_train_schedule_id;
