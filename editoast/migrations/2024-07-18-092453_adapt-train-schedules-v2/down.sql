UPDATE train_schedule_v2
SET margins = REGEXP_REPLACE(margins::text, '0%', 'none', 'g')::jsonb;
