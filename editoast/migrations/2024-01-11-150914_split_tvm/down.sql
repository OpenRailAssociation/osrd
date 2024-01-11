UPDATE infra_object_signal SET data = jsonb_set(data, '{logical_signals}', (
    SELECT jsonb_agg(
        CASE WHEN logical_signal->>'signaling_system'='TVM300' THEN
            '{"signaling_system": "TVM", "settings": {"is_430": "false"}, "next_signaling_systems": []}'::jsonb
        WHEN logical_signal->>'signaling_system'='TVM430' THEN
                '{"signaling_system": "TVM", "settings": {"is_430": "true"}, "next_signaling_systems": []}'::jsonb
        ELSE
            logical_signal
        END
    )
    FROM jsonb_array_elements(data->'logical_signals') logical_signal )
)
WHERE data->'logical_signals' IS NOT NULL and data->'logical_signals' != '[]'::jsonb;

UPDATE infra
SET railjson_version = '3.4.7';
