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
    signals.geographic,
    signals.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_signal AS signals ON signals.obj_id = information->>'obj_id'
    AND signals.infra_id = $1
