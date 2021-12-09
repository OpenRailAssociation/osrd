WITH routes AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_routemodel
		) x
	WHERE x.infra_id = %s
),
operational_points AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_operationalpointmodel
		) x
	WHERE x.infra_id = %s
),
switch_types AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_switchtypemodel
		) x
	WHERE x.infra_id = %s
),
switches AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_switchmodel
		) x
	WHERE x.infra_id = %s
),
track_sections AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_tracksectionmodel
		) x
	WHERE x.infra_id = %s
),
track_section_links AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_tracksectionlinkmodel
		) x
	WHERE x.infra_id = %s
),
signals AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_signalmodel
		) x
	WHERE x.infra_id = %s
),
buffer_stops AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_bufferstopmodel
		) x
	WHERE x.infra_id = %s
),
detectors AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_detectormodel
		) x
	WHERE x.infra_id = %s
),
tvd_sections AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_tvdsectionmodel
		) x
	WHERE x.infra_id = %s
),
script_functions AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_railscriptfunctionmodel
		) x
	WHERE x.infra_id = %s
),
aspects AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_aspectmodel
		) x
	WHERE x.infra_id = %s
)
SELECT json_build_object(
		'version',
		'2.0.0',
		'operational_points',
		operational_points.jsonb_agg,
		'routes',
		routes.jsonb_agg,
		'switch_types',
		switch_types.jsonb_agg,
		'switches',
		switches.jsonb_agg,
		'track_section_links',
		track_section_links.jsonb_agg,
		'track_sections',
		track_sections.jsonb_agg,
		'signals',
		signals.jsonb_agg,
		'buffer_stops',
		buffer_stops.jsonb_agg,
		'detectors',
		detectors.jsonb_agg,
		'tvd_sections',
		tvd_sections.jsonb_agg,
		'script_functions',
		script_functions.jsonb_agg,
		'aspects',
		aspects.jsonb_agg
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
	CROSS JOIN operational_points