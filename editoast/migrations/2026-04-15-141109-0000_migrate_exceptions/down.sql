ALTER TABLE train_schedule ADD COLUMN exceptions JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE train_schedule
SET exceptions = sub.reconstructed_exceptions
FROM (
    SELECT
        train_schedule_id,
        jsonb_agg(
            change_groups
            || jsonb_build_object('disabled', disabled)
            || CASE
                WHEN occurrence_index IS NOT NULL
                THEN jsonb_build_object('occurrence_index', occurrence_index)
                ELSE '{}'::jsonb
            END
            || CASE
                WHEN key IS NOT NULL
                THEN jsonb_build_object('key', key)
                ELSE '{}'::jsonb
            END
            ORDER BY occurrence_index ASC NULLS LAST
        ) AS reconstructed_exceptions
    FROM (
        SELECT DISTINCT
            train_schedule_id,
            key,
            occurrence_index,
            disabled,
            change_groups
        FROM train_schedule_exception
    ) distinct_exceptions
    GROUP BY train_schedule_id
) sub
WHERE train_schedule.id = sub.train_schedule_id;
