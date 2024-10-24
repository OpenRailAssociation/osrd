CREATE TABLE temporary_speed_limit_group(
    id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    creation_date timestamptz NOT NULL,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE temporary_speed_limit (
    id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    start_date_time timestamptz NOT NULL,
    end_date_time timestamptz NOT NULL,
    speed_limit float8 NOT NULL,
    track_ranges jsonb NOT NULL,
    obj_id VARCHAR(255) NOT NULL,
    temporary_speed_limit_group_id int8 NOT NULL REFERENCES temporary_speed_limit_group(id) ON DELETE CASCADE,
    CONSTRAINT valid_time_period CHECK (start_date_time < end_date_time)
);

CREATE INDEX "temporary_speed_limit_date_time" ON "temporary_speed_limit" ("start_date_time");
CREATE INDEX "temporary_speed_limit_end_date_time" ON "temporary_speed_limit" ("end_date_time");
