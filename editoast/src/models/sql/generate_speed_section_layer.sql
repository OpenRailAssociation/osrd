WITH track_ranges AS (
    SELECT obj_id as speed_id,
        (
            jsonb_array_elements(data->'track_ranges')->'begin'
        )::float as slice_begin,
        (
            jsonb_array_elements(data->'track_ranges')->'end'
        )::float as slice_end,
        jsonb_array_elements(data->'track_ranges')->'track'->>'id' as track_id
    FROM osrd_infra_speedsectionmodel
    WHERE infra_id = $1
),
sliced_tracks AS (
    SELECT track_ranges.speed_id,
        ST_Transform(
            ST_LineSubstring(
                ST_GeomFromGeoJSON(tracks.data->'geo'),
                track_ranges.slice_begin / (tracks.data->'length')::float,
                LEAST(
                    track_ranges.slice_end / (tracks.data->'length')::float,
                    1.
                )
            ),
            3857
        ) as geo,
        ST_Transform(
            ST_LineSubstring(
                ST_GeomFromGeoJSON(tracks.data->'sch'),
                track_ranges.slice_begin / (tracks.data->'length')::float,
                LEAST(
                    track_ranges.slice_end / (tracks.data->'length')::float,
                    1.
                )
            ),
            3857
        ) as sch
    FROM track_ranges
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = track_ranges.track_id
        AND tracks.infra_id = $1
        AND track_ranges.slice_begin < (tracks.data->'length')::float
)
INSERT INTO osrd_infra_speedsectionlayer (obj_id, infra_id, geographic, schematic)
SELECT speed_id,
    $1,
    St_Collect(geo),
    St_Collect(sch)
FROM sliced_tracks
GROUP BY speed_id