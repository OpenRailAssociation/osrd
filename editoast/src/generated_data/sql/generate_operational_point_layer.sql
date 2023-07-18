WITH ops AS (
    SELECT obj_id AS op_id,
        (
            jsonb_array_elements(data->'parts')->'position'
        )::float AS position,
        jsonb_array_elements(data->'parts')->>'track' AS track_id
    FROM osrd_infra_operationalpointmodel
    WHERE infra_id = $1
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
        ) AS sch
    FROM ops
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = ops.track_id
        AND tracks.infra_id = $1
        INNER JOIN osrd_infra_tracksectionlayer AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
)
INSERT INTO osrd_infra_operationalpointlayer (obj_id, infra_id, geographic, schematic)
SELECT op_id,
    $1,
    St_Collect(geo),
    St_Collect(sch)
FROM collect
GROUP BY op_id
