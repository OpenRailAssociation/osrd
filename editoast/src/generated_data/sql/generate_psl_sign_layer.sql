WITH signs AS (
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement')->'position'
        )::float AS position,
        jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement')->>'track' AS track_id,
        jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement')->>'direction' AS direction,
        jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement') AS data
    FROM infra_object_speed_section
    WHERE infra_id = $1
        AND infra_object_speed_section.data @? '$.extensions.psl_sncf.z'
    UNION
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(data->'extensions'->'psl_sncf'->'r')->'position'
        )::float AS position,
        jsonb_array_elements(data->'extensions'->'psl_sncf'->'r')->>'track' AS track_id,
        jsonb_array_elements(data->'extensions'->'psl_sncf'->'r')->>'direction' AS direction,
        jsonb_array_elements(data->'extensions'->'psl_sncf'->'r') AS data
    FROM infra_object_speed_section
    WHERE infra_id = $1
        AND infra_object_speed_section.data @? '$.extensions.psl_sncf.z'
    UNION
    SELECT obj_id AS sc_id,
        (data->'extensions'->'psl_sncf'->'z'->'position')::float AS position,
        data->'extensions'->'psl_sncf'->'z'->>'track' AS track_id,
        data->'extensions'->'psl_sncf'->'z'->>'direction' AS direction,
        data->'extensions'->'psl_sncf'->'z' AS data
    FROM infra_object_speed_section
    WHERE infra_id = $1
        AND infra_object_speed_section.data @? '$.extensions.psl_sncf.z'
),
collect AS (
    SELECT signs.sc_id,
        signs.data,
        tracks_layer.geographic AS track_geo,
        LEAST(
            GREATEST(position / (tracks.data->>'length')::float, 0.),
            1.
        ) AS norm_pos,
        CASE
            direction
            WHEN 'STOP_TO_START' THEN 180.
            ELSE 0.
        END AS angle_direction
    FROM signs
        INNER JOIN infra_object_track_section AS tracks ON tracks.obj_id = signs.track_id
        AND tracks.infra_id = $1
        INNER JOIN infra_layer_track_section AS tracks_layer ON signs.track_id = tracks_layer.obj_id
        AND tracks.infra_id = tracks_layer.infra_id
)
INSERT INTO infra_layer_psl_sign (
        obj_id,
        infra_id,
        geographic,
        angle_geo,
        data
    )
SELECT DISTINCT ON (
        ST_LineInterpolatePoint(track_geo, norm_pos),
        (data->>'type')::text
    ) collect.sc_id,
    $1,
    ST_LineInterpolatePoint(track_geo, norm_pos),
    COALESCE(
        degrees(
            ST_Azimuth(
                ST_LineInterpolatePoint(track_geo, GREATEST(norm_pos - 0.0001, 0.)),
                ST_LineInterpolatePoint(track_geo, LEAST(norm_pos + 0.0001, 1.))
            )
        ) + angle_direction,
        0.
    ),
    collect.data
FROM collect
