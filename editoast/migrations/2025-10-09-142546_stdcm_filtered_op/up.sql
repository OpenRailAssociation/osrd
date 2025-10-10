ALTER TABLE stdcm_search_environment ADD COLUMN IF NOT EXISTS operational_points_id_filtered text[] NOT NULL DEFAULT array[]::text[];
