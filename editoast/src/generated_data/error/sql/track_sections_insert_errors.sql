WITH errors AS (
    SELECT unnest($2) AS information
)
INSERT INTO infra_layer_error (
        infra_id,
        geographic,
        schematic,
        information
    )
SELECT $1 AS infra_id,
    tracks.geographic,
    tracks.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_track_section AS tracks ON tracks.obj_id = information->>'obj_id'
    AND tracks.infra_id = $1
