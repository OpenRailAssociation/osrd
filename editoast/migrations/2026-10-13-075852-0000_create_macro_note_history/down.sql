DROP TRIGGER IF EXISTS macro_note_history_trigger ON macro_note;
DROP FUNCTION IF EXISTS macro_note_history_trigger();
DROP TABLE IF EXISTS macro_note_history;
DROP FUNCTION IF EXISTS current_live_update_epoch();
DROP SEQUENCE IF EXISTS live_update_epoch;