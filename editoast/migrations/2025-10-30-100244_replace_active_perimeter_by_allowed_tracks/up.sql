-- Your SQL goes here
ALTER TABLE stdcm_search_environment DROP COLUMN IF EXISTS active_perimeter;
ALTER TABLE stdcm_search_environment ADD COLUMN IF NOT EXISTS allowed_tracks jsonb NOT NULL DEFAULT 'null'::jsonb;
