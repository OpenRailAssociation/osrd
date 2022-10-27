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
    routes.geographic,
    routes.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_routelayer AS routes ON routes.obj_id = information->>'obj_id'
    AND routes.infra_id = $1