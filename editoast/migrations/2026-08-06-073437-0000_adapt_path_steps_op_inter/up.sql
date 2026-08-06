CREATE OR REPLACE FUNCTION adapt_path_step_trigram (path jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
SELECT
    jsonb_agg(
        CASE
            WHEN elem @? '$.location.operational_point.trigram' 
                THEN jsonb_set(
                    elem,
                    '{location,operational_point}',
                    jsonb_build_object(
                        'type', 'domestic',
                        'country_code', 'FR',
                        'main_code', elem->'location'->'operational_point'->'trigram',
                        'secondary_code', elem->'location'->'operational_point'->'secondary_code'
                    )
                )
            ELSE elem
        END
    )
FROM jsonb_array_elements(path) AS elem;
$$;

UPDATE train_schedule SET path = adapt_path_step_trigram(path);

UPDATE train_schedule_exception
SET change_groups = jsonb_set(
    change_groups,
    '{path_and_schedule,path}',
    adapt_path_step_trigram(change_groups#>'{path_and_schedule,path}')
)
WHERE change_groups ? 'path_and_schedule';


DROP FUNCTION IF EXISTS adapt_path_step_trigram(jsonb);
