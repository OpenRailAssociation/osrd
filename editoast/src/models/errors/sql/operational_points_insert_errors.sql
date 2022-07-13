WITH errors AS (
    SELECT unnest($2) AS op_id,
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
    errors.op_id AS obj_id,
    'OperationalPoint' AS obj_type,
    ops.geographic,
    ops.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_operationalpointlayer AS ops ON ops.obj_id = errors.op_id
    AND ops.infra_id = $1