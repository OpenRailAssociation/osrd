ALTER TABLE infra
    ALTER COLUMN version DROP DEFAULT,
    ALTER COLUMN version TYPE varchar(40) USING version::varchar,
    ALTER COLUMN version SET DEFAULT '0',
    ALTER COLUMN generated_version DROP DEFAULT,
    ALTER COLUMN generated_version TYPE varchar(40) USING generated_version::varchar,
    ALTER COLUMN generated_version SET DEFAULT NULL;
