-- This file should undo anything in `up.sql`
ALTER TABLE train_schedule
    RENAME TO paced_train;
ALTER TABLE train_schedule_round_trips
    RENAME TO paced_train_round_trips;
