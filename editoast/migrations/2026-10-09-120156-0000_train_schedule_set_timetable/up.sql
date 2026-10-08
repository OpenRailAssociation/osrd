ALTER TABLE timetable
    ADD train_schedule_set_id int8 UNIQUE REFERENCES train_schedule_set(id)
    ON DELETE CASCADE;

-- Whether this timetable is the one of a train schedule set
ALTER TABLE timetable ADD is_train_schedule_set BOOLEAN NOT NULL DEFAULT false;

INSERT INTO timetable (timetable_type, train_schedule_set_id, is_train_schedule_set)
SELECT timetable_type, id, true
FROM train_schedule_set;

ALTER TABLE train_schedule_set ADD timetable_id int8 UNIQUE REFERENCES timetable(id);

UPDATE train_schedule_set
SET timetable_id = timetable.id
FROM timetable
WHERE timetable.train_schedule_set_id = train_schedule_set.id;

ALTER TABLE train_schedule_set ALTER COLUMN timetable_id SET NOT NULL;

CREATE OR REPLACE FUNCTION check_train_schedule_set_timetable_id_is_immutable()
    RETURNS TRIGGER LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.timetable_id IS DISTINCT FROM OLD.timetable_id THEN
        RAISE EXCEPTION 'Cannot change timetable_id on train_schedule_set';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trigger_check_train_schedule_set_timetable_id_is_immutable
BEFORE UPDATE OF timetable_id ON train_schedule_set
FOR EACH ROW EXECUTE FUNCTION check_train_schedule_set_timetable_id_is_immutable();
