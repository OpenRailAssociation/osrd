SELECT 
    obj_id,
    railjson,
	ST_AsGeoJSON( ST_Transform(ST_GeometryN( splitted, 1 ), 4326) )::jsonb as left_geo,
	ST_AsGeoJSON( ST_Transform(ST_GeometryN( splitted, 2 ), 4326) )::jsonb as right_geo
FROM (
    SELECT 
        obj_id,
        railjson,
        ST_SPLIT(
            ST_Snap(
                geometry::geometry,
                geo_split_point::geometry,
                ST_Distance(geometry::geometry, geo_split_point::geometry)*1.01
            ),
            geo_split_point::geometry
        ) as splitted
    FROM 
        (SELECT
            object_table.obj_id as obj_id,
            object_table.data as railjson,
            ST_Transform(layer_table.geographic, 4326)::geography as geometry,
            ST_LineInterpolatePoint(
                ST_Transform(layer_table.geographic, 4326),
                $3::float,
                True
            ) as geo_split_point
        FROM infra_object_track_section AS object_table
            LEFT JOIN infra_layer_track_section AS layer_table ON layer_table.infra_id = object_table.infra_id
            AND object_table.obj_id = layer_table.obj_id
        WHERE object_table.infra_id = $1
            AND object_table.obj_id = $2
        )
	);
