WITH collect AS (
    SELECT links.obj_id as link_id,
        links.data->'dst'->>'endpoint' as ep,
        ST_GeomFromGeoJSON(tracks.data->'geo') as track_geo,
        ST_GeomFromGeoJSON(tracks.data->'sch') as track_sch
    FROM osrd_infra_tracksectionlinkmodel as links
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = links.data->'dst'->'track'->>'id'
        AND tracks.infra_id = links.infra_id
    WHERE links.infra_id = $1
)
INSERT INTO osrd_infra_tracksectionlinklayer (obj_id, infra_id, geographic, schematic)
SELECT link_id,
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
    END,
    FROM collect