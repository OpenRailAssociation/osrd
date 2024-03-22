ALTER TABLE infra
ALTER COLUMN owner
SET DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE infra
ALTER COLUMN version
SET DEFAULT '0';

ALTER TABLE infra
ALTER COLUMN generated_version
SET DEFAULT NULL;

ALTER TABLE infra
ALTER COLUMN locked
SET DEFAULT FALSE;

ALTER TABLE infra
ALTER COLUMN created
SET DEFAULT NOW();

ALTER TABLE infra
ALTER COLUMN modified
SET DEFAULT NOW();

-- There is a default value on this column that doesn't seem to be updated
-- when the rjs version increases. Since editoast explicitly sets the version
-- each time, probably better to make it required by the DB.
ALTER TABLE infra
ALTER COLUMN railjson_version
DROP DEFAULT;
