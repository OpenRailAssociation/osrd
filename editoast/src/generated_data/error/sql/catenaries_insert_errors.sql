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
    catenaries.geographic,
    catenaries.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_catenarylayer AS catenaries ON catenaries.obj_id = information->>'obj_id'
    AND catenaries.infra_id = $1