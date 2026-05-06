-- This file should undo anything in `up.sql`
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions}', '{}'::jsonb);
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, identifier}', '{}'::jsonb);
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, sncf}', '{}'::jsonb);
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, identifier, name}', data->'name');
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, identifier, uic}', data->'uic');
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, sncf, trigram}', data->'main_code');

UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, sncf, ch}',
    CASE
        WHEN (data->>'is_passenger_station')::boolean THEN '"BV"'::jsonb
        ELSE COALESCE(NULLIF(data->'secondary_code', 'null'::jsonb), '""'::jsonb)
    END
);

UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, sncf, ch_long_label}', COALESCE(NULLIF(data->'secondary_name', 'null'::jsonb), '""'::jsonb));
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, sncf, ci}', '0'::jsonb);
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{extensions, sncf, ch_short_label}', '""'::jsonb);
UPDATE infra_object_operational_point
SET data = data  - 'name' - 'uic' - 'main_code' - 'secondary_code' - 'secondary_name' - 'country_code' - 'is_passenger_station' ;
UPDATE infra SET railjson_version = '3.5.2'
