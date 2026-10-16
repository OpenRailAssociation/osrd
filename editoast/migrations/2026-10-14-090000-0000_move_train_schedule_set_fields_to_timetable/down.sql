ALTER TABLE train_schedule_set
    ADD catalog_entry_id int8 REFERENCES catalog_entry(id),
    ADD name VARCHAR(255),
    ADD description TEXT NOT NULL DEFAULT '',
    ADD published BOOLEAN NOT NULL DEFAULT FALSE,
    ADD timetable_type timetable_type NOT NULL DEFAULT 'CALENDAR';

UPDATE train_schedule_set
SET catalog_entry_id = timetable.catalog_entry_id,
    name = timetable.name,
    description = timetable.description,
    published = timetable.published,
    timetable_type = timetable.timetable_type
FROM timetable
WHERE timetable.id = train_schedule_set.timetable_id;

ALTER TABLE train_schedule_set
    ADD CONSTRAINT train_schedule_set_catalog_entry_or_not_published CHECK (
        NOT published
        OR catalog_entry_id IS NOT NULL
    ),
    ADD CONSTRAINT train_schedule_set_name_or_not_catalog_entry CHECK (
        catalog_entry_id IS NULL
        OR name IS NOT NULL
    );

CREATE INDEX idx_train_schedule_set_catalog_entry_id ON train_schedule_set (catalog_entry_id);
CREATE UNIQUE INDEX train_schedule_set_catalog_entry_name_published_unique ON train_schedule_set (catalog_entry_id, name, timetable_type)
WHERE published = TRUE;

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

DROP TRIGGER IF EXISTS trigger_check_timetable_is_train_schedule_set_is_immutable ON timetable;
DROP FUNCTION IF EXISTS check_timetable_is_train_schedule_set_is_immutable();

ALTER TABLE timetable
    DROP COLUMN catalog_entry_id,
    DROP COLUMN name,
    DROP COLUMN description,
    DROP COLUMN published;
