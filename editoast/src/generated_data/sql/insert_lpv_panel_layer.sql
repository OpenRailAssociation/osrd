WITH panels AS (
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(data->'extensions'->'lpv_sncf'->'announcement')->'position'
        )::float AS position,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'announcement')->>'track' AS track_id,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'announcement') AS data
    FROM osrd_infra_speedsectionmodel
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND osrd_infra_speedsectionmodel.data @? '$.extensions.lpv_sncf.z'
    UNION
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(data->'extensions'->'lpv_sncf'->'r')->'position'
        )::float AS position,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'r')->>'track' AS track_id,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'r') AS data
    FROM osrd_infra_speedsectionmodel
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND osrd_infra_speedsectionmodel.data @? '$.extensions.lpv_sncf.z'
    UNION
    SELECT obj_id AS sc_id,
        (data->'extensions'->'lpv_sncf'->'z'->'position')::float AS position,
        data->'extensions'->'lpv_sncf'->'z'->>'track' AS track_id,
        data->'extensions'->'lpv_sncf'->'z' AS data
    FROM osrd_infra_speedsectionmodel
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND osrd_infra_speedsectionmodel.data @? '$.extensions.lpv_sncf.z'
),
collect AS (
    SELECT panels.sc_id,
        panels.data,
        ST_Transform(
            ST_LineInterpolatePoint(
                ST_GeomFromGeoJSON(tracks.data->'geo'),
                LEAST(
                    GREATEST(
                        panels.position / (tracks.data->'length')::float,
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
                        panels.position / (tracks.data->'length')::float,
                        0.
                    ),
                    1.
                )
            ),
            3857
        ) AS sch
    FROM panels
        INNER JOIN osrd_infra_tracksectionmodel AS tracks ON tracks.obj_id = panels.track_id
        AND tracks.infra_id = $1
)
INSERT INTO osrd_infra_lpvpanellayer (obj_id, infra_id, geographic, schematic, data)
SELECT sc_id,
    $1,
    geo,
    sch,
    data
FROM collect
