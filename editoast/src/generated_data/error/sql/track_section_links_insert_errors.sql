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
    links.geographic,
    links.schematic,
    errors.information
FROM errors
    LEFT JOIN infra_layer_track_section_link AS links ON links.obj_id = information->>'obj_id'
    AND links.infra_id = $1
