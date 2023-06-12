WITH track_ranges AS (
    SELECT obj_id AS catenary_id,
        (
            jsonb_array_elements(data->'track_ranges')->'begin'
        )::float AS slice_begin,
        (
            jsonb_array_elements(data->'track_ranges')->'end'
        )::float AS slice_end,
        jsonb_array_elements(data->'track_ranges')->>'track' AS track_id
    FROM osrd_infra_catenarymodel
    WHERE infra_id = $1
        AND obj_id = ANY($2)
),
sliced_tracks AS (
    SELECT track_ranges.catenary_id,
        ST_Transform(
            ST_LineSubstring(
                ST_GeomFromGeoJSON(tracks.data->'geo'),
                GREATEST(
                    LEAST(
                        track_ranges.slice_end / (tracks.data->'length')::float,
                        track_ranges.slice_begin / (tracks.data->'length')::float,
                        1.
                    ),
                    0.
                ),
                LEAST(
                    GREATEST(
                        track_ranges.slice_begin / (tracks.data->'length')::float,
                        track_ranges.slice_end / (tracks.data->'length')::float,
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
                        track_ranges.slice_end / (tracks.data->'length')::float,
                        track_ranges.slice_begin / (tracks.data->'length')::float,
                        1.
                    ),
                    0.
                ),
                LEAST(
                    GREATEST(
                        track_ranges.slice_begin / (tracks.data->'length')::float,
                        track_ranges.slice_end / (tracks.data->'length')::float,
                        0.
                    ),
                    1.
                )
            ),
            3857
        ) AS sch
    FROM track_ranges
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = track_ranges.track_id
        AND tracks.infra_id = $1
)
INSERT INTO osrd_infra_catenarylayer (obj_id, infra_id, geographic, schematic)
SELECT catenary_id,
    $1,
    St_Collect(geo),
    St_Collect(sch)
FROM sliced_tracks
WHERE GeometryType(sliced_tracks.geo) = 'LINESTRING'
    AND GeometryType(sliced_tracks.sch) = 'LINESTRING'
GROUP BY catenary_id
