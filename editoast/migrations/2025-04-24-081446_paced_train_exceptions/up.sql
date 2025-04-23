-- Your SQL goes here
ALTER TABLE paced_train ADD exceptions jsonb NOT NULL DEFAULT '[]'::jsonb;
