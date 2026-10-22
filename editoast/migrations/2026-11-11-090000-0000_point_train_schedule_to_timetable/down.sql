ALTER TABLE train_schedule
    ADD train_schedule_set_id int8;

UPDATE train_schedule
SET train_schedule_set_id = train_schedule_set.id
FROM train_schedule_set
WHERE train_schedule_set.timetable_id = train_schedule.timetable_id;

ALTER TABLE train_schedule
    ALTER COLUMN train_schedule_set_id SET NOT NULL,
    ADD CONSTRAINT paced_train_train_schedule_set_id_fkey
        FOREIGN KEY (train_schedule_set_id) REFERENCES train_schedule_set(id) ON DELETE CASCADE;
CREATE INDEX idx_paced_train_train_schedule_set_id ON train_schedule (train_schedule_set_id);
CREATE INDEX train_schedule_train_schedule_set_id_id_idx ON train_schedule (id, train_schedule_set_id);

CREATE OR REPLACE FUNCTION check_add_only_paced_in_hourly_train_schedule_set()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM train_schedule_set
        INNER JOIN timetable ON timetable.id = train_schedule_set.timetable_id
        WHERE train_schedule_set.id = NEW.train_schedule_set_id
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
CREATE OR REPLACE TRIGGER trigger_check_add_only_paced_in_hourly_train_schedule_set
BEFORE INSERT OR UPDATE OF train_schedule_set_id, time_window, interval, start_time ON train_schedule
FOR EACH ROW EXECUTE FUNCTION check_add_only_paced_in_hourly_train_schedule_set();

-- Drops along its foreign key and indexes
ALTER TABLE train_schedule DROP COLUMN timetable_id;
