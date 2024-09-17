-- infra
UPDATE infra_object_speed_section
SET "data" = jsonb_set(
    "data",
    '{speed_limit_by_tag}',
    (
        SELECT jsonb_object_agg(
            CASE WHEN ("value"::TEXT !~ '^[\d\.]+$') THEN "key" ELSE (
                CASE WHEN "key" ~ '^Voyageurs - Trains réversibles V\d+$' THEN regexp_replace("key", '^Voyageurs - Trains réversibles V(\d+)$', 'R\1')
                    WHEN "key" ~ '^Voyageurs - V\d+$' THEN regexp_replace("key", '^Voyageurs - V(\d+)$', 'V\1')
                    WHEN "key" ~ '^Voyageurs - AR\d+$' THEN regexp_replace("key", '^Voyageurs - AR(\d+)$', 'AR\1')
                    WHEN "key" ~ '^Messagerie - [A-Z\d]+$' THEN regexp_replace("key", '^Messagerie - ([A-Z\d]+)$', '\1')
                    WHEN "key" ~ '^Marchandise - [A-Z\d]+$' THEN regexp_replace("key", '^Marchandise - ([A-Z\d]+)$', '\1')
                    WHEN "key" ~ '^Voyageurs - Automoteurs - [A-Z\d]+$' THEN regexp_replace("key", '^Voyageurs - Automoteurs - ([A-Z\d]+)$', '\1')
                    WHEN "key" ~ '^Voyageurs - Autorails - [A-Z\d]+$' THEN regexp_replace("key", '^Voyageurs - Autorails - ([A-Z\d]+)$', '\1')
                    WHEN "key" ~ '^Voyageurs - BIMA - [A-Z\d]+$' THEN regexp_replace("key", '^Voyageurs - BIMA - ([A-Z\d]+)$', '\1')
                    WHEN "key" = 'Voyageurs - Automoteurs' THEN 'Automoteurs'
                    WHEN "key" = 'Voyageurs - Autorails' THEN 'Autorails'
                    WHEN "key" = 'Voyageurs - BIMA' THEN 'BIMA'
                    WHEN "key" = 'Voyageurs - TALGO' THEN 'TALGO'
                    WHEN "key" = 'Divers - Haut le pied' THEN 'HLP'
                    WHEN "key" = 'Divers - Train de machines' THEN 'TM'
                    WHEN "key" = 'Divers - Evolution' THEN 'EVO'
                    ELSE "key" END
                ) END,
            "value"
        )
        FROM jsonb_each("data"->'speed_limit_by_tag')
    ),
    FALSE
) 
WHERE "data"->'speed_limit_by_tag' IS NOT NULL AND "data"->'speed_limit_by_tag'::TEXT != '{}';

UPDATE infra SET "version" = ("version"::INT8 + 1)::TEXT;
UPDATE infra SET generated_version = (generated_version::INT8 + 1)::TEXT;

-- train-schedule
UPDATE train_schedule
SET speed_limit_tag = (
    CASE WHEN speed_limit_tag ~ '^Voyageurs - Trains réversibles V\d+$' THEN regexp_replace(speed_limit_tag, '^Voyageurs - Trains réversibles V(\d+)$', 'R\1')
        WHEN speed_limit_tag ~ '^Voyageurs - V\d+$' THEN regexp_replace(speed_limit_tag, '^Voyageurs - V(\d+)$', 'V\1')
        WHEN speed_limit_tag ~ '^Voyageurs - AR\d+$' THEN regexp_replace(speed_limit_tag, '^Voyageurs - AR(\d+)$', 'AR\1')
        WHEN speed_limit_tag ~ '^Messagerie - [A-Z\d]+$' THEN regexp_replace(speed_limit_tag, '^Messagerie - ([A-Z\d]+)$', '\1')
        WHEN speed_limit_tag ~ '^Marchandise - [A-Z\d]+$' THEN regexp_replace(speed_limit_tag, '^Marchandise - ([A-Z\d]+)$', '\1')
        WHEN speed_limit_tag ~ '^Voyageurs - Automoteurs - [A-Z\d]+$' THEN regexp_replace(speed_limit_tag, '^Voyageurs - Automoteurs - ([A-Z\d]+)$', '\1')
        WHEN speed_limit_tag ~ '^Voyageurs - Autorails - [A-Z\d]+$' THEN regexp_replace(speed_limit_tag, '^Voyageurs - Autorails - ([A-Z\d]+)$', '\1')
        WHEN speed_limit_tag ~ '^Voyageurs - BIMA - [A-Z\d]+$' THEN regexp_replace(speed_limit_tag, '^Voyageurs - BIMA - ([A-Z\d]+)$', '\1')
        WHEN speed_limit_tag = 'Voyageurs - Automoteurs' THEN 'Automoteurs'
        WHEN speed_limit_tag = 'Voyageurs - Autorails' THEN 'Autorails'
        WHEN speed_limit_tag = 'Voyageurs - BIMA' THEN 'BIMA'
        WHEN speed_limit_tag = 'Voyageurs - TALGO' THEN 'TALGO'
        WHEN speed_limit_tag = 'Divers - Haut le pied' THEN 'HLP'
        WHEN speed_limit_tag = 'Divers - Train de machines' THEN 'TM'
        WHEN speed_limit_tag = 'Divers - Evolution' THEN 'EVO'
        ELSE speed_limit_tag END
    )
WHERE speed_limit_tag IS NOT NULL;
