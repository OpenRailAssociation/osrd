ALTER TABLE macro_node ADD COLUMN path_item_key varchar(255);

UPDATE macro_node
SET path_item_key = CASE
    WHEN node_location ? 'track_offset' THEN
        'track_offset:' || (node_location -> 'track_offset' ->> 'track')
        || '+' || (node_location -> 'track_offset' ->> 'offset')
    WHEN node_location -> 'operational_point' ->> 'type' = 'id' THEN
        'op_id:' || (node_location -> 'operational_point' ->> 'operational_point')
    WHEN node_location -> 'operational_point' ->> 'type' = 'domestic' THEN
        'domestic:' || (node_location -> 'operational_point' ->> 'main_code')
        || COALESCE('/' || (node_location -> 'operational_point' ->> 'secondary_code'), '')
        || CASE
            WHEN node_location -> 'operational_point' ->> 'country_code' = '??' THEN ''
            ELSE '#' || (node_location -> 'operational_point' ->> 'country_code')
        END
    WHEN node_location -> 'operational_point' ->> 'type' = 'uic' THEN
        'uic:' || (node_location -> 'operational_point' ->> 'uic')
        || COALESCE('/' || (node_location -> 'operational_point' ->> 'secondary_code'), '')
END;

ALTER TABLE macro_node ALTER COLUMN path_item_key SET NOT NULL;

-- Also drops the (scenario_id, node_location) unique constraint
ALTER TABLE macro_node DROP COLUMN node_location;

ALTER TABLE macro_node
ADD CONSTRAINT macro_node_scenario_id_path_item_key_key UNIQUE (scenario_id, path_item_key);

ALTER TABLE macro_node RENAME COLUMN short_name TO trigram;
