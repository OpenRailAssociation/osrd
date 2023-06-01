INSERT INTO osrd_infra_tracksectionlayer (obj_id, infra_id, geographic, schematic)
SELECT obj_id,
    $1,
    ST_Transform(ST_GeomFromGeoJSON(data->'geo'), 3857),
    ST_Transform(ST_GeomFromGeoJSON(data->'sch'), 3857)
FROM osrd_infra_tracksectionmodel
WHERE infra_id = $1
    AND obj_id = ANY($2) ON CONFLICT (infra_id, obj_id) DO
UPDATE
SET geographic = EXCLUDED.geographic,
    schematic = EXCLUDED.schematic
