WITH errors AS (
    SELECT unnest($2) AS track_id,
        unnest($3) AS information
)
INSERT INTO osrd_infra_errorlayer (
        infra_id,
        obj_id,
        obj_type,
        geographic,
        schematic,
        information
    )
SELECT $1 AS infra_id,
    errors.track_id AS obj_id,
    'TrackSection' AS obj_type,
    tracks.geographic,
    tracks.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_tracksectionlayer AS tracks ON tracks.obj_id = errors.track_id
    AND tracks.infra_id = $1