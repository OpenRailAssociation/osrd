CREATE OR REPLACE FUNCTION denormalize_path(path jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN elem ? 'location' THEN CASE
                    WHEN (elem->'location') ? 'track' OR (elem->'location') ? 'offset' 
                    THEN jsonb_build_object('id', elem->'id') 
                        || jsonb_strip_nulls(
                        jsonb_build_object('track', elem->'location'->'track', 'offset', elem->'location'->'offset')
                    )
                    ELSE jsonb_build_object('id', elem->'id') 
                    || COALESCE( elem->'location'->'operational_point','{}'::jsonb) 
                    || CASE
                        WHEN (elem->'location') ? 'track_reference' 
                        THEN jsonb_build_object('track_reference', elem->'location'->'track_reference')
                        ELSE '{}'::jsonb
                    END
                END
                ELSE elem
            END
        ),
        '[]'::jsonb
    )
FROM jsonb_array_elements(COALESCE(path, '[]'::jsonb)) AS elem;
$$;


UPDATE train_schedule
SET path = denormalize_path(path)
WHERE path IS NOT NULL;

UPDATE paced_train
SET path = denormalize_path(path)
WHERE path IS NOT NULL;

UPDATE paced_train
SET exceptions = (
        SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN elem ? 'path_and_schedule'
                        AND elem->'path_and_schedule' ? 'path' 
                        THEN jsonb_set(elem, '{path_and_schedule,path}',
                            denormalize_path(elem#>'{path_and_schedule,path}'),
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
DROP FUNCTION IF EXISTS denormalize_path(jsonb);
DROP FUNCTION IF EXISTS normalize_path(jsonb);
