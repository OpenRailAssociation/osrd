-- Your SQL goes here
UPDATE train_schedule
SET schedule = (
    SELECT COALESCE(jsonb_agg(elem - 'locked'), '[]'::jsonb)
    FROM jsonb_array_elements(schedule) AS elem
);

UPDATE train_schedule
SET path = (
    SELECT COALESCE(jsonb_agg(elem - 'deleted'), '[]'::jsonb)
    FROM jsonb_array_elements(path) AS elem
);

-- For paced_train table
UPDATE paced_train
SET schedule = (
    SELECT COALESCE(jsonb_agg(elem - 'locked'), '[]'::jsonb)
    FROM jsonb_array_elements(schedule) AS elem
);

UPDATE paced_train
SET path = (
    SELECT COALESCE(jsonb_agg(elem - 'deleted'), '[]'::jsonb)
    FROM jsonb_array_elements(path) AS elem
);

-- Also need to clean exceptions from these fields: remove "deleted" from each element of exception.path_and_schedule.path
UPDATE paced_train
SET exceptions = (
    SELECT COALESCE(jsonb_agg(
        CASE
            WHEN ex->'path_and_schedule' IS NULL THEN ex
            ELSE jsonb_set(
                ex,
                '{path_and_schedule,path}',
                (
                    SELECT COALESCE(jsonb_agg(path_item - 'deleted'), '[]'::jsonb)
                    FROM jsonb_array_elements(ex->'path_and_schedule'->'path') AS path_item
                )
            )
        END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(exceptions) AS ex
)
WHERE exceptions IS NOT NULL;

UPDATE paced_train
SET exceptions = (
    SELECT COALESCE(jsonb_agg(
        CASE
            WHEN ex->'path_and_schedule' IS NULL THEN ex
            ELSE jsonb_set(
                ex,
                '{path_and_schedule,schedule}',
                (
                    SELECT COALESCE(jsonb_agg(sch - 'locked'), '[]'::jsonb)
                    FROM jsonb_array_elements(ex->'path_and_schedule'->'schedule') AS sch
                )
            )
        END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(exceptions) AS ex
)
WHERE exceptions IS NOT NULL;
