-- Your SQL goes here
WITH
updated AS (
    SELECT
        id,
        jsonb_agg(
            CASE
                WHEN exception ? 'rolling_stock_category'
                AND jsonb_typeof(exception->'rolling_stock_category'->'value') = 'string' THEN jsonb_set(
                    exception,
                    '{rolling_stock_category,value}',
                    jsonb_build_object (
                        'main_category',
                        exception->'rolling_stock_category'->'value'
                    )
                )
                ELSE exception
            END
        ) AS updated_exceptions
    FROM paced_train, jsonb_array_elements(exceptions) AS exception
    GROUP BY id
)
UPDATE paced_train
SET exceptions = updated.updated_exceptions
FROM updated
WHERE paced_train.id = updated.id;
