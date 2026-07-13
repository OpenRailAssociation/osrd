-- This file should undo anything in `up.sql`
UPDATE train_schedule
SET path = jsonb(replace(path #>> '{}', '"key":', '"id":'));
