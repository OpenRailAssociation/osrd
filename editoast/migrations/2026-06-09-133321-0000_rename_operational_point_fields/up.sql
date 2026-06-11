-- Your SQL goes here
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{name}', COALESCE(data->'extensions'->'identifier'->'name', '"name"'::jsonb));
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{uic}', COALESCE(data->'extensions'->'identifier'->'uic', 'null'::jsonb));
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{main_code}', COALESCE(data->'extensions'->'sncf'->'trigram', '"main_code"'::jsonb));
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{secondary_code}', COALESCE(data->'extensions'->'sncf'->'ch', 'null'::jsonb));
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{secondary_name}', COALESCE(data->'extensions'->'sncf'->'ch_long_label', 'null'::jsonb));
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{country_code}', '"FR"'::jsonb);

UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{is_passenger_station}', to_jsonb(COALESCE(data->'extensions'->'sncf'->>'ch', 'BV') = 'BV' OR data->'extensions'->'sncf'->>'ch' = '00'));

UPDATE infra_object_operational_point
SET data = data - 'extensions';
UPDATE infra SET railjson_version = '3.5.3'
