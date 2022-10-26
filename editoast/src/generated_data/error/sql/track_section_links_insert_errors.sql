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
    links.geographic,
    links.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_tracksectionlinklayer AS links ON links.obj_id = information->>'obj_id'
    AND links.infra_id = $1