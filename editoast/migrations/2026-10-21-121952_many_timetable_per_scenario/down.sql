-- The rollback has some caveats
-- It will work as expected as long as the data keeps a 1-1 relationship

ALTER TABLE scenario
ADD COLUMN timetable_id BIGINT REFERENCES timetable(id) ON DELETE CASCADE;

-- There could be dataloss here
-- But it should be acceptable as we shouldn’t rollback after adding multiple scenarios
UPDATE scenario
SET timetable_id = scenario_timetable.timetable_id
FROM scenario_timetable
WHERE scenario_id = scenario.id;

-- This could fail
ALTER TABLE scenario
ALTER COLUMN timetable_id SET NOT NULL;

DROP TABLE scenario_timetable;
