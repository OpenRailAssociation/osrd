WITH errors AS (
    SELECT unnest($2) AS information,
        unnest($3) AS error_hash
)
INSERT INTO infra_layer_error (
        infra_id,
        geographic,
        schematic,
        information,
        info_hash
    )
SELECT $1 AS infra_id,
    switches.geographic,
    switches.schematic,
    errors.information,
    errors.error_hash
FROM errors
    LEFT JOIN infra_layer_switch AS switches ON switches.obj_id = information->>'obj_id'
    AND switches.infra_id = $1
