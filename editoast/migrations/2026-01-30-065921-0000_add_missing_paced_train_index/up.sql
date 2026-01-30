CREATE INDEX IF NOT EXISTS idx_paced_train_train_schedule_set_id
    ON paced_train(train_schedule_set_id);

CREATE INDEX IF NOT EXISTS idx_infra_layer_error_infra_id
    ON public.infra_layer_error (infra_id);

CREATE INDEX IF NOT EXISTS idx_paced_train_sub_category
    ON public.paced_train (sub_category);

CREATE INDEX IF NOT EXISTS idx_project_image_id
    ON public.project (image_id);

CREATE INDEX IF NOT EXISTS idx_timetable_train_schedule_set_train_schedule_set_id
    ON public.timetable_train_schedule_set (train_schedule_set_id);

CREATE INDEX IF NOT EXISTS idx_train_schedule_set_catalog_entry_id
    ON public.train_schedule_set (catalog_entry_id);
