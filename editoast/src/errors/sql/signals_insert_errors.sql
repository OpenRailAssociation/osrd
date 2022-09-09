WITH errors AS (
    SELECT unnest($2) AS signal_id,
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
    errors.signal_id AS obj_id,
    'Signal' AS obj_type,
    signals.geographic,
    signals.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_signallayer AS signals ON signals.obj_id = errors.signal_id
    AND signals.infra_id = $1