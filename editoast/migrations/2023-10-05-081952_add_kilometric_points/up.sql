UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, kp}', '""');
UPDATE infra_object_buffer_stop SET data = jsonb_set(data, '{extensions, sncf, kp}', '""');
UPDATE infra_object_detector SET data = jsonb_set(data, '{extensions, sncf, kp}', '""');
UPDATE infra_object_operational_point SET data = jsonb_set(data, '{extensions, sncf, kp}', '""');

UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{extensions, psl_sncf, announcement}', (
  SELECT jsonb_agg(jsonb_set(elem, '{kp}', '""'))
  FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement') elem
))
WHERE data->'extensions'->'psl_sncf'->'announcement' IS NOT NULL AND data->'extensions'->'psl_sncf'->'announcement' != '[]'::jsonb;

UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{extensions, psl_sncf, r}', (
  SELECT jsonb_agg(jsonb_set(elem, '{kp}', '""'))
  FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'r') elem
))
WHERE data->'extensions'->'psl_sncf'->'r' IS NOT NULL AND data->'extensions'->'psl_sncf'->'r' != '[]'::jsonb;

UPDATE infra_object_speed_section SET data = jsonb_set(data, '{extensions, psl_sncf, z, kp}', '""') WHERE data->'extensions'->'psl_sncf'->'z' IS NOT NULL;

ALTER TABLE infra ALTER column railjson_version SET DEFAULT '3.4.3';
UPDATE infra SET railjson_version = '3.4.3';
