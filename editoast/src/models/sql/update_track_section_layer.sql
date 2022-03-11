INSERT INTO osrd_infra_signallayer (obj_id, infra_id, geographic, schematic)
SELECT obj_id,
    $1,
    ST_Transform(ST_GeomFromGeoJSON(data->'geo'), 3857),
    ST_Transform(ST_GeomFromGeoJSON(data->'sch'), 3857)
FROM osrd_infra_tracksectionmodel
WHERE infra_id = $1 and obj_id in ($2)