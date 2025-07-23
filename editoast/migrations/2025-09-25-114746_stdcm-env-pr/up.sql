-- Your SQL goes here
ALTER TABLE stdcm_search_environment ADD COLUMN IF NOT EXISTS operational_points  bigint[] NOT NULL DEFAULT array[]::bigint[];
ALTER TABLE stdcm_search_environment ADD COLUMN IF NOT EXISTS speed_limit_tags jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE stdcm_search_environment ADD COLUMN IF NOT EXISTS default_speed_limit_tag varchar(25);
ALTER TABLE stdcm_search_environment ADD CONSTRAINT check_default_speed_limit_tag CHECK (default_speed_limit_tag IS NULL OR speed_limit_tags ? default_speed_limit_tag);
