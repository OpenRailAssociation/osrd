-- Your SQL goes here
UPDATE infra_object_operational_point SET data = jsonb_set(data, '{plc}', 'null'::jsonb);
UPDATE infra SET railjson_version = '3.5.2';
