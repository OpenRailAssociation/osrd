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
    detectors.geographic,
    detectors.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_detector AS detectors ON detectors.obj_id = information->>'obj_id'
    AND detectors.infra_id = $1
