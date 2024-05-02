WITH signs AS (
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(
                data->'extensions'->'neutral_sncf'->'announcement'
            )->'position'
        )::float AS position,
        (
            jsonb_array_elements(
                data->'extensions'->'neutral_sncf'->'announcement'
            )->>'direction'
        ) AS direction,
        jsonb_array_elements(
            data->'extensions'->'neutral_sncf'->'announcement'
        )->>'track' AS track_id,
        jsonb_array_elements(
            data->'extensions'->'neutral_sncf'->'announcement'
        ) AS data
    FROM infra_object_neutral_section
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND infra_object_neutral_section.data @? '$.extensions.neutral_sncf.announcement'
    UNION
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(
                data->'extensions'->'neutral_sncf'->'rev'
            )->'position'
        )::float AS position,
        (
            jsonb_array_elements(
                data->'extensions'->'neutral_sncf'->'rev'
            )->>'direction'
        ) AS direction,
        jsonb_array_elements(
            data->'extensions'->'neutral_sncf'->'rev'
        )->>'track' AS track_id,
        jsonb_array_elements(
            data->'extensions'->'neutral_sncf'->'rev'
        ) AS data
    FROM infra_object_neutral_section
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND infra_object_neutral_section.data @? '$.extensions.neutral_sncf.rev'
    UNION
    SELECT obj_id AS sc_id,
        (
            jsonb_array_elements(data->'extensions'->'neutral_sncf'->'end')->'position'
        )::float AS position,
        (
            jsonb_array_elements(
                data->'extensions'->'neutral_sncf'->'end'
            )->>'direction'
        ) AS direction,
        jsonb_array_elements(data->'extensions'->'neutral_sncf'->'end')->>'track' AS track_id,
        jsonb_array_elements(data->'extensions'->'neutral_sncf'->'end') AS data
    FROM infra_object_neutral_section
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND infra_object_neutral_section.data @? '$.extensions.neutral_sncf.end'
    UNION
    SELECT obj_id AS sc_id,
        (
            data->'extensions'->'neutral_sncf'->'exe'->'position'
        )::float AS position,
        (
            data->'extensions'->'neutral_sncf'->'announcement'->>'direction'
        ) AS direction,
        data->'extensions'->'neutral_sncf'->'exe'->>'track' AS track_id,
        data->'extensions'->'neutral_sncf'->'exe' AS data
    FROM infra_object_neutral_section
    WHERE infra_id = $1
        AND obj_id = ANY($2)
        AND infra_object_neutral_section.data @? '$.extensions.neutral_sncf.exe'
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
INSERT INTO infra_layer_neutral_sign (
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
