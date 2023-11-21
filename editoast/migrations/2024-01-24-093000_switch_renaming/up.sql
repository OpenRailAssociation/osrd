-- Your SQL goes here

ALTER TABLE infra_object_extended_switch_type RENAME TO infra_object_extended_track_node_type;

ALTER TABLE infra_object_switch RENAME TO infra_object_track_node;

ALTER TABLE infra_layer_switch RENAME TO infra_layer_track_node;

UPDATE infra_object_route SET data['track_nodes_directions'] = data['switches_directions'];
UPDATE infra_object_route SET data = data - 'switches_directions';

UPDATE infra_object_track_node SET data['track_node_type'] = data['switch_type'];
UPDATE infra_object_track_node SET data = data - 'switch_type';

DELETE FROM infra_layer_error
WHERE information->>'obj_type' = 'Switch' OR information->>'obj_type' = 'SwitchType';

ALTER TABLE infra
ALTER column railjson_version
SET DEFAULT '3.4.9';
UPDATE infra
SET railjson_version = '3.4.9';