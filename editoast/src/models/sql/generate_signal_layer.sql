WITH collect AS (
    SELECT signals.obj_id AS signal_id,
        (signals.data->>'position')::float AS signal_position,
        (tracks.data->>'length')::float AS track_length,
        ST_GeomFromGeoJSON(tracks.data->'geo') AS track_geo,
        ST_GeomFromGeoJSON(tracks.data->'sch') AS track_sch
    FROM osrd_infra_signalmodel AS signals
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = signals.data->'track'->>'id'
        AND tracks.infra_id = signals.infra_id
    WHERE signals.infra_id = $1
)
INSERT INTO osrd_infra_signallayer (obj_id, infra_id, geographic, schematic)
SELECT signal_id,
    $1,
    ST_Transform(
        ST_LineInterpolatePoint(
            track_geo,
            LEAST(GREATEST(signal_position / track_length, 0.), 1.)
        ),
        3857
    ),
    ST_Transform(
        ST_LineInterpolatePoint(
            track_sch,
            LEAST(GREATEST(signal_position / track_length, 0.), 1.)
        ),
        3857
    )
FROM collect