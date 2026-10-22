-- A train schedule belongs to the timetable of its train schedule set
ALTER TABLE train_schedule
    ADD timetable_id int8 REFERENCES timetable(id) ON DELETE CASCADE;

UPDATE train_schedule
SET timetable_id = train_schedule_set.timetable_id
FROM train_schedule_set
WHERE train_schedule_set.id = train_schedule.train_schedule_set_id;

ALTER TABLE train_schedule ALTER COLUMN timetable_id SET NOT NULL;
CREATE INDEX idx_train_schedule_timetable_id ON train_schedule (timetable_id);
CREATE INDEX idx_train_schedule_id_timetable_id ON train_schedule (id, timetable_id);

-- Replace the function of the existing trigger, reading the type from the timetable of the train schedule
CREATE OR REPLACE FUNCTION check_add_only_paced_in_hourly_train_schedule_set()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE timetable.id = NEW.timetable_id
        AND timetable.timetable_type = 'HOURLY'
    ) THEN
        IF NEW.time_window IS NULL OR NEW.interval IS NULL THEN
            RAISE EXCEPTION 'Cannot insert or update train_schedule with NULL time_window or interval for HOURLY timetable_type in train_schedule_set';
        END IF;
        IF NOT (0 <= NEW.start_time AND NEW.start_time * INTERVAL '1 millisecond' < NEW.interval AND NEW.interval <= NEW.time_window) THEN
            RAISE EXCEPTION 'Invalid paced train_schedule: start_time=% must be >= 0 and < interval=%, interval must be <= time_window=%',
                NEW.start_time,
                NEW.interval,
                NEW.time_window;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
-- Replace the existing trigger, now fired by a change of timetable_id
CREATE OR REPLACE TRIGGER trigger_check_add_only_paced_in_hourly_train_schedule_set
BEFORE INSERT OR UPDATE OF timetable_id, time_window, interval, start_time ON train_schedule
FOR EACH ROW EXECUTE FUNCTION check_add_only_paced_in_hourly_train_schedule_set();

-- Drops along its foreign key and indexes
ALTER TABLE train_schedule DROP COLUMN train_schedule_set_id;
