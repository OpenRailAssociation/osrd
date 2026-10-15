-- Add the train_schedule_set fields to timetable
ALTER TABLE timetable
    ADD catalog_entry_id int8 REFERENCES catalog_entry(id),
    ADD name VARCHAR(255),
    ADD description TEXT NOT NULL DEFAULT '',
    ADD published BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT timetable_catalog_entry_or_not_published CHECK (
        NOT is_train_schedule_set
        OR NOT published
        OR catalog_entry_id IS NOT NULL
    ),
    ADD CONSTRAINT timetable_name_or_not_catalog_entry CHECK (
        NOT is_train_schedule_set
        OR catalog_entry_id IS NULL
        OR name IS NOT NULL
    );

-- Transfer the data
UPDATE timetable
SET catalog_entry_id = train_schedule_set.catalog_entry_id,
    name = train_schedule_set.name,
    description = train_schedule_set.description,
    published = train_schedule_set.published
FROM train_schedule_set
WHERE train_schedule_set.timetable_id = timetable.id;

CREATE INDEX idx_timetable_catalog_entry_id ON timetable (catalog_entry_id)
WHERE is_train_schedule_set;
CREATE UNIQUE INDEX timetable_catalog_entry_name_published_unique ON timetable (catalog_entry_id, name, timetable_type)
WHERE is_train_schedule_set AND published;

-- A timetable can't become or stop being the one of a train schedule set
CREATE OR REPLACE FUNCTION check_timetable_is_train_schedule_set_is_immutable()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_train_schedule_set IS DISTINCT FROM OLD.is_train_schedule_set THEN
        RAISE EXCEPTION 'Cannot change is_train_schedule_set on timetable';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trigger_check_timetable_is_train_schedule_set_is_immutable
BEFORE UPDATE OF is_train_schedule_set ON timetable
FOR EACH ROW EXECUTE FUNCTION check_timetable_is_train_schedule_set_is_immutable();

-- Remove the now unused trigger, timetable_type will only be in timetable
DROP TRIGGER IF EXISTS trigger_check_train_schedule_set_timetable_type_is_immutable ON train_schedule_set;
DROP FUNCTION IF EXISTS check_train_schedule_set_timetable_type_is_immutable();

-- Replace the function of the existing trigger, adding a join with timetable
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

-- Replace the function of the existing trigger, adding a join with timetable
CREATE OR REPLACE FUNCTION check_timetable_and_train_schedule_set_same_type()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM timetable, train_schedule_set
        INNER JOIN timetable AS train_schedule_set_timetable
            ON train_schedule_set_timetable.id = train_schedule_set.timetable_id
        WHERE timetable.id = NEW.timetable_id
            AND train_schedule_set.id = NEW.train_schedule_set_id
            AND timetable.timetable_type != train_schedule_set_timetable.timetable_type
    )
    THEN
        RAISE EXCEPTION 'Cannot insert or update timetable_train_schedule_set with mismatched timetable and train_schedule_set types';
    END IF;
    RETURN NEW;
END;
$$;

-- Drops along the constraints and indexes of these columns, now held by the timetable
ALTER TABLE train_schedule_set
    DROP COLUMN catalog_entry_id,
    DROP COLUMN name,
    DROP COLUMN description,
    DROP COLUMN published,
    -- It is only in the timetable table now
    DROP COLUMN timetable_type;
