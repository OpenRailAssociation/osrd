WITH errors AS (
    SELECT unnest($2) AS switch_type_id,
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
    errors.switch_type_id AS obj_id,
    'SwitchType' AS obj_type,
    NULL,
    NULL,
    errors.information
FROM errors