ALTER TABLE infra
    ALTER COLUMN version DROP DEFAULT,
    ALTER COLUMN version TYPE bigint USING version::bigint,
    ALTER COLUMN version SET DEFAULT 0,
    ALTER COLUMN generated_version DROP DEFAULT,
    ALTER COLUMN generated_version TYPE bigint USING generated_version::bigint,
    ALTER COLUMN generated_version SET DEFAULT NULL;
