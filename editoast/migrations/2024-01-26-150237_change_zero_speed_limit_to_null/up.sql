UPDATE infra_object_speed_section
SET data = jsonb_set(data, '{speed_limit}', 'null'::jsonb)
WHERE (data->>'speed_limit')::float = 0;

UPDATE infra_object_speed_section
SET data = jsonb_set(
    data,
    '{speed_limit_by_tag}',
    COALESCE(
        (
            SELECT jsonb_object_agg(key, value)
            FROM jsonb_each(data->'speed_limit_by_tag')
            WHERE (value::float > 0)
        ),
        '{}'::jsonb
    )
)
WHERE data->'speed_limit_by_tag' IS NOT NULL;
