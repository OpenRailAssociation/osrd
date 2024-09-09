SELECT train_schedule.id as train_schedule_id,
  train_schedule.train_name,
  scenario.id as scenario_id,
  scenario.name as scenario_name,
  study.id as study_id,
  study.name as study_name,
  project.id as project_id,
  project.name as project_name
FROM train_schedule
  INNER JOIN scenario ON train_schedule.timetable_id = scenario.timetable_id
  INNER JOIN study ON scenario.study_id = study.id
  INNER JOIN project ON study.project_id = project.id
WHERE train_schedule.rolling_stock_id = $1;
