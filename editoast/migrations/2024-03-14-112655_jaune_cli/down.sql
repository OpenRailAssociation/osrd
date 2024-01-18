UPDATE infra_object_signal
SET data = jsonb_set(data, '{logical_signals}', (
    SELECT jsonb_agg(logical_signal - '{default_parameters, conditional_parameters}'::text[])
    FROM jsonb_array_elements(data->'logical_signals') logical_signal )
)
WHERE data->'logical_signals' IS NOT NULL and data->'logical_signals' != '[]'::jsonb;


UPDATE infra
SET railjson_version = '3.4.10';
