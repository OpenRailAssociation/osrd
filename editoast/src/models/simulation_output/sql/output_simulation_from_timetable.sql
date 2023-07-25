SELECT
  s.id,
  s.mrsp,
  s.base_simulation,
  s.eco_simulation,
  s.electrification_ranges,
  s.power_restriction_ranges,
  s.train_schedule_id,
  t.departure_time as schedule_departure_time
FROM osrd_infra_simulationoutput s
  INNER JOIN osrd_infra_trainschedule t ON t.id = s.train_schedule_id
WHERE t.timetable_id = $1;
