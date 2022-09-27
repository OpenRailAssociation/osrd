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
    switches.geographic,
    switches.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_switchlayer AS switches ON switches.obj_id = information->>'obj_id'
    AND switches.infra_id = $1