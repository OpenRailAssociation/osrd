WITH collect AS (
    SELECT buffer_stops.obj_id AS buffer_stop_id,
        (buffer_stops.data->>'position')::float AS buffer_stop_position,
        (tracks.data->>'length')::float AS track_length,
        tracks_layer.geographic AS track_geo
    FROM infra_object_buffer_stop AS buffer_stops
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = buffer_stops.data->>'track'
        AND tracks.infra_id = buffer_stops.infra_id
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
    WHERE buffer_stops.infra_id = $1
        AND buffer_stops.obj_id = ANY($2)
),
collect2 AS (
    SELECT buffer_stop_id,
        LEAST(
            GREATEST(buffer_stop_position / track_length, 0.),
            1.
        ) AS norm_pos
    FROM collect
)
INSERT INTO infra_layer_buffer_stop (obj_id, infra_id, geographic)
SELECT collect.buffer_stop_id,
    $1,
    ST_LineInterpolatePoint(track_geo, norm_pos)
FROM collect
    INNER JOIN collect2 ON collect.buffer_stop_id = collect2.buffer_stop_id ON CONFLICT (infra_id, obj_id) DO
UPDATE
SET geographic = EXCLUDED.geographic
