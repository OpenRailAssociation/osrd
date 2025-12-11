CREATE OR REPLACE FUNCTION op_remove_type(path jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN COALESCE(
                    elem#>'{location,operational_point}',
                    '{}'::jsonb
                ) ? 'type' THEN elem #- '{location,operational_point,type}'
                ELSE elem
            END
        ),
        '[]'::jsonb
    )
FROM jsonb_array_elements(COALESCE(path, '[]'::jsonb)) AS elem;
$$;
----------------------------------------
-- 1) train_schedule.path
----------------------------------------
UPDATE train_schedule
SET path = op_remove_type(path);
----------------------------------------
-- 2) paced_trains.path
----------------------------------------
UPDATE paced_train
SET path = op_remove_type(path);
----------------------------------------
-- 3) paced_trains.exceptions[*].path_and_schedule.path
----------------------------------------
UPDATE paced_train
SET exceptions = (
        SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN exc ? 'path_and_schedule'
                        AND exc->'path_and_schedule' ? 'path'
                        AND jsonb_typeof(exc->'path_and_schedule'->'path') = 'array' THEN jsonb_set(
                            exc,
                            '{path_and_schedule,path}',
                            op_remove_type(exc->'path_and_schedule'->'path'),
                            false
                        )
                        ELSE exc
                    END
                ),
                '[]'::jsonb
            )
        FROM jsonb_array_elements(COALESCE(exceptions, '[]'::jsonb)) AS exc
    )
WHERE exceptions IS NOT NULL;
