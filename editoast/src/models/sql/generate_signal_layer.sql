WITH collect AS (
    SELECT signals.obj_id,
        (signals.data->>'position')::numeric as signal_position,
        (tracks.data->>'length')::numeric as track_length,
        ST_GeomFromGeoJSON(tracks.data->'geo') as track_geo,
        ST_GeomFromGeoJSON(tracks.data->'sch') as track_sch
    FROM osrd_infra_signalmodel as signals
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = signals.data->'track'->>'id'
    WHERE signals.infra_id = $1
)
INSERT INTO osrd_infra_signallayer (obj_id, infra_id, geographic, schematic)
SELECT obj_id,
    $1,
    ST_Transform(
        ST_LineInterpolatePoint(track_geo, signal_position / track_length),
        3857
    ),
    ST_Transform(
        ST_LineInterpolatePoint(track_sch, signal_position / track_length),
        3857
    )
FROM collect;