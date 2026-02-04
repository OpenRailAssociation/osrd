-- Your SQL goes here
ALTER TABLE paced_train
    RENAME TO train_schedule;
ALTER TABLE paced_train_round_trips
    RENAME TO train_schedule_round_trips;
