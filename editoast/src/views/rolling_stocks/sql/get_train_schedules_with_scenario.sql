SELECT t.id as train_schedule_id,
  t.train_name,
  sce.id as scenario_id,
  sce.name as scenario_name,
  stu.id as study_id,
  stu.name as study_name,
  pro.id as project_id,
  pro.name as project_name
FROM osrd_infra_trainschedule t
  INNER JOIN osrd_infra_scenario sce ON t.timetable_id = sce.timetable_id
  INNER JOIN osrd_infra_study stu ON sce.study_id = stu.id
  INNER JOIN osrd_infra_project pro ON stu.project_id = pro.id
WHERE t.rolling_stock_id = $1;