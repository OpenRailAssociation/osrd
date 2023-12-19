UPDATE electrical_profile_set
SET "data" = jsonb_set(
    "data",
    '{levels}',
    ( -- add final 'V' to electrical_profile_set.data.levels[*].value if only digits
        SELECT jsonb_agg(
            CASE WHEN elem->>'value' ~ '^\d+$'
            THEN jsonb_set(elem, '{value}', to_jsonb(elem->>'value' || 'V'), FALSE)
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
            -- add final 'V' to electrical_profile_set.data.level_order keys if only digits
            CASE WHEN "key" ~ '^\d+$' THEN ("key" || 'V') ELSE "key" END,
            ( -- add final 'V' to electrical_profile_set.data.level_order.*[*] if only digits
                SELECT jsonb_agg(CASE WHEN elem #>> '{}' ~ '^\d+$' THEN to_jsonb(elem #>> '{}' || 'V') ELSE elem END)
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
    -- add final 'V' to elements of infra_object_electrification.data.voltage (split by ';') if only digits
    to_jsonb(array_to_string(
        ARRAY(
            SELECT (CASE WHEN elem ~ '^\d+$' THEN elem || 'V' ELSE elem END)
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
            -- add final 'V' to rolling_stock.effort_curves.modes keys if only digits and if .is_electric
            CASE WHEN ("key" ~ '^\d+$' AND "value"->'is_electric' = to_jsonb(TRUE)) THEN ("key" || 'V') ELSE "key" END,
            -- add final 'V' to rolling_stock.effort_curves.modes.*.curves[*].cond.electrical_profile_level if only digits
            jsonb_set(
                "value",
                '{curves}',
                (
                    SELECT jsonb_agg(
                        CASE WHEN elem->'cond'->>'electrical_profile_level' ~ '^\d+$'
                        THEN jsonb_set(
                            elem,
                            '{cond, electrical_profile_level}',
                            to_jsonb(elem->'cond'->>'electrical_profile_level' || 'V'),
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
    to_jsonb( -- add final 'V' to rolling_stock.effort_curves.default_mode if only digits
        CASE WHEN effort_curves->>'default_mode' ~ '^\d+$'
        THEN (effort_curves->>'default_mode' || 'V')
        ELSE effort_curves->>'default_mode' END
    ),
    FALSE
)
WHERE effort_curves->'default_mode' IS NOT NULL;

UPDATE simulation_output
SET electrification_ranges = (
     -- add final 'V' to simulation_output.electrification_ranges[*].electrificationUsage.mode if
     -- only digits and if .object_type = Electrified
    SELECT jsonb_agg(
        CASE WHEN elem->'electrificationUsage'->>'mode' ~ '^\d+$' AND elem->'electrificationUsage'->>'object_type' = 'Electrified'
        THEN jsonb_set(elem, '{electrificationUsage, mode}', to_jsonb(elem->'electrificationUsage'->>'mode' || 'V'), FALSE)
        ELSE elem END
    )
    FROM jsonb_array_elements(electrification_ranges) elem
)
WHERE electrification_ranges IS NOT NULL AND electrification_ranges != '[]'::jsonb;

UPDATE simulation_output
SET electrification_ranges = (
     -- add final 'V' to simulation_output.electrification_ranges[*].electrificationUsage.profile if
     -- only digits and if .object_type = Electrified
    SELECT jsonb_agg(
        CASE WHEN elem->'electrificationUsage'->>'profile' ~ '^\d+$' AND elem->'electrificationUsage'->>'object_type' = 'Electrified'
        THEN jsonb_set(elem, '{electrificationUsage, profile}', to_jsonb(elem->'electrificationUsage'->>'profile' || 'V'), FALSE)
        ELSE elem END
    )
    FROM jsonb_array_elements(electrification_ranges) elem
)
WHERE electrification_ranges IS NOT NULL AND electrification_ranges != '[]'::jsonb;
