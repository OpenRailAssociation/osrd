-- This file should undo anything in `up.sql`
WITH
updated AS (
    SELECT
        id,
        jsonb_agg(
            CASE
                WHEN exception ? 'rolling_stock_category'
                AND jsonb_typeof(exception->'rolling_stock_category'->'value') = 'object'
                AND exception->'rolling_stock_category'->'value' ? 'main_category' THEN jsonb_set(
                    exception,
                    '{rolling_stock_category,value}',
                    to_jsonb(
                        exception->'rolling_stock_category'->'value'->>'main_category'
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
