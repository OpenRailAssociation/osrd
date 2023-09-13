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
    speeds.geographic,
    speeds.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_speed_section AS speeds ON speeds.obj_id = information->>'obj_id'
    AND speeds.infra_id = $1
