-- Your SQL goes here
DROP TABLE infra_layer_track_section_link;
DROP TABLE infra_object_track_section_link;
DELETE FROM infra_layer_error
WHERE information->>'obj_type' = 'TrackSectionLink';
ALTER TABLE infra
ALTER column railjson_version
SET DEFAULT '3.4.4';
UPDATE infra
SET railjson_version = '3.4.4';
