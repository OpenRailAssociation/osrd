DROP TABLE infra_layer_neutral_sign;
ALTER TABLE infra_layer_psl_sign DROP COLUMN angle_geo;
ALTER TABLE infra_layer_psl_sign DROP COLUMN angle_sch;
UPDATE infra_object_speed_section
SET data = jsonb_set(
        data,
        '{extensions,psl_sncf,announcement}',
        (
            SELECT jsonb_agg(
                    jsonb_set(
                        jsonb_set(element - 'direction', '{angle_geo}', '0'),
                        '{angle_sch}',
                        '0'
                    )
                )
            FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'announcement') AS element
        )
    )
WHERE data->'extensions'->'psl_sncf'->'announcement' IS NOT NULL
    AND data->'extensions'->'psl_sncf'->'announcement' != '[]'::jsonb;
UPDATE infra_object_speed_section
SET data = jsonb_set(
        data,
        '{extensions,psl_sncf,r}',
        (
            SELECT jsonb_agg(
                    jsonb_set(
                        jsonb_set(element - 'direction', '{angle_geo}', '0'),
                        '{angle_sch}',
                        '0'
                    )
                )
            FROM jsonb_array_elements(data->'extensions'->'psl_sncf'->'r') AS element
        )
    )
WHERE data->'extensions'->'psl_sncf'->'r' IS NOT NULL
    AND data->'extensions'->'psl_sncf'->'r' != '[]'::jsonb;
UPDATE infra_object_speed_section
SET data = jsonb_set(
        jsonb_set(
            jsonb_set(
                data,
                '{extensions,psl_sncf,z}',
                (data->'extensions'->'psl_sncf'->'z') - 'direction'
            ),
            '{extensions,psl_sncf,z,angle_geo}',
            '0'
        ),
        '{extensions,psl_sncf,z,angle_sch}',
        '0'
    )
WHERE data->'extensions'->'psl_sncf'->'z' IS NOT NULL;
UPDATE infra
SET railjson_version = '3.4.8';
