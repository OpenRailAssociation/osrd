-- This file should undo anything in `up.sql`

ALTER TABLE rolling_stock
ALTER power_restrictions TYPE jsonb,
ALTER power_restrictions DROP DEFAULT,
ALTER power_restrictions DROP NOT NULL;
