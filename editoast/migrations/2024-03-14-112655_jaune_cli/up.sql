UPDATE infra_object_signal
SET data = jsonb_set(data, '{logical_signals}', (
    SELECT jsonb_agg(CASE WHEN logical_signal->>'signaling_system'='BAL'
        THEN jsonb_set(
            jsonb_set(logical_signal, '{default_parameters}', '{"jaune_cli": "false"}'),
            '{conditional_parameters}',
            '[]')
        ELSE jsonb_set(
            jsonb_set(logical_signal, '{default_parameters}', '{}'),
            '{conditional_parameters}',
            '[]')
        END)
    FROM jsonb_array_elements(data->'logical_signals') logical_signal )
)
WHERE data->'logical_signals' IS NOT NULL and data->'logical_signals' != '[]'::jsonb;

UPDATE infra
SET railjson_version = '3.4.11';
