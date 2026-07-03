-- Your SQL goes here
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{main_code}', data->'name')
WHERE data->'main_code' = '""'::jsonb;


UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{secondary_code}',  'null'::jsonb)
WHERE data->'secondary_code' = '""'::jsonb;

UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{secondary_name}',  'null'::jsonb)
WHERE data->'secondary_name' = '""'::jsonb;

-- Fix unique constraints

DROP INDEX IF EXISTS uic_unique_index;
CREATE UNIQUE INDEX uic_unique_index ON infra_object_operational_point(infra_id, (data->>'uic'), (data->>'secondary_code')) NULLS NOT DISTINCT WHERE data->>'uic' IS NOT NULL;

DROP INDEX IF EXISTS plc_unique_index;
CREATE UNIQUE INDEX plc_unique_index ON infra_object_operational_point(infra_id, (data->>'plc')) WHERE data->>'plc' IS NOT NULL;

-- Add check on non blank main_code, secondary_code and secondary_name

ALTER TABLE infra_object_operational_point
ADD CONSTRAINT check_main_code_not_empty
CHECK ((data->>'main_code') IS NOT NULL AND (data->>'main_code') != '');

ALTER TABLE infra_object_operational_point
ADD CONSTRAINT check_secondary_code_not_empty
CHECK ((data->>'secondary_code') IS NULL OR (data->>'secondary_code') != '');

ALTER TABLE infra_object_operational_point
ADD CONSTRAINT check_secondary_name_not_empty
CHECK ((data->>'secondary_name') IS NULL OR (data->>'secondary_name') != '');
