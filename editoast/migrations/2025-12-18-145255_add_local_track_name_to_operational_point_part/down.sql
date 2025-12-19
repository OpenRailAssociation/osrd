UPDATE infra_object_operational_point
SET data = jsonb_set(
    data,
    '{parts}',
    (
        SELECT jsonb_agg(part - 'local_track_name')
        FROM jsonb_array_elements(data->'parts') AS part
    )
)
WHERE jsonb_array_length(data->'parts') > 0;

UPDATE infra
SET railjson_version = '3.5.0';
