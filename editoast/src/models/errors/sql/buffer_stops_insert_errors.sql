WITH errors AS (
    SELECT unnest($2) AS buffer_stop_id,
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
    errors.buffer_stop_id AS obj_id,
    'BufferStop' AS obj_type,
    buffer_stops.geographic,
    buffer_stops.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_bufferstoplayer AS buffer_stops ON buffer_stops.obj_id = errors.buffer_stop_id
    AND buffer_stops.infra_id = $1