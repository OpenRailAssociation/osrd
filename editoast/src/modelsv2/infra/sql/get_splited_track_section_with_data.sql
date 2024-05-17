SELECT
object_table.obj_id as obj_id,
object_table.data as railjson,
ST_AsGeoJSON(ST_LineSubstring(ST_GeomFromGeoJSON(object_table.data->'geo'), 0, $3))::jsonb as left_geo,
ST_AsGeoJSON(ST_LineSubstring(ST_GeomFromGeoJSON(object_table.data->'geo'), $3, 1))::jsonb as right_geo
FROM infra_object_track_section AS object_table
WHERE object_table.infra_id = $1 AND object_table.obj_id = $2
