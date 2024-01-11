-- Your SQL goes here
-- for all signals
-- change tvm signaling system into TVM300/430 base on the value of is_430
-- change the tvm settings to Nf = true

UPDATE infra_object_signal SET data = jsonb_set(data, '{logical_signals}', (
    SELECT jsonb_agg(CASE WHEN logical_signal->>'signaling_system'='TVM' THEN
        CASE WHEN logical_signal->'settings'->>'is_430' = 'true' THEN '{"signaling_system": "TVM430", "settings": {"Nf": "true"}, "next_signaling_systems": []}'::jsonb
        ELSE '{"signaling_system": "TVM300", "settings": {"Nf": "true"}, "next_signaling_systems": []}'::jsonb
        END
        ELSE logical_signal END)
    FROM jsonb_array_elements(data->'logical_signals') logical_signal )
)
WHERE data->'logical_signals' IS NOT NULL and data->'logical_signals' != '[]'::jsonb;

UPDATE infra
SET railjson_version = '3.4.8';
