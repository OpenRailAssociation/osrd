CREATE OR REPLACE FUNCTION normalize_local_track_name_in_path(path jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
SELECT
    jsonb_agg(
        CASE
            WHEN elem @? '$.location.local_track_name.track_name'
                THEN jsonb_set(
                    elem,
                    '{location,local_track_name}',
                    elem->'location'->'local_track_name'->'track_name'
                )
            ELSE elem
        END
    )
FROM jsonb_array_elements(path) AS elem;
$$;

UPDATE train_schedule
SET path = normalize_local_track_name_in_path(path)
WHERE path IS NOT NULL;

UPDATE train_schedule_exception
SET change_groups = jsonb_set(
    change_groups,
    '{path_and_schedule,path}',
    normalize_local_track_name_in_path(change_groups#>'{path_and_schedule,path}')
)
WHERE change_groups ? 'path_and_schedule';

DROP FUNCTION normalize_local_track_name_in_path(jsonb);
