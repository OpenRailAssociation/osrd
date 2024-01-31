UPDATE infra_object_signal SET data = data #- '{extensions, sncf, kp}';
UPDATE infra_object_buffer_stop SET data = data #- '{extensions, sncf, kp}';
UPDATE infra_object_detector SET data = data #- '{extensions, sncf, kp}';
UPDATE infra_object_operational_point SET data = data #- '{extensions, sncf, kp}';

UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{extensions, psl_sncf, announcement}', (
  SELECT jsonb_agg(elem #- '{kp}')
  FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement') elem
))
WHERE data->'extensions'->'psl_sncf'->'announcement' IS NOT NULL AND data->'extensions'->'psl_sncf'->'announcement' != '[]'::jsonb;

UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{extensions, psl_sncf, r}', (
  SELECT jsonb_agg(elem #- '{kp}')
  FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'r') elem
))
WHERE data->'extensions'->'psl_sncf'->'r' IS NOT NULL AND data->'extensions'->'psl_sncf'->'r' != '[]'::jsonb;

UPDATE infra_object_speed_section SET data = data #- '{extensions, psl_sncf, z, kp}' WHERE data->'extensions'->'psl_sncf'->'z' IS NOT NULL;

ALTER TABLE infra ALTER column railjson_version set default '3.4.2';
UPDATE infra SET railjson_version = '3.4.2';
