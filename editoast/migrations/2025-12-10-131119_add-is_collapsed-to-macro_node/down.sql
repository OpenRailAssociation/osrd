-- This file should undo anything in `up.sql`
ALTER TABLE macro_node DROP COLUMN IF EXISTS is_collapsed;
