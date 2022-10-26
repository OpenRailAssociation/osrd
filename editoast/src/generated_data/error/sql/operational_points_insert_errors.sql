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
    ops.geographic,
    ops.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_operationalpointlayer AS ops ON ops.obj_id = information->>'obj_id'
    AND ops.infra_id = $1