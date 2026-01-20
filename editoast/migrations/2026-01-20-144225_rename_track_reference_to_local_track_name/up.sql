CREATE OR REPLACE FUNCTION rename_track_reference_to_local_track_name(path jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
SELECT COALESCE(
    jsonb_agg(
        jsonb_build_object(
            'id', elem->'id',
            'location',
            (elem->'location') - 'track_reference' ||
            jsonb_build_object(
                'local_track_name',
                elem#>'{location,track_reference}'
            )
        )
    ),
    '[]'::jsonb
)
FROM jsonb_array_elements(COALESCE(path, '[]'::jsonb)) AS elem;
$$;

UPDATE paced_train
SET path = rename_track_reference_to_local_track_name(path);

UPDATE paced_train
SET exceptions = (
    SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN elem ? 'path_and_schedule' THEN
                    jsonb_set(
                        elem,
                        '{path_and_schedule,path}',
                        rename_track_reference_to_local_track_name(elem#>'{path_and_schedule,path}'),
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

DROP FUNCTION rename_track_reference_to_local_track_name(jsonb);
