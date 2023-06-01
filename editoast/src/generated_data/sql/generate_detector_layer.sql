WITH collect AS (
    SELECT detectors.obj_id AS detector_id,
        (detectors.data->>'position')::float AS detector_position,
        (tracks.data->>'length')::float AS track_length,
        ST_GeomFromGeoJSON(tracks.data->'geo') AS track_geo,
        ST_GeomFromGeoJSON(tracks.data->'sch') AS track_sch
    FROM osrd_infra_detectormodel AS detectors
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = detectors.data->>'track'
        AND tracks.infra_id = detectors.infra_id
    WHERE detectors.infra_id = $1
)
INSERT INTO osrd_infra_detectorlayer (obj_id, infra_id, geographic, schematic)
SELECT detector_id,
    $1,
    ST_Transform(
        ST_LineInterpolatePoint(
            track_geo,
            LEAST(
                GREATEST(detector_position / track_length, 0.),
                1.
            )
        ),
        3857
    ),
    ST_Transform(
        ST_LineInterpolatePoint(
            track_sch,
            LEAST(
                GREATEST(detector_position / track_length, 0.),
                1.
            )
        ),
        3857
    )
FROM collect
