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
    switches.geographic,
    switches.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_switch AS switches ON switches.obj_id = information->>'obj_id'
    AND switches.infra_id = $1
