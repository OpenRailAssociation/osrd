DELETE FROM infra_object_extend_switch_type;
ALTER TABLE infra_object_extend_switch_type
ADD COLUMN infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE;
ALTER TABLE infra_object_extend_switch_type
    RENAME TO infra_object_switch_type;
ALTER TABLE infra
ALTER column railjson_version
SET DEFAULT '3.4.4';
UPDATE infra
SET railjson_version = '3.4.4';
