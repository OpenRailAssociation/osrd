-- 1. Restore paced_train.timetable_id
ALTER TABLE paced_train
ADD COLUMN timetable_id int8 REFERENCES timetable(id) ON DELETE CASCADE;

UPDATE paced_train pt
SET timetable_id = ttss.timetable_id
FROM train_schedule_set tss
    JOIN timetable_train_schedule_set ttss ON tss.id = ttss.train_schedule_set_id
WHERE pt.train_schedule_set_id = tss.id;
ALTER TABLE paced_train
ALTER COLUMN timetable_id
SET NOT NULL;
ALTER TABLE paced_train DROP COLUMN train_schedule_set_id;
-- 2. Cleanup created data
-- Delete the train_schedule_sets we created. We identify them via the join table we are about to drop.
DELETE FROM train_schedule_set
WHERE id IN (
        SELECT train_schedule_set_id
        FROM timetable_train_schedule_set
    );
-- 3. Drop the join table
DROP TABLE timetable_train_schedule_set;
