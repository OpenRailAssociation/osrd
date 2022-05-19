WITH paths AS (
    SELECT obj_id AS route_id,
        (
            jsonb_array_elements(data->'path')->'begin'
        )::float AS slice_begin,
        (
            jsonb_array_elements(data->'path')->'end'
        )::float AS slice_end,
        jsonb_array_elements(data->'path')->'track'->>'id' AS track_id
    FROM osrd_infra_routemodel
    WHERE infra_id = $1
        AND obj_id = ANY($2)
),
sliced_tracks AS (
    SELECT paths.route_id,
        ST_Transform(
            ST_LineSubstring(
                ST_GeomFromGeoJSON(tracks.data->'geo'),
                GREATEST(
                    LEAST(
                        paths.slice_end / (tracks.data->'length')::float,
                        paths.slice_begin / (tracks.data->'length')::float,
                        1.
                    ),
                    0.
                ),
                LEAST(
                    GREATEST(
                        paths.slice_begin / (tracks.data->'length')::float,
                        paths.slice_end / (tracks.data->'length')::float,
                        0.
                    ),
                    1.
                )
            ),
            3857
        ) AS geo,
        ST_Transform(
            ST_LineSubstring(
                ST_GeomFromGeoJSON(tracks.data->'sch'),
                GREATEST(
                    LEAST(
                        paths.slice_end / (tracks.data->'length')::float,
                        paths.slice_begin / (tracks.data->'length')::float,
                        1.
                    ),
                    0.
                ),
                LEAST(
                    GREATEST(
                        paths.slice_begin / (tracks.data->'length')::float,
                        paths.slice_end / (tracks.data->'length')::float,
                        0.
                    ),
                    1.
                )
            ),
            3857
        ) AS sch
    FROM paths
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = paths.track_id
        AND tracks.infra_id = $1
        AND paths.slice_begin < (tracks.data->'length')::float
        AND paths.slice_begin != paths.slice_end
)
INSERT INTO osrd_infra_routelayer (obj_id, infra_id, geographic, schematic)
SELECT route_id,
    $1,
    St_Collect(geo),
    St_Collect(sch)
FROM sliced_tracks
GROUP BY route_id