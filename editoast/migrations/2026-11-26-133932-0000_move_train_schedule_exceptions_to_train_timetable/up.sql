
-- Remove one of the identical duplicated exceptions
DELETE FROM train_schedule_exception
USING train_schedule_exception AS current_tse
WHERE current_tse.train_schedule_id = train_schedule_exception.train_schedule_id
    AND current_tse.occurrence_index = train_schedule_exception.occurrence_index
    AND current_tse.disabled = train_schedule_exception.disabled
    AND current_tse.change_groups = train_schedule_exception.change_groups
    AND current_tse.id < train_schedule_exception.id;

-- Remove the oldest duplicated exceptions: same occurrence, or same key
DELETE FROM train_schedule_exception
USING train_schedule_exception AS current_tse
WHERE current_tse.train_schedule_id = train_schedule_exception.train_schedule_id
    AND (
        current_tse.occurrence_index = train_schedule_exception.occurrence_index
        OR current_tse.key = train_schedule_exception.key
    )
    AND current_tse.id > train_schedule_exception.id;

-- Move exceptions from trains_schedules_sets
UPDATE train_schedule_exception
SET timetable_id = train_schedule.timetable_id
FROM train_schedule
INNER JOIN timetable ON timetable.id = train_schedule.timetable_id
WHERE train_schedule.id = train_schedule_exception.train_schedule_id
    AND timetable.is_train_schedule_set
    AND timetable.name IS NOT NULL
    AND train_schedule_exception.timetable_id <> train_schedule.timetable_id;

-- Move exceptions from sandboxes to parent timetable
UPDATE train_schedule_exception
SET timetable_id = timetable_inheritance.outer_timetable_id
FROM train_schedule
INNER JOIN timetable ON timetable.id = train_schedule.timetable_id
INNER JOIN timetable_inheritance ON timetable_inheritance.inner_timetable_id = timetable.id
WHERE train_schedule.id = train_schedule_exception.train_schedule_id
    AND timetable.is_train_schedule_set
    AND timetable.name IS NULL;
