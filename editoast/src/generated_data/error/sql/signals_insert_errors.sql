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
    signals.geographic,
    signals.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_signallayer AS signals ON signals.obj_id = information->>'obj_id'
    AND signals.infra_id = $1