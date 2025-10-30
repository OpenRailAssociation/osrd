-- This file should undo anything in `up.sql`
UPDATE train_schedule
SET schedule = (
    SELECT jsonb_agg(jsonb_set(elem, '{locked}', 'true'::jsonb, true))
    FROM jsonb_array_elements(schedule) AS elem
)
WHERE schedule IS NOT NULL;

UPDATE train_schedule
SET path = (
    SELECT jsonb_agg(jsonb_set(elem, '{deleted}', 'false'::jsonb, true))
    FROM jsonb_array_elements(path) AS elem
)
WHERE path IS NOT NULL;
