UPDATE train_schedule
SET path = (
    SELECT jsonb_agg(
        jsonb_set(step, '{location}', (step -> 'location') - 'type')
        ORDER BY ordinality
    )
    FROM jsonb_array_elements(path) WITH ORDINALITY AS t(step, ordinality)
)
WHERE path IS NOT NULL;
UPDATE train_schedule
SET exceptions = (
    SELECT COALESCE(jsonb_agg(
        CASE
            WHEN exception ? 'path_and_schedule'
             AND (exception -> 'path_and_schedule') ? 'path'
                THEN jsonb_set(
                    exception,
                    '{path_and_schedule, path}',
                    (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_set(step, '{location}', (step -> 'location') - 'type')
                            ORDER BY step_ord
                        ), '[]'::jsonb)
                        FROM jsonb_array_elements(exception -> 'path_and_schedule' -> 'path')
                             WITH ORDINALITY AS s(step, step_ord)
                    )
                )
            ELSE exception
        END
        ORDER BY exc_ord
    ), '[]'::jsonb)
    FROM jsonb_array_elements(exceptions) WITH ORDINALITY AS e(exception, exc_ord)
)
WHERE exceptions IS NOT NULL;
