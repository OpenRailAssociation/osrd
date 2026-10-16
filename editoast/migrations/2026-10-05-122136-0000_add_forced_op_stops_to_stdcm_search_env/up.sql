-- Your SQL goes here
ALTER TABLE stdcm_search_environment ADD COLUMN IF NOT EXISTS forced_op_stops jsonb NOT NULL DEFAULT 'null'::jsonb;
