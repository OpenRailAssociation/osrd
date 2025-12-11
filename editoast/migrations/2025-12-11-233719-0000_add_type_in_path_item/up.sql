CREATE OR REPLACE FUNCTION op_add_type(path jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN COALESCE(
                    elem->'location'->'operational_point',
                    '{}'::jsonb
                ) ? 'uic' THEN jsonb_set(
                    elem,
                    '{location,operational_point,type}',
                    '"uic"'::jsonb,
                    true
                )
                WHEN COALESCE(
                    elem->'location'->'operational_point',
                    '{}'::jsonb
                ) ? 'trigram' THEN jsonb_set(
                    elem,
                    '{location,operational_point,type}',
                    '"trigram"'::jsonb,
                    true
                )
                WHEN COALESCE(
                    elem->'location'->'operational_point',
                    '{}'::jsonb
                ) ? 'operational_point' THEN jsonb_set(
                    elem,
                    '{location,operational_point,type}',
                    '"id"'::jsonb,
                    true
                )
                ELSE elem
            END
        ),
        '[]'::jsonb
    )
FROM jsonb_array_elements(COALESCE(path, '[]'::jsonb)) AS elem;
$$;
----------------------------------------
-- 1) update train schedule path
----------------------------------------
UPDATE train_schedule
SET path = op_add_type(path);
----------------------------------------
-- 2) update paced train main path
----------------------------------------
UPDATE paced_train
SET path = op_add_type(path);
----------------------------------------
-- 3) update exceptions
----------------------------------------
UPDATE paced_train
SET exceptions = (
        SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN elem ? 'path_and_schedule'
                        AND elem->'path_and_schedule' ? 'path'
                        AND jsonb_typeof(elem->'path_and_schedule'->'path') = 'array' THEN jsonb_set(
                            elem,
                            '{path_and_schedule,path}',
                            op_add_type(elem->'path_and_schedule'->'path'),
                            false
                        )
                        ELSE elem
                    END
                ),
                '[]'::jsonb
            )
        FROM jsonb_array_elements(COALESCE(exceptions, '[]'::jsonb)) AS elem
    )
WHERE exceptions IS NOT NULL;
