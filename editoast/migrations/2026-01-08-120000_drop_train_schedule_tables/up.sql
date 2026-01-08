-- Drop legacy train schedule tables now fully superseded by paced_train
-- Order matters due to foreign key references
DROP TABLE IF EXISTS train_schedule_round_trips;
DROP TABLE IF EXISTS train_schedule;
