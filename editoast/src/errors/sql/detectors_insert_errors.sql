WITH errors AS (
    SELECT unnest($2) AS detector_id,
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
    errors.detector_id AS obj_id,
    'Detector' AS obj_type,
    detectors.geographic,
    detectors.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_detectorlayer AS detectors ON detectors.obj_id = errors.detector_id
    AND detectors.infra_id = $1