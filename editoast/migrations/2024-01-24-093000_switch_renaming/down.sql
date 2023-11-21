-- This file should undo anything in `up.sql`

ALTER TABLE infra_object_extended_track_node_type
    RENAME TO infra_object_extended_switch_type;

ALTER TABLE infra_object_track_node
    RENAME TO infra_object_switch;

ALTER TABLE infra_layer_track_node
    RENAME TO infra_layer_switch;

UPDATE infra_object_route SET data['switches_directions'] = data['track_nodes_directions'];
UPDATE infra_object_route SET data = data - 'track_nodes_directions';

UPDATE infra_object_switch SET data['switch_type'] = data['track_node_type'];
UPDATE infra_object_switch SET data = data - 'track_node_type';

ALTER TABLE infra
ALTER column railjson_version
SET DEFAULT '3.4.8';
UPDATE infra
SET railjson_version = '3.4.8';