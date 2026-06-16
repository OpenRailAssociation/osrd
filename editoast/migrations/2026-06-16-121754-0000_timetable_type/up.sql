CREATE TYPE "timetable_type" AS ENUM (
    'CALENDAR',
    'HOURLY'
);

ALTER TABLE "timetable"
ADD "timetable_type" timetable_type NOT NULL DEFAULT 'CALENDAR';

ALTER TABLE "train_schedule_set"
ADD "timetable_type" timetable_type NOT NULL DEFAULT 'CALENDAR';

CREATE OR REPLACE FUNCTION check_add_only_paced_in_hourly_train_schedule_set()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM train_schedule_set
        WHERE train_schedule_set.id = NEW.train_schedule_set_id
        AND train_schedule_set.timetable_type = 'HOURLY'
    ) THEN
        -- Check if a unique train is inserted or updated in an HOURLY train_schedule_set
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


CREATE OR REPLACE FUNCTION check_timetable_type_is_immutable()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.timetable_type IS DISTINCT FROM OLD.timetable_type THEN
        RAISE EXCEPTION 'Cannot change timetable_type on timetable';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trigger_check_timetable_type_is_immutable
BEFORE UPDATE OF timetable_type ON timetable
FOR EACH ROW EXECUTE FUNCTION check_timetable_type_is_immutable();

CREATE OR REPLACE FUNCTION check_train_schedule_set_timetable_type_is_immutable()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.timetable_type IS DISTINCT FROM OLD.timetable_type THEN
        RAISE EXCEPTION 'Cannot change timetable_type on train_schedule_set';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trigger_check_train_schedule_set_timetable_type_is_immutable
BEFORE UPDATE OF timetable_type ON train_schedule_set
FOR EACH ROW EXECUTE FUNCTION check_train_schedule_set_timetable_type_is_immutable();


CREATE OR REPLACE FUNCTION check_timetable_and_train_schedule_set_same_type()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM timetable, train_schedule_set
        WHERE timetable.id = NEW.timetable_id
            AND train_schedule_set.id = NEW.train_schedule_set_id
            AND timetable.timetable_type != train_schedule_set.timetable_type
    )
    THEN
        RAISE EXCEPTION 'Cannot insert or update timetable_train_schedule_set with mismatched timetable and train_schedule_set types';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trigger_check_timetable_and_train_schedule_set_same_type
BEFORE INSERT OR UPDATE OF timetable_id, train_schedule_set_id ON timetable_train_schedule_set
FOR EACH ROW EXECUTE FUNCTION check_timetable_and_train_schedule_set_same_type();

CREATE OR REPLACE FUNCTION check_stdcm_search_environment_timetable_type_is_calendar()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE timetable.id = NEW.timetable_id
            AND timetable.timetable_type != 'CALENDAR'
    )
    THEN
        RAISE EXCEPTION 'Cannot insert or update stdcm_search_environment with non calendar timetable_type in timetable';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trigger_check_stdcm_search_environment_timetable_type_is_calendar
BEFORE INSERT OR UPDATE OF timetable_id ON stdcm_search_environment
FOR EACH ROW EXECUTE FUNCTION check_stdcm_search_environment_timetable_type_is_calendar();
