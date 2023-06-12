WITH collect AS (
    SELECT buffer_stops.obj_id AS buffer_stop_id,
        (buffer_stops.data->>'position')::float AS buffer_stop_position,
        (tracks.data->>'length')::float AS track_length,
        ST_GeomFromGeoJSON(tracks.data->'geo') AS track_geo,
        ST_GeomFromGeoJSON(tracks.data->'sch') AS track_sch
    FROM osrd_infra_bufferstopmodel AS buffer_stops
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = buffer_stops.data->>'track'
        AND tracks.infra_id = buffer_stops.infra_id
    WHERE buffer_stops.infra_id = $1
)
INSERT INTO osrd_infra_bufferstoplayer (obj_id, infra_id, geographic, schematic)
SELECT buffer_stop_id,
    $1,
    ST_Transform(
        ST_LineInterpolatePoint(
            track_geo,
            LEAST(
                GREATEST(buffer_stop_position / track_length, 0.),
                1.
            )
        ),
        3857
    ),
    ST_Transform(
        ST_LineInterpolatePoint(
            track_sch,
            LEAST(
                GREATEST(buffer_stop_position / track_length, 0.),
                1.
            )
        ),
        3857
    )
FROM collect ON CONFLICT (infra_id, obj_id) DO
UPDATE
SET geographic = EXCLUDED.geographic,
    schematic = EXCLUDED.schematic
