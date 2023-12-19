UPDATE electrical_profile_set
SET "data" = jsonb_set(
    "data",
    '{levels}',
    ( -- remove final 'V' to electrical_profile_set.data.levels[*].value if only preceded by digits
        SELECT jsonb_agg(
            CASE WHEN elem->>'value' ~ '^\d+V$'
            THEN jsonb_set(elem, '{value}', to_jsonb(left(elem->>'value', -1)), FALSE)
            ELSE elem END
        )
        FROM jsonb_array_elements("data"->'levels') elem
    ),
    FALSE
)
WHERE "data"->'levels' IS NOT NULL AND "data"->'levels' != '[]'::jsonb;

UPDATE electrical_profile_set
SET "data" = jsonb_set(
    "data",
    '{level_order}',
    (
        SELECT jsonb_object_agg(
            -- remove final 'V' to electrical_profile_set.data.level_order keys if only preceded by digits
            CASE WHEN "key" ~ '^\d+V$' THEN left("key", -1) ELSE "key" END,
            ( -- remove final 'V' to electrical_profile_set.data.level_order.*[*] if only preceded by digits
                SELECT jsonb_agg(CASE WHEN elem #>> '{}' ~ '^\d+V$' THEN to_jsonb(left(elem #>> '{}', -1)) ELSE elem END)
                FROM jsonb_array_elements("value") elem
            )
        )
        FROM jsonb_each("data"->'level_order')
    ),
    FALSE
)
WHERE "data"->'level_order' IS NOT NULL;

UPDATE infra_object_electrification
SET "data" = jsonb_set(
    "data",
    '{voltage}',
    -- remove final 'V' to elements of infra_object_electrification.data.voltage (split by ';') if only preceded by digits
    to_jsonb(array_to_string(
        ARRAY(
            SELECT (CASE WHEN elem ~ '^\d+V$' THEN left(elem, -1) ELSE elem END)
            FROM unnest(string_to_array("data"->>'voltage', ';')) elem
        ),
        ';'
    )),
    FALSE
)
WHERE "data"->'voltage' IS NOT NULL;

UPDATE rolling_stock
SET effort_curves = jsonb_set(
    effort_curves,
    '{modes}',
    (
        SELECT jsonb_object_agg(
            -- remove final 'V' to rolling_stock.effort_curves.modes keys if only preceded by digits and if .is_electric
            CASE WHEN ("key" ~ '^\d+V$' AND "value"->'is_electric' = to_jsonb(TRUE)) THEN left("key", -1) ELSE "key" END,
            -- remove final 'V' to rolling_stock.effort_curves.modes.*.curves[*].cond.electrical_profile_level if only preceded by digits
            jsonb_set(
                "value",
                '{curves}',
                (
                    SELECT jsonb_agg(
                        CASE WHEN elem->'cond'->>'electrical_profile_level' ~ '^\d+V$'
                        THEN jsonb_set(
                            elem,
                            '{cond, electrical_profile_level}',
                            to_jsonb(left(elem->'cond'->>'electrical_profile_level', -1)),
                            FALSE
                        )
                        ELSE elem END
                    )
                    FROM jsonb_array_elements("value"->'curves') elem
                ),
                FALSE
            )
        )
        FROM jsonb_each(effort_curves->'modes')
    ),
    FALSE
)
WHERE effort_curves->'modes' IS NOT NULL;

UPDATE rolling_stock
SET effort_curves = jsonb_set(
    effort_curves,
    '{default_mode}',
    to_jsonb( -- remove final 'V' to rolling_stock.effort_curves.default_mode if only preceded by digits
        CASE WHEN effort_curves->>'default_mode' ~ '^\d+V$'
        THEN left(effort_curves->>'default_mode', -1)
        ELSE effort_curves->>'default_mode' END
    ),
    FALSE
)
WHERE effort_curves->'default_mode' IS NOT NULL;

UPDATE simulation_output
SET electrification_ranges = (
     -- remove final 'V' to simulation_output.electrification_ranges[*].electrificationUsage.mode if
     -- only preceded by digits and if .object_type = Electrified
    SELECT jsonb_agg(
        CASE WHEN elem->'electrificationUsage'->>'mode' ~ '^\d+V$' AND elem->'electrificationUsage'->>'object_type' = 'Electrified'
        THEN jsonb_set(elem, '{electrificationUsage, mode}', to_jsonb(left(elem->'electrificationUsage'->>'mode', -1)), FALSE)
        ELSE elem END
    )
    FROM jsonb_array_elements(electrification_ranges) elem
)
WHERE electrification_ranges IS NOT NULL AND electrification_ranges != '[]'::jsonb;

UPDATE simulation_output
SET electrification_ranges = (
     -- remove final 'V' to simulation_output.electrification_ranges[*].electrificationUsage.profile if
     -- only preceded by digits and if .object_type = Electrified
    SELECT jsonb_agg(
        CASE WHEN elem->'electrificationUsage'->>'profile' ~ '^\d+V$' AND elem->'electrificationUsage'->>'object_type' = 'Electrified'
        THEN jsonb_set(elem, '{electrificationUsage, profile}', to_jsonb(left(elem->'electrificationUsage'->>'profile', -1)), FALSE)
        ELSE elem END
    )
    FROM jsonb_array_elements(electrification_ranges) elem
)
WHERE electrification_ranges IS NOT NULL AND electrification_ranges != '[]'::jsonb;
