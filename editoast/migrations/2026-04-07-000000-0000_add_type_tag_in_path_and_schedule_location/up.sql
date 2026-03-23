UPDATE train_schedule
SET path = (
    SELECT jsonb_agg(
        CASE
            WHEN (step -> 'location') ? 'track'
                THEN jsonb_set(step, '{location, type}', '"track_offset"')
            WHEN (step -> 'location') ? 'operational_point'
                THEN jsonb_set(step, '{location, type}', '"operational_point_part_reference"')
            ELSE step
        END
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
                            CASE
                                WHEN (step -> 'location') ? 'track'
                                    THEN jsonb_set(step, '{location, type}', '"track_offset"')
                                WHEN (step -> 'location') ? 'operational_point'
                                    THEN jsonb_set(step, '{location, type}', '"operational_point_part_reference"')
                                ELSE step
                            END
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
