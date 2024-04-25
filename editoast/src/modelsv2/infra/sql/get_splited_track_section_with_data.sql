SELECT object_table.obj_id as obj_id,
    object_table.data as railjson,
    ST_AsGeoJSON(
        ST_Transform(
            ST_LineSubstring(
                layer_table.geographic,
                0,
                $3
            ),
            4326
        )
    )::jsonb as left_geo,
    ST_AsGeoJSON(
        ST_Transform(
            ST_LineSubstring(
                layer_table.geographic,
                $3,
                1
            ),
            4326
        )
    )::jsonb as right_geo
FROM infra_object_track_section AS object_table
    LEFT JOIN infra_layer_track_section AS layer_table ON layer_table.infra_id = object_table.infra_id
    AND object_table.obj_id = layer_table.obj_id
WHERE object_table.infra_id = $1
    AND object_table.obj_id = $2
