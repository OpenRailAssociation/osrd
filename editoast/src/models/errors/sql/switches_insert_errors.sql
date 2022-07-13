WITH errors AS (
    SELECT unnest($2) AS switch_id,
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
    errors.switch_id AS obj_id,
    'Switch' AS obj_type,
    switches.geographic,
    switches.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_switchlayer AS switches ON switches.obj_id = errors.switch_id
    AND switches.infra_id = $1