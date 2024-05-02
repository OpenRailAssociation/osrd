INSERT INTO infra_layer_track_section (obj_id, infra_id, geographic)
SELECT obj_id,
    $1,
    ST_Transform(ST_GeomFromGeoJSON(data->'geo'), 3857)
FROM infra_object_track_section
WHERE infra_id = $1
