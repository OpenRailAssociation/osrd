ALTER TABLE rolling_stock
ADD COLUMN supported_signaling_systems_jsonb jsonb;

UPDATE rolling_stock
SET supported_signaling_systems_jsonb = to_jsonb(supported_signaling_systems);

ALTER TABLE rolling_stock DROP COLUMN supported_signaling_systems;

ALTER TABLE rolling_stock
ALTER COLUMN supported_signaling_systems_jsonb SET NOT NULL;

ALTER TABLE rolling_stock
RENAME COLUMN supported_signaling_systems_jsonb TO supported_signaling_systems;

UPDATE rolling_stock
SET supported_signaling_systems = supported_signaling_systems || jsonb_build_array(jsonb_build_object('brake_params', etcs_brake_params))
WHERE etcs_brake_params IS NOT NULL
    AND  etcs_brake_params != 'null'::jsonb
    AND jsonb_typeof(etcs_brake_params) = 'object';

ALTER TABLE rolling_stock DROP COLUMN etcs_brake_params;
