WITH lcs AS (
    SELECT obj_id AS lc_id,
        generate_series(0, jsonb_array_length(data->'parts') - 1) AS part_index,
        (
            jsonb_array_elements(data->'parts')->'position'
        )::float AS position,
        jsonb_array_elements(data->'parts')->>'track' AS track_id
    FROM infra_object_level_crossing
    WHERE infra_id = $1
        AND obj_id = ANY($2)
),
collect AS (
    SELECT lcs.lc_id,
        ST_LineInterpolatePoint(
            tracks_layer.geographic,
            LEAST(
                GREATEST(
                    lcs.position / (tracks.data->'length')::float,
                    0.
                ),
                1.
            )
        ) AS geo,
        lcs.part_index AS part_index
    FROM lcs
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = lcs.track_id
        AND tracks.infra_id = $1
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
)
INSERT INTO infra_layer_level_crossing (obj_id, infra_id, geographic)
SELECT lc_id,
    $1,
    ST_Multi(ST_Collect(geo ORDER BY part_index)) AS geographic
FROM collect
GROUP BY lc_id
