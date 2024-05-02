WITH errors AS (
    SELECT unnest($2) AS information,
        unnest($3) AS error_hash
),
errors_geometry AS (
    SELECT error_hash,
        ST_Collect(layer.geographic) AS geo
    FROM errors
        LEFT JOIN infra_layer_operational_point AS layer ON layer.obj_id = information->>'obj_id'
        AND layer.infra_id = $1
    GROUP BY error_hash
)
INSERT INTO infra_layer_error (
        infra_id,
        geographic,
        information,
        info_hash
    )
SELECT $1 AS infra_id,
    err_geom.geo,
    information,
    errors.error_hash
FROM errors
    INNER JOIN errors_geometry AS err_geom ON err_geom.error_hash = errors.error_hash
