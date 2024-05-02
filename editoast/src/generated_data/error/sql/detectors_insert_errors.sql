WITH errors AS (
    SELECT unnest($2) AS information,
        unnest($3) AS error_hash
)
INSERT INTO infra_layer_error (
        infra_id,
        geographic,
        information,
        info_hash
    )
SELECT $1 AS infra_id,
    detectors.geographic,
    errors.information,
    errors.error_hash
FROM errors
    LEFT JOIN infra_layer_detector AS detectors ON detectors.obj_id = information->>'obj_id'
    AND detectors.infra_id = $1
