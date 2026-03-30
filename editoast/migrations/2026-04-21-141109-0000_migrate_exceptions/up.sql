INSERT INTO train_schedule_exception (
    timetable_id,
    train_schedule_id,
    key,
    occurrence_index,
    disabled,
    change_groups
)
SELECT
	timetable_train_schedule_set.timetable_id AS timetable_id,
	train_schedule.id AS train_schedule_id,
    elem->>'key' AS key,
    (elem->>'occurrence_index')::INTEGER AS occurrence_index,
    COALESCE((elem->>'disabled')::BOOLEAN, FALSE) AS disabled,
    (elem - 'occurrence_index' - 'disabled' - 'key') AS change_groups
FROM
    train_schedule
JOIN train_schedule_set ON train_schedule_set.id = train_schedule.train_schedule_set_id
JOIN timetable_train_schedule_set ON timetable_train_schedule_set.train_schedule_set_id = train_schedule_set.id
CROSS JOIN
    jsonb_array_elements(train_schedule.exceptions) AS elem
WHERE
	train_schedule.exceptions IS NOT NULL
	AND jsonb_array_length(train_schedule.exceptions) > 0;

ALTER TABLE train_schedule DROP COLUMN exceptions;
