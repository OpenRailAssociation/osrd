WITH collect AS (
    SELECT links.obj_id AS link_id,
        links.data->'dst'->>'endpoint' AS ep,
        tracks_layer.geographic AS track_geo,
        tracks_layer.schematic AS track_sch
    FROM infra_object_track_section_link AS links
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = links.data->'dst'->>'track'
        AND tracks.infra_id = links.infra_id
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
    WHERE links.infra_id = $1
)
INSERT INTO infra_layer_track_section_link (obj_id, infra_id, geographic, schematic)
SELECT link_id,
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
