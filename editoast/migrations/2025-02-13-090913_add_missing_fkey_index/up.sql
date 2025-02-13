CREATE INDEX pga_idx_fk_infra_layer_psl_sign_infra_id ON public.infra_layer_psl_sign (infra_id);
ANALYZE public.infra_layer_psl_sign;

CREATE INDEX pga_idx_fk_study_project_id ON public.study (project_id);
ANALYZE public.study;

CREATE INDEX pga_idx_fk_infra_layer_neutral_sign_infra_id ON public.infra_layer_neutral_sign (infra_id);
ANALYZE public.infra_layer_neutral_sign;

CREATE INDEX pga_idx_fk_train_schedule_timetable_id ON public.train_schedule (timetable_id);
ANALYZE public.train_schedule;

CREATE INDEX pga_idx_fk_scenario_electrical_profile_set_id ON public.scenario (electrical_profile_set_id);
CREATE INDEX pga_idx_fk_scenario_infra_id ON public.scenario (infra_id);
CREATE INDEX pga_idx_fk_scenario_study_id ON public.scenario (study_id);
ANALYZE public.scenario;

CREATE INDEX pga_idx_fk_work_schedule_work_schedule_group_id ON public.work_schedule (work_schedule_group_id);
ANALYZE public.work_schedule;

CREATE INDEX pga_idx_fk_stdcm_search_environment_electrical_profile_set_id ON public.stdcm_search_environment (electrical_profile_set_id);
CREATE INDEX pga_idx_fk_stdcm_search_environment_infra_id ON public.stdcm_search_environment (infra_id);
CREATE INDEX pga_idx_fk_stdcm_search_environment_temporary_speed_limit_group_id ON public.stdcm_search_environment (temporary_speed_limit_group_id);
CREATE INDEX pga_idx_fk_stdcm_search_environment_timetable_id ON public.stdcm_search_environment (timetable_id);
CREATE INDEX pga_idx_fk_stdcm_search_environment_work_schedule_group_id ON public.stdcm_search_environment (work_schedule_group_id);
ANALYZE public.stdcm_search_environment;

CREATE INDEX pga_idx_fk_temporary_speed_limit_temporary_speed_limit_group_id ON public.temporary_speed_limit (temporary_speed_limit_group_id);
ANALYZE public.temporary_speed_limit;

CREATE INDEX pga_idx_fk_stdcm_logs_user_id ON public.stdcm_logs (user_id);
ANALYZE public.stdcm_logs;
