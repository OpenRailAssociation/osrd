WITH errors AS (
    SELECT unnest($2) AS information
)
INSERT INTO osrd_infra_errorlayer (
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
    LEFT JOIN osrd_infra_detectorlayer AS detectors ON detectors.obj_id = information->>'obj_id'
    AND detectors.infra_id = $1