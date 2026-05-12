ALTER TABLE train_schedule
    ALTER COLUMN start_time TYPE timestamptz
    USING to_timestamp(start_time / 1000.0);

UPDATE train_schedule_exception
    SET change_groups = jsonb_set(
        change_groups,
        '{start_time,value}',
        to_jsonb(
            to_timestamp((change_groups -> 'start_time' ->> 'value')::bigint / 1000.0)
        )
    )
    WHERE change_groups ? 'start_time';
