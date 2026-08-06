CREATE OR REPLACE FUNCTION revert_path_step_trigram (path jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
SELECT
    jsonb_agg(
        CASE
            WHEN elem @? '$.location.operational_point.main_code' 
                THEN jsonb_set(
                    elem,
                    '{location,operational_point}',
                    jsonb_build_object(
                        'type', 'trigram',
                        'trigram', elem->'location'->'operational_point'->'main_code',
                        'secondary_code', elem->'location'->'operational_point'->'secondary_code'
                    )
                )
            ELSE elem
        END
    )
FROM jsonb_array_elements(path) AS elem;
$$;

UPDATE train_schedule SET path = revert_path_step_trigram(path);

UPDATE train_schedule_exception
SET change_groups = jsonb_set(
    change_groups,
    '{path_and_schedule,path}',
    revert_path_step_trigram(change_groups#>'{path_and_schedule,path}')
)
WHERE change_groups ? 'path_and_schedule';


DROP FUNCTION IF EXISTS revert_path_step_trigram(jsonb);
