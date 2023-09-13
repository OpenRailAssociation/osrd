WITH panels AS (
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(data->'extensions'->'lpv_sncf'->'announcement')->'position'
        )::float AS position,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'announcement')->>'track' AS track_id,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'announcement') AS data
    FROM infra_object_speed_section
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND infra_object_speed_section.data @? '$.extensions.lpv_sncf.z'
    UNION
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(data->'extensions'->'lpv_sncf'->'r')->'position'
        )::float AS position,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'r')->>'track' AS track_id,
        jsonb_array_elements(data->'extensions'->'lpv_sncf'->'r') AS data
    FROM infra_object_speed_section
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND infra_object_speed_section.data @? '$.extensions.lpv_sncf.z'
    UNION
    SELECT obj_id AS sc_id,
        (data->'extensions'->'lpv_sncf'->'z'->'position')::float AS position,
        data->'extensions'->'lpv_sncf'->'z'->>'track' AS track_id,
        data->'extensions'->'lpv_sncf'->'z' AS data
    FROM infra_object_speed_section
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND infra_object_speed_section.data @? '$.extensions.lpv_sncf.z'
),
collect AS (
    SELECT panels.sc_id,
        panels.data,
        ST_LineInterpolatePoint(
            tracks_layer.geographic,
            LEAST(
                GREATEST(
                    panels.position / (tracks.data->'length')::float,
                    0.
                ),
                1.
            )
        ) AS geo,
        ST_LineInterpolatePoint(
            tracks_layer.schematic,
            LEAST(
                GREATEST(
                    panels.position / (tracks.data->'length')::float,
                    0.
                ),
                1.
            )
        ) AS sch
    FROM panels
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = panels.track_id
        AND tracks.infra_id = $1
        INNER JOIN infra_layer_track_section AS tracks_layer ON tracks.obj_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
)
INSERT INTO infra_layer_lpv_panel (obj_id, infra_id, geographic, schematic, data)
SELECT sc_id,
    $1,
    geo,
    sch,
    data
FROM collect
