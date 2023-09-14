WITH track_ranges AS (
    SELECT obj_id AS neutral_section_id,
        (
            jsonb_array_elements(data->'track_ranges')->'begin'
        )::float AS slice_begin,
        (
            jsonb_array_elements(data->'track_ranges')->'end'
        )::float AS slice_end,
        jsonb_array_elements(data->'track_ranges')->>'track' AS track_id
    FROM infra_object_neutral_section
    WHERE infra_id = $1
),
sliced_tracks AS (
    SELECT track_ranges.neutral_section_id,
        ST_LineSubstring(
            tracks_layer.geographic,
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
        ) AS geo,
        ST_LineSubstring(
            tracks_layer.schematic,
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
        ) AS sch
    FROM track_ranges
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = track_ranges.track_id
        AND tracks.infra_id = $1
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
)
INSERT INTO infra_layer_neutral_section (obj_id, infra_id, geographic, schematic)
SELECT neutral_section_id,
    $1,
    St_Collect(geo),
    St_Collect(sch)
FROM sliced_tracks
WHERE GeometryType(sliced_tracks.geo) = 'LINESTRING'
    AND GeometryType(sliced_tracks.sch) = 'LINESTRING'
GROUP BY neutral_section_id
