DROP TRIGGER IF EXISTS trigger_check_add_only_paced_in_hourly_train_schedule_set ON train_schedule;
DROP FUNCTION IF EXISTS check_add_only_paced_in_hourly_train_schedule_set();

DROP TRIGGER IF EXISTS trigger_check_timetable_and_train_schedule_set_same_type ON timetable_train_schedule_set;
DROP FUNCTION IF EXISTS check_timetable_and_train_schedule_set_same_type();

DROP TRIGGER IF EXISTS trigger_check_stdcm_search_environment_timetable_type_is_calendar ON stdcm_search_environment;
DROP FUNCTION IF EXISTS check_stdcm_search_environment_timetable_type_is_calendar();

DROP TRIGGER IF EXISTS trigger_check_timetable_type_is_immutable ON timetable;
DROP FUNCTION IF EXISTS check_timetable_type_is_immutable();

DROP TRIGGER IF EXISTS trigger_check_train_schedule_set_timetable_type_is_immutable ON train_schedule_set;
DROP FUNCTION IF EXISTS check_train_schedule_set_timetable_type_is_immutable();

ALTER TABLE "train_schedule_set" DROP COLUMN "timetable_type";
ALTER TABLE "timetable" DROP COLUMN "timetable_type";
DROP TYPE "timetable_type";
