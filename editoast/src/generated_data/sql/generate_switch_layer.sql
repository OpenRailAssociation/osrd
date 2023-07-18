WITH collect AS (
    SELECT switches.obj_id AS switch_id,
        jsonb_path_query_first(switches.data->'ports', '$.*')->>'endpoint' AS ep,
        tracks_layer.geographic AS track_geo,
        tracks_layer.schematic AS track_sch
    FROM osrd_infra_switchmodel AS switches
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = jsonb_path_query_first(switches.data->'ports', '$.*')->>'track'
        AND tracks.infra_id = switches.infra_id
        INNER JOIN osrd_infra_tracksectionlayer AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
    WHERE switches.infra_id = $1
)
INSERT INTO osrd_infra_switchlayer (obj_id, infra_id, geographic, schematic)
SELECT switch_id,
    $1,
    CASE
        ep
        WHEN 'BEGIN' THEN ST_StartPoint(track_geo)
        WHEN 'END' THEN ST_EndPoint(track_geo)
    END,
    CASE
        ep
        WHEN 'BEGIN' THEN ST_StartPoint(track_sch)
        WHEN 'END' THEN ST_EndPoint(track_sch)
    END
FROM collect
