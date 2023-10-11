WITH ops AS (
    SELECT obj_id AS op_id,
        (
            jsonb_array_elements(data->'parts')->'position'
        )::float AS position,
        jsonb_array_elements(data->'parts')->>'track' AS track_id,
        jsonb_array_elements(data->'parts')->'extensions'->'sncf'->>'kp' AS kp
    FROM infra_object_operational_point
    WHERE infra_id = $1
        AND obj_id = ANY($2)
),
collect AS (
    SELECT ops.op_id,
        ST_LineInterpolatePoint(
            tracks_layer.geographic,
            LEAST(
                GREATEST(
                    ops.position / (tracks.data->'length')::float,
                    0.
                ),
                1.
            )
        ) AS geo,
        ST_LineInterpolatePoint(
            tracks_layer.schematic,
            LEAST(
                GREATEST(
                    ops.position / (tracks.data->'length')::float,
                    0.
                ),
                1.
            )
        ) AS sch,
        ops.kp AS kp
    FROM ops
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = ops.track_id
        AND tracks.infra_id = $1
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
)
INSERT INTO infra_layer_operational_point (obj_id, infra_id, geographic, schematic, kp)
SELECT op_id,
    $1,
    geo,
    sch,
    kp
FROM collect
GROUP BY op_id
