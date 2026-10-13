CREATE SEQUENCE live_update_epoch AS BIGINT;

CREATE FUNCTION current_live_update_epoch() RETURNS int8 AS $$
BEGIN
    IF NULLIF(current_setting('transaction.live_update_epoch', true), '') IS NOT NULL THEN
        RETURN current_setting('transaction.live_update_epoch')::int8;
    ELSE
        PERFORM set_config('transaction.live_update_epoch', nextval('live_update_epoch')::text, true);
        RETURN current_setting('transaction.live_update_epoch')::int8;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE macro_note_history (
    macro_note_id int8 NOT NULL,
    scenario_id int8 NOT NULL, 
    x int8 NOT NULL,
    y int8 NOT NULL,
    title text NOT NULL,
    text text NOT NULL,
    labels text[] NOT NULL,
    validity int8range NOT NULL,
    PRIMARY KEY (macro_note_id, validity)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_current_macro_note_history_id ON macro_note_history(macro_note_id) WHERE upper(validity) IS NULL;
CREATE INDEX IF NOT EXISTS idx_macro_note_history_scenario_id ON macro_note_history(scenario_id);

CREATE FUNCTION macro_note_history_trigger() RETURNS trigger AS $$
DECLARE
    epoch int8;
    note RECORD;
    event_type text;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN
        RETURN NULL;
    END IF;

    epoch := current_live_update_epoch();
    
    IF TG_OP = 'DELETE' THEN
        note := OLD;
        event_type := 'NoteDeleted';
    ELSE
        note := NEW;
        event_type := 'NoteUpserted';
    END IF;

    DELETE FROM macro_note_history
    WHERE macro_note_id = note.id AND validity = int8range(epoch, NULL);

    UPDATE macro_note_history
    SET validity = int8range(lower(validity), epoch)
    WHERE macro_note_id = note.id AND upper(validity) IS NULL;

    IF TG_OP <> 'DELETE' THEN
        INSERT INTO macro_note_history(macro_note_id, scenario_id, x, y, title, text, labels, validity)
        VALUES (note.id, note.scenario_id, note.x, note.y, note.title, note.text, note.labels, int8range(epoch, NULL));
    END IF;

    PERFORM pg_notify('macro_note', json_build_object('epoch', epoch, 'type', event_type, 'id', note.id, 'scenario_id', note.scenario_id)::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER macro_note_history_trigger
AFTER INSERT OR UPDATE OR DELETE ON macro_note
FOR EACH ROW EXECUTE FUNCTION macro_note_history_trigger();

INSERT INTO macro_note_history(macro_note_id, scenario_id, x, y, title, text, labels, validity)
SELECT id, scenario_id, x, y, title, text, labels, int8range(current_live_update_epoch(), NULL)
FROM macro_note;
