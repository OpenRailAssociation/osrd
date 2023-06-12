WITH track_ranges AS (
    SELECT obj_id AS dead_section_id,
        (
            jsonb_array_elements(data->'backside_pantograph_track_ranges')->'begin'
        )::float AS slice_begin,
        (
            jsonb_array_elements(data->'backside_pantograph_track_ranges')->'end'
        )::float AS slice_end,
        jsonb_array_elements(data->'backside_pantograph_track_ranges')->>'track' AS track_id
    FROM osrd_infra_deadsectionmodel
    WHERE infra_id = $1
),
sliced_tracks AS (
    SELECT track_ranges.dead_section_id,
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
INSERT INTO osrd_infra_backsidepantographdeadsectionlayer (obj_id, infra_id, geographic, schematic)
SELECT dead_section_id,
    $1,
    St_Collect(geo),
    St_Collect(sch)
FROM sliced_tracks
WHERE GeometryType(sliced_tracks.geo) = 'LINESTRING'
    AND GeometryType(sliced_tracks.sch) = 'LINESTRING'
GROUP BY dead_section_id
