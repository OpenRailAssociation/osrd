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
    buffer_stops.geographic,
    buffer_stops.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_buffer_stop AS buffer_stops ON buffer_stops.obj_id = information->>'obj_id'
    AND buffer_stops.infra_id = $1
