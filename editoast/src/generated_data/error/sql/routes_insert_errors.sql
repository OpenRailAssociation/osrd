WITH errors AS (
    SELECT unnest($2) AS information,
        unnest($3) AS error_hash
)
INSERT INTO infra_layer_error (
        infra_id,
        geographic,
        schematic,
        information,
        info_hash
    )
SELECT $1 AS infra_id,
    NULL,
    NULL,
    errors.information,
    error_hash
FROM errors
