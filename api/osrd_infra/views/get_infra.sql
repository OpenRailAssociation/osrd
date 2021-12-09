WITH infra AS (
	SELECT %s AS id
),
routes AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_routemodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
operational_points AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_operationalpointmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
switch_types AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_switchtypemodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
switches AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_switchmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
track_sections AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_tracksectionmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
track_section_links AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_tracksectionlinkmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
signals AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_signalmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
buffer_stops AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_bufferstopmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
detectors AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_detectormodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
tvd_sections AS (
	SELECT jsonb_agg(x.data - 'geo' - 'sch')
	FROM (
			SELECT *
			FROM public.osrd_infra_tvdsectionmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
script_functions AS (
	SELECT jsonb_agg(x.data)
	FROM (
			SELECT *
			FROM public.osrd_infra_railscriptfunctionmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
aspects AS (
	SELECT jsonb_agg(x.data)
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
	CROSS JOIN operational_points;