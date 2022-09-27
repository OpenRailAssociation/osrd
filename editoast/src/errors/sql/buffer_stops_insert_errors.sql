WITH errors AS (
    SELECT unnest($2) AS information
)
INSERT INTO osrd_infra_errorlayer (
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
    LEFT JOIN osrd_infra_bufferstoplayer AS buffer_stops ON buffer_stops.obj_id = information->>'obj_id'
    AND buffer_stops.infra_id = $1