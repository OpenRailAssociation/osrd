-- This file should undo anything in `up.sql`
ALTER TABLE stdcm_search_environment DROP COLUMN IF EXISTS operational_points;
ALTER TABLE stdcm_search_environment DROP COLUMN IF EXISTS speed_limit_tags;
ALTER TABLE stdcm_search_environment DROP COLUMN IF EXISTS default_speed_limit_tag;
