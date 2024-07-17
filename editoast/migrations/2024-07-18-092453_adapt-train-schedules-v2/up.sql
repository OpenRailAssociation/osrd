UPDATE train_schedule_v2
SET margins = REGEXP_REPLACE(margins::text, 'none', '0%', 'g')::jsonb;
