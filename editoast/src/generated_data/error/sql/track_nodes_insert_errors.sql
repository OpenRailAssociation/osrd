WITH errors AS (
    SELECT unnest($2) AS information,
        unnest($3) AS error_hash
)
INSERT INTO infra_layer_error (
        infra_id,
        geographic,
        information,
        info_hash
    )
SELECT $1 AS infra_id,
    track_nodes.geographic,
    errors.information,
    errors.error_hash
FROM errors
    LEFT JOIN infra_layer_track_node AS track_nodes ON track_nodes.obj_id = information->>'obj_id'
    AND track_nodes.infra_id = $1
