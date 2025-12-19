UPDATE infra_object_operational_point AS op
SET data = jsonb_set(
    op.data,
    '{parts}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN ts.data->'extensions'->'sncf'->>'track_name' IS NOT NULL THEN
                    part || jsonb_build_object('local_track_name', ts.data->'extensions'->'sncf'->>'track_name')
                ELSE
                    part || jsonb_build_object('local_track_name', 'missing local track name')
            END
        )
        FROM jsonb_array_elements(op.data->'parts') AS part
        LEFT JOIN infra_object_track_section AS ts
            ON ts.obj_id = part->>'track'
            AND ts.infra_id = op.infra_id
    )
)
WHERE jsonb_array_length(op.data->'parts') > 0;

UPDATE infra
SET railjson_version = '3.5.1';
