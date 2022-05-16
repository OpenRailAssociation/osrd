WITH errors AS (
    SELECT unnest($2) AS route_id,
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
    errors.route_id AS obj_id,
    'Route' AS obj_type,
    routes.geographic,
    routes.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_routelayer AS routes ON routes.obj_id = errors.route_id
    AND routes.infra_id = $1