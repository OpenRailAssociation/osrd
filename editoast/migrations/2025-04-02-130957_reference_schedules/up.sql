create table reference_schedule (
    id bigserial primary key,
    train_schedule bigint not null references train_schedule (id) on delete cascade,
    name varchar(128) not null,
    start_date timestamptz not null,
    traction_engine varchar(128) not null,
    towed_rolling_stock varchar(128) null,
    speed_limit_tag varchar(128) null,
    weight bigint null,
    stop_points_ci bigint[] not null,
    waypoints jsonb not null
);

create index idx_traction_engine on reference_schedule (traction_engine);
create index idx_towed_rolling_stock on reference_schedule (towed_rolling_stock);
create index idx_speed_limit_tag on reference_schedule (speed_limit_tag);
create index idx_weight on reference_schedule (weight);
create index idx_stop_points_ci on reference_schedule using gin (stop_points_ci);
