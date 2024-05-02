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
    electrifications.geographic,
    errors.information,
    errors.error_hash
FROM errors
    LEFT JOIN infra_layer_electrification AS electrifications ON electrifications.obj_id = information->>'obj_id'
    AND electrifications.infra_id = $1
