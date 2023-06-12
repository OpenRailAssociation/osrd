WITH ops AS (
    SELECT obj_id AS op_id,
        (
            jsonb_array_elements(data->'parts')->'position'
        )::float AS position,
        jsonb_array_elements(data->'parts')->>'track' AS track_id
    FROM osrd_infra_operationalpointmodel
    WHERE infra_id = $1
        AND obj_id = ANY($2)
),
collect AS (
    SELECT ops.op_id,
        ST_Transform(
            ST_LineInterpolatePoint(
                ST_GeomFromGeoJSON(tracks.data->'geo'),
                LEAST(
                    GREATEST(
                        ops.position / (tracks.data->'length')::float,
                        0.
                    ),
                    1.
                )
            ),
            3857
        ) AS geo,
        ST_Transform(
            ST_LineInterpolatePoint(
                ST_GeomFromGeoJSON(tracks.data->'sch'),
                LEAST(
                    GREATEST(
                        ops.position / (tracks.data->'length')::float,
                        0.
                    ),
                    1.
                )
            ),
            3857
        ) AS sch
    FROM ops
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = ops.track_id
        AND tracks.infra_id = $1
)
INSERT INTO osrd_infra_operationalpointlayer (obj_id, infra_id, geographic, schematic)
SELECT op_id,
    $1,
    St_Collect(geo),
    St_Collect(sch)
FROM collect
GROUP BY op_id
