WITH collect AS (
    SELECT switches.obj_id AS switch_id,
        jsonb_path_query_first(switches.data->'ports', '$.*')->>'endpoint' AS ep,
        tracks_layer.geographic AS track_geo
    FROM infra_object_switch AS switches
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = jsonb_path_query_first(switches.data->'ports', '$.*')->>'track'
        AND tracks.infra_id = switches.infra_id
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
    WHERE switches.infra_id = $1
)
INSERT INTO infra_layer_switch (obj_id, infra_id, geographic)
SELECT switch_id,
    $1,
    CASE
        ep
        WHEN 'BEGIN' THEN ST_StartPoint(track_geo)
        WHEN 'END' THEN ST_EndPoint(track_geo)
    END
FROM collect
