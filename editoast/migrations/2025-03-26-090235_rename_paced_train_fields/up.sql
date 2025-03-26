ALTER TABLE paced_train RENAME COLUMN step TO interval;
ALTER TABLE paced_train RENAME COLUMN duration TO time_window;
