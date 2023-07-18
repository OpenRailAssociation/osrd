WITH collect AS (
    SELECT detectors.obj_id AS detector_id,
        (detectors.data->>'position')::float AS detector_position,
        (tracks.data->>'length')::float AS track_length,
        tracks_layer.geographic AS track_geo,
        tracks_layer.schematic AS track_sch
    FROM osrd_infra_detectormodel AS detectors
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = detectors.data->>'track'
        AND tracks.infra_id = detectors.infra_id
        INNER JOIN osrd_infra_tracksectionlayer AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
    WHERE detectors.infra_id = $1
),
collect2 AS (
    SELECT detector_id,
        LEAST(
            GREATEST(detector_position / track_length, 0.),
            1.
        ) AS norm_pos
    FROM collect
)
INSERT INTO osrd_infra_detectorlayer (obj_id, infra_id, geographic, schematic)
SELECT collect.detector_id,
    $1,
    ST_LineInterpolatePoint(track_geo, norm_pos),
    ST_LineInterpolatePoint(track_sch, norm_pos)
FROM collect
    INNER JOIN collect2 ON collect.detector_id = collect2.detector_id
