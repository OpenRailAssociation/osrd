-- This file should undo anything in `up.sql`
ALTER TABLE stdcm_search_environment DROP COLUMN IF EXISTS forced_op_stops;
