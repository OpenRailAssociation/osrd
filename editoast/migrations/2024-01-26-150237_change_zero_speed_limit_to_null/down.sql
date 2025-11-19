UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{speed_limit}', to_jsonb(0))
WHERE (data->>'speed_limit')::float IS NULL;
