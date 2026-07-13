-- Your SQL goes here
UPDATE train_schedule
SET path = jsonb(replace(path #>> '{}', '"id":', '"key":'));
