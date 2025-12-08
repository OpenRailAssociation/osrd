WITH last_path_step AS (
    SELECT id,
        jsonb_path_query(path, '$[last].id')::text as step_id
    FROM train_schedule
    WHERE train_schedule.start_time <= $2
        AND train_schedule.timetable_id = $1
),
scheduled_path_step AS (
    SELECT id,
        jsonb_path_query(schedule, '$[*]') as schedule_point
    FROM train_schedule
    WHERE train_schedule.start_time <= $2
        AND train_schedule.timetable_id = $1
),
arrival_time AS (
    SELECT last_path_step.id,
        (scheduled_path_step.schedule_point->>'arrival')::interval as arrival
    FROM last_path_step
        LEFT JOIN scheduled_path_step ON last_path_step.id = scheduled_path_step.id
        AND last_path_step.step_id = (scheduled_path_step.schedule_point->'at')::text
)
SELECT train_schedule.id,
    train_schedule.train_name,
    train_schedule.labels,
    train_schedule.rolling_stock_name,
    train_schedule.timetable_id,
    train_schedule.start_time,
    train_schedule.schedule,
    train_schedule.margins,
    train_schedule.initial_speed,
    train_schedule.comfort,
    train_schedule.path,
    train_schedule.constraint_distribution,
    train_schedule.speed_limit_tag,
    train_schedule.power_restrictions,
    train_schedule.options,
    train_schedule.main_category,
    train_schedule.sub_category
FROM train_schedule
    LEFT JOIN arrival_time ON train_schedule.id = arrival_time.id
WHERE train_schedule.start_time <= $2
    AND train_schedule.timetable_id = $1
    AND (
        arrival_time.arrival IS NULL
        OR train_schedule.start_time + arrival_time.arrival >= $3
    )
