UPDATE train_schedule
SET "interval" = NULL, time_window = NULL
WHERE "interval" <= '0'::interval OR time_window <= '0'::interval;

ALTER TABLE train_schedule
ADD CONSTRAINT non_zero_paced
CHECK ("interval" > '0'::interval AND time_window > '0'::interval);
