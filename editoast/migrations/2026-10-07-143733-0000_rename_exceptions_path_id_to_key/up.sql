UPDATE train_schedule_exception
SET change_groups = jsonb_set(
    change_groups,
    '{path_and_schedule,path}'::text[],
    jsonb(replace(change_groups #>> '{path_and_schedule,path}'::text[], '"id":', '"key":')),
    false
)
WHERE change_groups @? '$.path_and_schedule.path';
