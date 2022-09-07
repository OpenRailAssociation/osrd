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
        AND signals.obj_id = ANY($2)
)
INSERT INTO osrd_infra_signallayer (obj_id, infra_id, geographic, schematic)
SELECT signal_id,
    $1,
    ST_Transform(
        ST_LineInterpolatePoint(
            track_geo,
            GREATEST(LEAST(signal_position / track_length, 1.), 0.)
        ),
        3857
    ),
    ST_Transform(
        ST_LineInterpolatePoint(
            track_sch,
            GREATEST(LEAST(signal_position / track_length, 1.), 0.)
        ),
        3857
    )
FROM collect ON CONFLICT (infra_id, obj_id) DO
UPDATE
SET geographic = EXCLUDED.geographic,
    schematic = EXCLUDED.schematic