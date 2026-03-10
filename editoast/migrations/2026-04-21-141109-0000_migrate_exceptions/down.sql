ALTER TABLE train_schedule ADD COLUMN exceptions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- We cannot fill in the exceptions column because a train schedule may include multiple exceptions. Since it is not possible to aggregate this data, we have chosen, for the sake of simplicity, not to include it.
