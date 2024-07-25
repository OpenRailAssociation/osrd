WITH collect AS (
    SELECT track_nodes.obj_id AS track_node_id,
        jsonb_path_query_first(track_nodes.data->'ports', '$.*')->>'endpoint' AS ep,
        tracks_layer.geographic AS track_geo
    FROM infra_object_track_node AS track_nodes
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = jsonb_path_query_first(track_nodes.data->'ports', '$.*')->>'track'
        AND tracks.infra_id = track_nodes.infra_id
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
    WHERE track_nodes.infra_id = $1
        AND track_nodes.obj_id = ANY($2)
)
INSERT INTO infra_layer_track_node (obj_id, infra_id, geographic)
SELECT track_node_id,
    $1,
    CASE
        ep
        WHEN 'BEGIN' THEN ST_StartPoint(track_geo)
        WHEN 'END' THEN ST_EndPoint(track_geo)
    END
FROM collect ON CONFLICT (infra_id, obj_id) DO
UPDATE
SET geographic = EXCLUDED.geographic
