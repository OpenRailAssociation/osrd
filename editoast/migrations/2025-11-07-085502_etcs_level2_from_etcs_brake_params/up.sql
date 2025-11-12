ALTER TABLE rolling_stock
ADD COLUMN supported_signaling_systems_tmp jsonb;

UPDATE rolling_stock
SET supported_signaling_systems_tmp = (
    SELECT jsonb_agg(jsonb_build_object('type', value))
    FROM unnest(supported_signaling_systems) AS value
    WHERE value IS DISTINCT FROM 'ETCS_LEVEL2'
);

UPDATE rolling_stock
SET supported_signaling_systems_tmp = supported_signaling_systems_tmp || jsonb_build_array(
    jsonb_build_object('type', 'ETCS_LEVEL2', 'brake_params', etcs_brake_params)
)
WHERE etcs_brake_params IS NOT NULL
    AND etcs_brake_params != 'null'::jsonb
    AND jsonb_typeof(etcs_brake_params) = 'object';

ALTER TABLE rolling_stock DROP COLUMN supported_signaling_systems;

ALTER TABLE rolling_stock DROP COLUMN etcs_brake_params;

ALTER TABLE rolling_stock
ALTER COLUMN supported_signaling_systems_tmp SET NOT NULL;

ALTER TABLE rolling_stock
RENAME COLUMN supported_signaling_systems_tmp TO supported_signaling_systems;
