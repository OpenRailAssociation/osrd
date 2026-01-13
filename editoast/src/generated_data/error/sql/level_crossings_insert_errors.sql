WITH errors AS (
    SELECT unnest($2) AS information,
        unnest($3) AS error_hash
)
INSERT INTO infra_layer_error (
        infra_id,
        geographic,
        information,
        info_hash
    )
SELECT $1 AS infra_id,
    level_crossings.geographic,
    errors.information,
    errors.error_hash
FROM errors
    LEFT JOIN infra_layer_level_crossing AS level_crossings ON level_crossings.obj_id = information->>'obj_id'
    AND level_crossings.infra_id = $1
