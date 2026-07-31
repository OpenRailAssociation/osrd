ALTER TABLE train_schedule_linking
DROP CONSTRAINT unique_source,
DROP CONSTRAINT unique_target,
ADD UNIQUE NULLS NOT DISTINCT (timetable_id, source_train_schedule_id, source_occurrence_index, source_added_exception_id),
ADD UNIQUE NULLS NOT DISTINCT (timetable_id, target_train_schedule_id, target_occurrence_index, target_added_exception_id);
