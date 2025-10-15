-- This file should undo anything in `up.sql`
ALTER TABLE stdcm_search_environment DROP COLUMN IF EXISTS allowed_tracks;
ALTER TABLE stdcm_search_environment ADD COLUMN IF NOT EXISTS active_perimeter jsonb NOT NULL DEFAULT 'null'::jsonb;
