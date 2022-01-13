WITH infra AS (
	SELECT %s AS id
),
routes AS (
	SELECT coalesce(json_agg(x.data - 'geo' - 'sch'), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_routemodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
operational_points AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_operationalpointmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
switch_types AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_switchtypemodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
switches AS (
	SELECT coalesce(json_agg(x.data - 'geo' - 'sch'), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_switchmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
track_sections AS (
	SELECT coalesce(json_agg(x.data - 'geo' - 'sch'), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_tracksectionmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
track_section_links AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_tracksectionlinkmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
signals AS (
	SELECT coalesce(json_agg(x.data - 'geo' - 'sch'), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_signalmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
buffer_stops AS (
	SELECT coalesce(json_agg(x.data - 'geo' - 'sch'), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_bufferstopmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
detectors AS (
	SELECT coalesce(json_agg(x.data - 'geo' - 'sch'), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_detectormodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
tvd_sections AS (
	SELECT coalesce(json_agg(x.data - 'geo' - 'sch'), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_tvdsectionmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
script_functions AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_railscriptfunctionmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
aspects AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_aspectmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
)
SELECT json_build_object(
		'version',
		'2.0.0',
		'operational_points',
		operational_points.railjson,
		'routes',
		routes.railjson,
		'switch_types',
		switch_types.railjson,
		'switches',
		switches.railjson,
		'track_section_links',
		track_section_links.railjson,
		'track_sections',
		track_sections.railjson,
		'signals',
		signals.railjson,
		'buffer_stops',
		buffer_stops.railjson,
		'detectors',
		detectors.railjson,
		'tvd_sections',
		tvd_sections.railjson,
		'script_functions',
		script_functions.railjson,
		'aspects',
		aspects.railjson
	)::TEXT
FROM routes
	CROSS JOIN switch_types
	CROSS JOIN switches
	CROSS JOIN track_section_links
	CROSS JOIN track_sections
	CROSS JOIN signals
	CROSS JOIN buffer_stops
	CROSS JOIN detectors
	CROSS JOIN tvd_sections
	CROSS JOIN script_functions
	CROSS JOIN aspects
	CROSS JOIN operational_points;
