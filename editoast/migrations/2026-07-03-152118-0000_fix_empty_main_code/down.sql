-- Your SQL goes here
ALTER TABLE infra_object_operational_point
DROP CONSTRAINT IF EXISTS check_main_code_not_empty;

ALTER TABLE infra_object_operational_point
DROP CONSTRAINT IF EXISTS check_secondary_code_not_empty;

ALTER TABLE infra_object_operational_point
DROP CONSTRAINT IF EXISTS check_secondary_name_not_empty;
