ALTER TABLE rolling_stock
ADD COLUMN etcs_brake_params jsonb DEFAULT 'null'::jsonb;

UPDATE rolling_stock
SET etcs_brake_params = (
    SELECT value->'brake_params'
    FROM jsonb_array_elements(supported_signaling_systems) AS elem(value)
    WHERE jsonb_typeof(value) = 'object'
        AND value->>'type' = 'ETCS_LEVEL2'
        AND value ? 'brake_params'
    LIMIT 1
);

UPDATE rolling_stock
SET etcs_brake_params = 'null'::jsonb
WHERE etcs_brake_params IS NULL;

ALTER TABLE rolling_stock
ALTER COLUMN etcs_brake_params SET NOT NULL,
ALTER COLUMN etcs_brake_params SET DEFAULT 'null'::jsonb;

ALTER TABLE rolling_stock
ADD COLUMN supported_signaling_systems_tmp text[];

UPDATE rolling_stock
SET supported_signaling_systems_tmp = COALESCE((
    SELECT array_agg(value->>'type')
    FROM jsonb_array_elements(supported_signaling_systems) AS elem(value)
    WHERE jsonb_typeof(value) = 'object'
        AND value ? 'type'
        AND (value->>'type') IS NOT NULL
        AND (value->>'type') != 'ETCS_LEVEL2'
), ARRAY[]::text[]);

ALTER TABLE rolling_stock
DROP COLUMN supported_signaling_systems;

ALTER TABLE rolling_stock
RENAME COLUMN supported_signaling_systems_tmp TO supported_signaling_systems;
