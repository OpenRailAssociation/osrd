ALTER TABLE train_schedule
    ALTER COLUMN start_time TYPE bigint
    USING EXTRACT(EPOCH FROM start_time) * 1000;

UPDATE train_schedule_exception
    SET change_groups = jsonb_set(
        change_groups,
        '{start_time,value}',
        to_jsonb(
            EXTRACT(EPOCH FROM (change_groups -> 'start_time' ->> 'value')::timestamptz)::bigint * 1000
        )
    )
    WHERE change_groups ? 'start_time';
