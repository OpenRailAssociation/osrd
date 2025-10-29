ALTER TABLE rolling_stock
ADD COLUMN etcs_brake_params jsonb;

UPDATE rolling_stock
SET etcs_brake_params = (
  SELECT value->'brake_params'
  FROM jsonb_array_elements(supported_signaling_systems) AS elem(value)
  WHERE jsonb_typeof(value) = 'object'
    AND value ? 'brake_params'
  LIMIT 1
);

UPDATE rolling_stock
SET etcs_brake_params = 'null'::jsonb where etcs_brake_params is null;

ALTER TABLE rolling_stock
ALTER COLUMN etcs_brake_params SET NOT NULL,
ALTER COLUMN etcs_brake_params SET DEFAULT 'null'::jsonb;

ALTER TABLE rolling_stock
ADD COLUMN supported_signaling_systems_text text[];

UPDATE rolling_stock
SET supported_signaling_systems_text = (
  SELECT array_agg(trim(both '"' from elem.value::text))
  FROM jsonb_array_elements(supported_signaling_systems) AS elem(value)
  WHERE jsonb_typeof(elem.value) = 'string'
);

ALTER TABLE rolling_stock
DROP COLUMN supported_signaling_systems;

ALTER TABLE rolling_stock
RENAME COLUMN supported_signaling_systems_text TO supported_signaling_systems;
