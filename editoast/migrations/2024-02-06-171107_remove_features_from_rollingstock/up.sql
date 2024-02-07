ALTER TABLE rolling_stock DROP COLUMN features,
    ALTER COLUMN supported_signaling_systems DROP DEFAULT,
    ALTER COLUMN supported_signaling_systems TYPE TEXT [] USING TRANSLATE(
        supported_signaling_systems::jsonb::text, '[]', '{}')::TEXT [];
