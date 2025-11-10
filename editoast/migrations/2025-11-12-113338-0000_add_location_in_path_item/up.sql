CREATE OR REPLACE FUNCTION normalize_path(path jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('id', elem->'id', 'location',
                CASE
                    WHEN elem ? 'track' OR elem ? 'offset' 
                    THEN jsonb_strip_nulls(jsonb_build_object('track', elem->'track', 'offset', elem->'offset'))
                    ELSE jsonb_build_object('operational_point', jsonb_strip_nulls(elem - 'id' - 'track_reference'),
                        'track_reference', elem->'track_reference'
                    )
                END
            )
        ),
        '[]'::jsonb
    )
FROM jsonb_array_elements(COALESCE(path, '[]'::jsonb)) AS elem;
$$;

UPDATE train_schedule
SET path = normalize_path(path);

UPDATE paced_train
SET path = normalize_path(path);

UPDATE paced_train
SET exceptions = (
        SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN elem ? 'path_and_schedule' THEN jsonb_set(elem,'{path_and_schedule,path}',
                            normalize_path(elem#>'{path_and_schedule,path}'),
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
DROP FUNCTION normalize_path(jsonb);
