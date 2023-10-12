UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{extensions, psl_sncf, announcement}', (
  SELECT jsonb_agg(CASE WHEN elem->>'value' = '""' THEN jsonb_set(elem, '{value}', 'null'::jsonb) ELSE elem END)
  FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement') elem
))
WHERE data->'extensions'->'psl_sncf'->'announcement' IS NOT NULL AND data->'extensions'->'psl_sncf'->'announcement' != '[]'::jsonb;

UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{extensions, psl_sncf, r}', (
  SELECT jsonb_agg(CASE WHEN elem->>'value' = '""' THEN jsonb_set(elem, '{value}', 'null'::jsonb) ELSE elem END)
  FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'r') elem
))
WHERE data->'extensions'->'psl_sncf'->'r' IS NOT NULL AND data->'extensions'->'psl_sncf'->'r' != '[]'::jsonb;

UPDATE infra_object_speed_section SET data = jsonb_set(data, '{extensions, psl_sncf, z, value}', 'null'::jsonb)
WHERE data->'extensions'->'psl_sncf'->'z' IS NOT NULL AND data->'extensions'->'psl_sncf'->'z'->'value' = '""'::jsonb;
