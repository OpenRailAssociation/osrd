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
    ops.geographic,
    ops.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_operational_point AS ops ON ops.obj_id = information->>'obj_id'
    AND ops.infra_id = $1
