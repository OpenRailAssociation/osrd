-- Your SQL goes here
DROP TABLE infra_layer_track_section_link;
DROP TABLE infra_object_track_section_link;
DELETE FROM infra_layer_error
WHERE information->>'obj_type' = 'TrackSectionLink';
