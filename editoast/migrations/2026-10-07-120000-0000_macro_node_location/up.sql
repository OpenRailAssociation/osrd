ALTER TABLE macro_node RENAME COLUMN trigram TO short_name;

ALTER TABLE macro_node ADD COLUMN node_location jsonb;

UPDATE macro_node
SET node_location = jsonb_build_object(
    'operational_point', jsonb_build_object(
        'type', 'id',
        'operational_point', substring(path_item_key FROM 7)
    )
)
WHERE path_item_key LIKE 'op\_id:_%';

UPDATE macro_node AS node
SET node_location = jsonb_build_object(
    'operational_point', jsonb_build_object(
        'type', 'domestic',
        'country_code', COALESCE(NULLIF(parsed.country_code, ''), '??'),
        'main_code', parsed.main_code,
        'secondary_code', NULLIF(parsed.secondary_code, '')
    )
)
FROM (
    SELECT
        id,
        split_part(split_part(substring(path_item_key FROM 10), '#', 1), '/', 1) AS main_code,
        split_part(split_part(substring(path_item_key FROM 10), '#', 1), '/', 2) AS secondary_code,
        split_part(substring(path_item_key FROM 10), '#', 2) AS country_code
    FROM macro_node
    WHERE path_item_key LIKE 'domestic:%'
) AS parsed
WHERE node.id = parsed.id AND parsed.main_code <> '';

UPDATE macro_node AS node
SET node_location = jsonb_build_object(
    'operational_point', jsonb_build_object(
        'type', 'uic',
        'uic', parsed.uic::bigint,
        'secondary_code', NULLIF(parsed.secondary_code, '')
    )
)
FROM (
    SELECT
        id,
        split_part(substring(path_item_key FROM 5), '/', 1) AS uic,
        split_part(substring(path_item_key FROM 5), '/', 2) AS secondary_code
    FROM macro_node
    WHERE path_item_key LIKE 'uic:%'
) AS parsed
WHERE node.id = parsed.id
    AND CASE
        WHEN parsed.uic ~ '^[0-9]{1,10}$' THEN parsed.uic::bigint <= 4294967295
        ELSE false
    END;

UPDATE macro_node AS node
SET node_location = jsonb_build_object(
    'track_offset', jsonb_build_object(
        'track', parsed.track,
        'offset', parsed.track_offset::numeric
    )
)
FROM (
    SELECT
        id,
        split_part(substring(path_item_key FROM 14), '+', 1) AS track,
        split_part(substring(path_item_key FROM 14), '+', 2) AS track_offset
    FROM macro_node
    WHERE path_item_key LIKE 'track\_offset:%'
) AS parsed
WHERE node.id = parsed.id AND parsed.track <> '' AND parsed.track_offset ~ '^[0-9]+$';

-- A key in an unknown format matches no path item: its node can't be displayed
DELETE FROM macro_node WHERE node_location IS NULL;

-- Distinct keys may resolve to the same location: keep the oldest node
DELETE FROM macro_node AS duplicate
USING macro_node AS kept
WHERE duplicate.scenario_id = kept.scenario_id
    AND duplicate.node_location = kept.node_location
    AND duplicate.id > kept.id;

ALTER TABLE macro_node ALTER COLUMN node_location SET NOT NULL;

-- Also drops the (scenario_id, path_item_key) unique constraint
ALTER TABLE macro_node DROP COLUMN path_item_key;

ALTER TABLE macro_node
ADD CONSTRAINT macro_node_scenario_id_node_location_key UNIQUE (scenario_id, node_location);
