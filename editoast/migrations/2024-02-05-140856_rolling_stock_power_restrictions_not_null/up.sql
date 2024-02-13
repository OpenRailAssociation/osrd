-- Your SQL goes here

UPDATE rolling_stock
SET power_restrictions = '{}'::jsonb
WHERE power_restrictions IS NULL;

ALTER TABLE rolling_stock
ALTER power_restrictions TYPE jsonb,
ALTER power_restrictions SET DEFAULT '{}',
ALTER power_restrictions SET NOT NULL;
