ALTER TABLE rolling_stock
ADD features text [] NOT NULL DEFAULT '{}',
    ALTER COLUMN supported_signaling_systems type jsonb USING Array_to_json(supported_signaling_systems::text []),
    ALTER COLUMN supported_signaling_systems
SET DEFAULT ('["BAPR", "BAL", "TVM300", "TVM430"]');
