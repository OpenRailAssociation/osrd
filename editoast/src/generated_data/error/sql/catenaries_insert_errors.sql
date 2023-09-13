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
    catenaries.geographic,
    catenaries.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_catenary AS catenaries ON catenaries.obj_id = information->>'obj_id'
    AND catenaries.infra_id = $1
