DELETE FROM infra_object_switch_type;
ALTER TABLE infra_object_switch_type
    RENAME TO infra_object_extend_switch_type;
ALTER TABLE infra
ALTER column railjson_version
SET DEFAULT '3.4.5';
UPDATE infra
SET railjson_version = '3.4.5';
