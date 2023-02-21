WITH infra AS (
	SELECT %s AS id
),
railjson_version AS (
	SELECT railjson_version
	FROM public.osrd_infra_infra,
		infra
	WHERE public.osrd_infra_infra.id = infra.id
),
routes AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
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
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_switchmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
track_sections AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
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
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_signalmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
buffer_stops AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_bufferstopmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
detectors AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_detectormodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
catenaries AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_catenarymodel
		) x,
		infra
	WHERE x.infra_id = infra.id
),
speed_sections AS (
	SELECT coalesce(json_agg(x.data), '[]'::json) AS railjson
	FROM (
			SELECT *
			FROM public.osrd_infra_speedsectionmodel
		) x,
		infra
	WHERE x.infra_id = infra.id
)
SELECT json_build_object(
		'version',
		railjson_version.railjson_version,
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
		'catenaries',
		catenaries.railjson,
		'speed_sections',
		speed_sections.railjson
	)::TEXT
FROM routes
	CROSS JOIN railjson_version
	CROSS JOIN switch_types
	CROSS JOIN switches
	CROSS JOIN track_section_links
	CROSS JOIN track_sections
	CROSS JOIN signals
	CROSS JOIN buffer_stops
	CROSS JOIN detectors
	CROSS JOIN operational_points
	CROSS JOIN catenaries
	CROSS JOIN speed_sections;