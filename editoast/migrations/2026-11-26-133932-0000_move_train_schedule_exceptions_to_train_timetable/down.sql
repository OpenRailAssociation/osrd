UPDATE train_schedule_exception
SET timetable_id = timetable_inheritance.outer_timetable_id
FROM train_schedule
INNER JOIN timetable ON timetable.id = train_schedule.timetable_id
INNER JOIN timetable_inheritance ON timetable_inheritance.inner_timetable_id = timetable.id
WHERE train_schedule.id = train_schedule_exception.train_schedule_id
    AND timetable.is_train_schedule_set
    AND timetable.name IS NOT NULL;
