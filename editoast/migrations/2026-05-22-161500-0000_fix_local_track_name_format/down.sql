-- Irreversible data correction migration.
-- It normalizes malformed JSON values in-place.
-- Add a noop so the migration can still be reversed
-- since it won't cause any breaking change.
SELECT 1;
