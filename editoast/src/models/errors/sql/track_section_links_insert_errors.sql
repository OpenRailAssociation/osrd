WITH errors AS (
    SELECT unnest($2) AS link_id,
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
    errors.link_id AS obj_id,
    'TrackSectionLink' AS obj_type,
    links.geographic,
    links.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_tracksectionlinklayer AS links ON links.obj_id = errors.link_id
    AND links.infra_id = $1