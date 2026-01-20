CREATE OR REPLACE FUNCTION rename_back_to_track_reference(path jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
SELECT COALESCE(
    jsonb_agg(
        jsonb_build_object(
            'id', elem->'id',
            'location',
            (elem->'location') - 'local_track_name' ||
            jsonb_build_object(
                'track_reference',
                elem#>'{location,local_track_name}'
            )
        )
    ),
    '[]'::jsonb
)
FROM jsonb_array_elements(COALESCE(path, '[]'::jsonb)) AS elem;
$$;

UPDATE paced_train
SET path = rename_back_to_track_reference(path);

UPDATE paced_train
SET exceptions = (
    SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN elem ? 'path_and_schedule' THEN
                    jsonb_set(
                        elem,
                        '{path_and_schedule,path}',
                        rename_back_to_track_reference(elem#>'{path_and_schedule,path}'),
                        true
                    )
                ELSE elem
            END
        ),
        '[]'::jsonb
    )
    FROM jsonb_array_elements(COALESCE(exceptions, '[]'::jsonb)) AS elem
)
WHERE exceptions IS NOT NULL;

DROP FUNCTION rename_back_to_track_reference(jsonb);
