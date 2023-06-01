WITH collect AS (
    SELECT switches.obj_id AS switch_id,
        jsonb_path_query_first(switches.data->'ports', '$.*')->>'endpoint' AS ep,
        ST_GeomFromGeoJSON(tracks.data->'geo') AS track_geo,
        ST_GeomFromGeoJSON(tracks.data->'sch') AS track_sch
    FROM osrd_infra_switchmodel AS switches
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = jsonb_path_query_first(switches.data->'ports', '$.*')->>'track'
        AND tracks.infra_id = switches.infra_id
    WHERE switches.infra_id = $1
)
INSERT INTO osrd_infra_switchlayer (obj_id, infra_id, geographic, schematic)
SELECT switch_id,
    $1,
    CASE
        ep
        WHEN 'BEGIN' THEN ST_Transform(ST_StartPoint(track_geo), 3857)
        WHEN 'END' THEN ST_Transform(ST_EndPoint(track_geo), 3857)
    END,
    CASE
        ep
        WHEN 'BEGIN' THEN ST_Transform(ST_StartPoint(track_sch), 3857)
        WHEN 'END' THEN ST_Transform(ST_EndPoint(track_sch), 3857)
    END
FROM collect
