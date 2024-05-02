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
    speeds.geographic,
    errors.information,
    errors.error_hash
FROM errors
    LEFT JOIN infra_layer_speed_section AS speeds ON speeds.obj_id = information->>'obj_id'
    AND speeds.infra_id = $1
