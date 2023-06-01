WITH collect AS (
    SELECT signals.obj_id AS signal_id,
        (signals.data->>'position')::float AS signal_position,
        signals.data->>'direction' AS signal_direction,
        (tracks.data->>'length')::float AS track_length,
        tracks_layer.geographic AS track_geo,
        tracks_layer.schematic AS track_sch
    FROM osrd_infra_signalmodel AS signals
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = signals.data->>'track'
        AND tracks.infra_id = signals.infra_id
        INNER JOIN osrd_infra_tracksectionlayer AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
    WHERE signals.infra_id = $1
),
collect2 AS (
    SELECT signal_id,
        LEAST(GREATEST(signal_position / track_length, 0.), 1.) AS norm_pos,
        CASE
            signal_direction
            WHEN 'STOP_TO_START' THEN 180.
            ELSE 0.
        END AS angle_direction
    FROM collect
)
INSERT INTO osrd_infra_signallayer (
        obj_id,
        infra_id,
        angle_geo,
        angle_sch,
        geographic,
        schematic
    )
SELECT collect.signal_id,
    $1,
    degrees(
        ST_Azimuth(
            ST_LineInterpolatePoint(track_geo, GREATEST(norm_pos - 0.0001, 0.)),
            ST_LineInterpolatePoint(track_geo, LEAST(norm_pos + 0.0001, 1.))
        )
    ) + angle_direction,
    degrees(
        ST_Azimuth(
            ST_LineInterpolatePoint(track_sch, GREATEST(norm_pos - 0.0001, 0.)),
            ST_LineInterpolatePoint(track_sch, LEAST(norm_pos + 0.0001, 1.))
        )
    ) + angle_direction,
    ST_LineInterpolatePoint(track_geo, norm_pos),
    ST_LineInterpolatePoint(track_sch, norm_pos)
FROM collect
    INNER JOIN collect2 ON collect.signal_id = collect2.signal_id
