UPDATE infra_layer_error AS e
SET information = (
    SELECT jsonb_object_agg(key, value) FILTER (
        WHERE key IN ('field', 'is_warning', 'obj_id', 'obj_type')
    ) || jsonb_build_object(
        'sub_type',
        jsonb_object_agg(key, value) FILTER (
            WHERE key NOT IN ('field', 'is_warning', 'obj_id', 'obj_type', 'sub_type')
        )
    )
    FROM jsonb_each(e.information)
)
WHERE NOT e.information ? 'sub_type';
