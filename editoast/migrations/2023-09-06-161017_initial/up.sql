CREATE OR REPLACE FUNCTION search_operationalpoint__ins_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
INSERT INTO "search_operational_point" (
        id,
        "name",
        "infra_id",
        "obj_id",
        "uic",
        "ch",
        "trigram"
    )
SELECT t.id AS id,
    (
        osrd_prepare_for_search((t.data#>>'{extensions,identifier,name}'))
    ) AS "name",
    (t.infra_id) AS "infra_id",
    (t.obj_id) AS "obj_id",
    ((t.data#>'{extensions,identifier,uic}')::integer) AS "uic",
    (t.data->'extensions'->'sncf'->>'ch') AS "ch",
    (t.data#>>'{extensions,sncf,trigram}') AS "trigram"
FROM (
        SELECT NEW.*
    ) AS t;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_operationalpoint__upd_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
UPDATE "search_operational_point"
SET "name" = (
        osrd_prepare_for_search((t.data#>>'{extensions,identifier,name}'))
    ),
    "infra_id" = (t.infra_id),
    "obj_id" = (t.obj_id),
    "uic" = ((t.data#>'{extensions,identifier,uic}')::integer),
    "ch" = (t.data->'extensions'->'sncf'->>'ch'),
    "trigram" = (t.data#>>'{extensions,sncf,trigram}')
FROM (
        SELECT NEW.*
    ) AS t
WHERE t.id = "search_operational_point".id;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_project__ins_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
INSERT INTO "search_project" (id, "name", "description", "tags")
SELECT t.id AS id,
    (osrd_prepare_for_search((t.name))) AS "name",
    (osrd_prepare_for_search((t.description))) AS "description",
    (osrd_prepare_for_search_tags(t.tags)) AS "tags"
FROM (
        SELECT NEW.*
    ) AS t;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_project__upd_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
UPDATE "search_project"
SET "name" = (osrd_prepare_for_search((t.name))),
    "description" = (osrd_prepare_for_search((t.description))),
    "tags" = (osrd_prepare_for_search_tags(t.tags))
FROM (
        SELECT NEW.*
    ) AS t
WHERE t.id = "search_project".id;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_scenario__ins_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
INSERT INTO "search_scenario" (id, "name", "description", "study_id", "tags")
SELECT t.id AS id,
    (osrd_prepare_for_search((t.name))) AS "name",
    (osrd_prepare_for_search((t.description))) AS "description",
    (t.study_id) AS "study_id",
    (osrd_prepare_for_search_tags(t.tags)) AS "tags"
FROM (
        SELECT NEW.*
    ) AS t;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_scenario__upd_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
UPDATE "search_scenario"
SET "name" = (osrd_prepare_for_search((t.name))),
    "description" = (osrd_prepare_for_search((t.description))),
    "study_id" = (t.study_id),
    "tags" = (osrd_prepare_for_search_tags(t.tags))
FROM (
        SELECT NEW.*
    ) AS t
WHERE t.id = "search_scenario".id;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_signal__ins_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
INSERT INTO "search_signal" (
        id,
        "label",
        "line_name",
        "infra_id",
        "obj_id",
        "aspects",
        "systems",
        "line_code"
    )
SELECT t.id AS id,
    (
        osrd_prepare_for_search((t.data->'extensions'->'sncf'->>'label'))
    ) AS "label",
    (
        osrd_prepare_for_search((ts.data->'extensions'->'sncf'->>'line_name'))
    ) AS "line_name",
    (t.infra_id) AS "infra_id",
    (t.obj_id) AS "obj_id",
    (
        array_remove(
            ARRAY(
                SELECT jsonb_array_elements_text(
                        jsonb_strip_nulls(t.data)->'extensions'->'sncf'->'aspects'
                    )
            )::text [],
            NULL
        )
    ) AS "aspects",
    (
        ARRAY(
            SELECT *
            FROM jsonb_to_recordset(jsonb_strip_nulls(t.data)->'logical_signals') AS (signaling_system text)
        )
    ) AS "systems",
    (
        (ts.data->'extensions'->'sncf'->>'line_code')::integer
    ) AS "line_code"
FROM (
        SELECT NEW.*
    ) AS t
    INNER JOIN infra_object_track_section AS ts ON ts.infra_id = t.infra_id
    AND ts.obj_id = t.data->>'track';
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_signal__upd_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
UPDATE "search_signal"
SET "label" = (
        osrd_prepare_for_search((t.data->'extensions'->'sncf'->>'label'))
    ),
    "line_name" = (
        osrd_prepare_for_search((ts.data->'extensions'->'sncf'->>'line_name'))
    ),
    "infra_id" = (t.infra_id),
    "obj_id" = (t.obj_id),
    "aspects" = (
        array_remove(
            ARRAY(
                SELECT jsonb_array_elements_text(
                        jsonb_strip_nulls(t.data)->'extensions'->'sncf'->'aspects'
                    )
            )::text [],
            NULL
        )
    ),
    "systems" = (
        ARRAY(
            SELECT *
            FROM jsonb_to_recordset(jsonb_strip_nulls(t.data)->'logical_signals') AS (signaling_system text)
        )
    ),
    "line_code" = (
        (ts.data->'extensions'->'sncf'->>'line_code')::integer
    )
FROM (
        SELECT NEW.*
    ) AS t
    INNER JOIN infra_object_track_section ts ON ts.infra_id = t.infra_id
    AND ts.obj_id = t.data->>'track'
WHERE t.id = "search_signal".id;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_study__ins_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
INSERT INTO "search_study" (id, "name", "description", "project_id", "tags")
SELECT t.id AS id,
    (osrd_prepare_for_search((t.name))) AS "name",
    (osrd_prepare_for_search((t.description))) AS "description",
    (t.project_id) AS "project_id",
    (osrd_prepare_for_search_tags(t.tags)) AS "tags"
FROM (
        SELECT NEW.*
    ) AS t;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_study__upd_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
UPDATE "search_study"
SET "name" = (osrd_prepare_for_search((t.name))),
    "description" = (osrd_prepare_for_search((t.description))),
    "project_id" = (t.project_id),
    "tags" = (osrd_prepare_for_search_tags(t.tags))
FROM (
        SELECT NEW.*
    ) AS t
WHERE t.id = "search_study".id;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_track__del_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN
DELETE FROM search_track
WHERE search_track.infra_id = OLD.infra_id
    AND search_track.line_code = (OLD."data"#>>'{extensions,sncf,line_code}')::integer
    AND NOT EXISTS(
        SELECT NULL
        FROM infra_object_track_section AS model
        WHERE model.id <> OLD.id
            AND model.infra_id = OLD.infra_id
            AND model."data"#>>'{extensions,sncf,line_code}' = OLD."data"#>>'{extensions,sncf,line_code}'
        GROUP BY model."data"#>>'{extensions,sncf,line_code}'
    );
RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_track__ins_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN IF NEW."data"#>>'{extensions,sncf,line_code}' IS NULL
OR NEW."data"#>>'{extensions,sncf,line_name}' IS NULL THEN RETURN NEW;
END IF;
PERFORM NULL
FROM search_track
WHERE infra_id = NEW.infra_id
    AND line_code = (
        NEW."data"#>>'{extensions,sncf,line_code}'
    )::integer;
-- if the track section introduces a new track:
IF NOT FOUND THEN
INSERT INTO search_track (
        infra_id,
        line_code,
        line_name,
        unprocessed_line_name
    )
VALUES (
        NEW.infra_id,
        (
            NEW."data"#>>'{extensions,sncf,line_code}'
        )::integer,
        osrd_prepare_for_search(
            NEW."data"#>>'{extensions,sncf,line_name}'
        ),
        NEW."data"#>>'{extensions,sncf,line_name}'
    );
END IF;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION search_track__upd_trig_fun()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN -- line_code or infra_id may have been changed which would create a new track
PERFORM NULL
FROM search_track
WHERE infra_id = NEW.infra_id
    AND line_code = (
        NEW."data"#>>'{extensions,sncf,line_code}'
    )::integer;
IF (
    NOT FOUND
    AND NEW."data"#>>'{extensions,sncf,line_code}' IS NOT NULL
    AND NEW."data"#>>'{extensions,sncf,line_name}' IS NOT NULL
) THEN -- and create the new one
INSERT INTO search_track (
        infra_id,
        line_code,
        line_name,
        unprocessed_line_name
    )
VALUES (
        NEW.infra_id,
        (
            NEW."data"#>>'{extensions,sncf,line_code}'
        )::integer,
        osrd_prepare_for_search(
            NEW."data"#>>'{extensions,sncf,line_name}'
        ),
        NEW."data"#>>'{extensions,sncf,line_name}'
    );
END IF;
-- remove the old search entry if OLD was the last track section of the line
DELETE FROM search_track
WHERE search_track.infra_id = OLD.infra_id
    AND search_track.line_code = (OLD."data"#>>'{extensions,sncf,line_code}')::integer
    AND NOT EXISTS(
        SELECT NULL
        FROM infra_object_track_section AS model
        WHERE model.id <> OLD.id
            AND model.infra_id = OLD.infra_id
            AND model."data"#>>'{extensions,sncf,line_code}' = OLD."data"#>>'{extensions,sncf,line_code}'
        GROUP BY model."data"#>>'{extensions,sncf,line_code}'
    );
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION osrd_prepare_for_search(input_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
SELECT array_to_string(
        tsvector_to_array(
            to_tsvector('simple', unaccent(coalesce(input_text, '')))
        ),
        E'\n'
    ) $function$
;

CREATE OR REPLACE FUNCTION osrd_prepare_for_search_tags(tags text[])
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
AS $function$
DECLARE prepared_tags tsvector [];
concatenated_tags tsvector;
search_text TEXT;
BEGIN IF tags IS NULL
OR array_length(tags, 1) = 0 THEN RETURN NULL;
END IF;
FOR i IN 1..coalesce(array_length(tags, 1), 0) LOOP prepared_tags [i] := to_tsvector('simple', unaccent(coalesce(tags [i], '')));
END LOOP;
concatenated_tags := coalesce(prepared_tags [1], '0');
FOR i IN 2..coalesce(array_length(tags, 1), 0) LOOP concatenated_tags := concatenated_tags || coalesce(prepared_tags [i], '0');
END LOOP;
search_text := array_to_string(tsvector_to_array(concatenated_tags), E'
');
RETURN search_text;
END;
$function$
;

CREATE OR REPLACE FUNCTION osrd_to_ilike_search(query text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
SELECT '%' || array_to_string(
        tsvector_to_array(
            to_tsvector(
                'simple',
                unaccent(
                    replace(
                        coalesce(query, ''),
                        '-',
                        ' '
                    )
                )
            )
        ),
        '%'
    ) || '%' $function$
;

CREATE OR REPLACE FUNCTION tilebbox(z integer, x integer, y integer, srid integer DEFAULT 3857)
 RETURNS geometry
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE max numeric := 20037508.34;
res numeric := (max * 2) /(2 ^ z);
bbox geometry;
BEGIN bbox := ST_MakeEnvelope(
    - max + (x * res),
    max - (y * res),
    - max + (x * res) + res,
    max - (y * res) - res,
    3857
);
IF srid = 3857 then return bbox;
ELSE return ST_Transform(bbox, srid);
END IF;
END;
$function$
;


-- "document" definition

-- Drop table

-- DROP TABLE "document";

CREATE TABLE "document" (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	content_type varchar(255) NOT NULL,
	data bytea NOT NULL
);


-- electrical_profile_set definition

-- Drop table

-- DROP TABLE electrical_profile_set;

CREATE TABLE electrical_profile_set (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	name varchar(128) NOT NULL,
	data jsonb NOT NULL
);


-- infra definition

-- Drop table

-- DROP TABLE infra;

CREATE TABLE infra (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	name varchar(128) NOT NULL,
	railjson_version varchar(16) NOT NULL,
	owner uuid NOT NULL,
	version varchar(40) NOT NULL,
	generated_version varchar(40) NULL,
	locked bool NOT NULL,
	created timestamptz NOT NULL,
	modified timestamptz NOT NULL
);


-- rolling_stock definition

-- Drop table

-- DROP TABLE rolling_stock;

CREATE TABLE rolling_stock (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	railjson_version varchar(16) NOT NULL,
	name varchar(255) NOT NULL UNIQUE,
	effort_curves jsonb NOT NULL,
	metadata jsonb NOT NULL,
	length float8 NOT NULL,
	max_speed float8 NOT NULL,
	startup_time float8 NOT NULL,
	startup_acceleration float8 NOT NULL,
	comfort_acceleration float8 NOT NULL,
	gamma jsonb NOT NULL,
	inertia_coefficient float8 NOT NULL,
	base_power_class varchar(255) NOT NULL,
	features text[] NOT NULL,
	mass float8 NOT NULL,
	rolling_resistance jsonb NOT NULL,
	loading_gauge varchar(16) NOT NULL,
	power_restrictions jsonb NULL,
	energy_sources jsonb NOT NULL,
	"locked" bool NOT NULL,
	electrical_power_startup_time float8 NULL,
	raise_pantograph_time float8 NULL,
	"version" int8 NOT NULL
);


-- search_track definition

-- Drop table

-- DROP TABLE search_track;

CREATE TABLE search_track (
	infra_id int4 NOT NULL,
	line_code int4 NOT NULL,
	line_name text NOT NULL,
	unprocessed_line_name text NOT NULL,
	id bigserial NOT NULL,
	CONSTRAINT search_track_infra_id_line_code_key UNIQUE (infra_id, line_code),
	CONSTRAINT search_track_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_gin_search_track_line_name ON search_track USING gin (line_name gin_trgm_ops);


-- timetable definition

-- Drop table

-- DROP TABLE timetable;

CREATE TABLE timetable (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	name varchar(128) NOT NULL
);


-- infra_layer_buffer_stop definition

-- Drop table

-- DROP TABLE infra_layer_buffer_stop;

CREATE TABLE infra_layer_buffer_stop (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(point, 3857) NOT NULL,
	schematic geometry(point, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_buffer_stop_geographic_id ON infra_layer_buffer_stop USING gist (geographic);
CREATE INDEX infra_layer_buffer_stop_schematic_id ON infra_layer_buffer_stop USING gist (schematic);


-- infra_layer_catenary definition

-- Drop table

-- DROP TABLE infra_layer_catenary;

CREATE TABLE infra_layer_catenary (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(multilinestring, 3857) NOT NULL,
	schematic geometry(multilinestring, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_catenary_geographic ON infra_layer_catenary USING gist (geographic);
CREATE INDEX infra_layer_catenary_schematic ON infra_layer_catenary USING gist (schematic);


-- infra_layer_detector definition

-- Drop table

-- DROP TABLE infra_layer_detector;

CREATE TABLE infra_layer_detector (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(point, 3857) NOT NULL,
	schematic geometry(point, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_detector_geographic ON infra_layer_detector USING gist (geographic);
CREATE INDEX infra_layer_detector_schematic ON infra_layer_detector USING gist (schematic);


-- infra_layer_error definition

-- Drop table

-- DROP TABLE infra_layer_error;

CREATE TABLE infra_layer_error (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	geographic geometry(geometry, 3857) NULL,
	schematic geometry(geometry, 3857) NULL,
	information jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE
);
CREATE INDEX infra_layer_error_geographic ON infra_layer_error USING gist (geographic);
CREATE INDEX infra_layer_error_schematic ON infra_layer_error USING gist (schematic);


-- infra_layer_lpv_panel definition

-- Drop table

-- DROP TABLE infra_layer_lpv_panel;

CREATE TABLE infra_layer_lpv_panel (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(point, 3857) NOT NULL,
	schematic geometry(point, 3857) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE
);
CREATE INDEX infra_layer_lpv_panel_geographic ON infra_layer_lpv_panel USING gist (geographic);
CREATE INDEX infra_layer_lpv_panel_schematic ON infra_layer_lpv_panel USING gist (schematic);


-- infra_layer_neutral_section definition

-- Drop table

-- DROP TABLE infra_layer_neutral_section;

CREATE TABLE infra_layer_neutral_section (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(multilinestring, 3857) NOT NULL,
	schematic geometry(multilinestring, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_neutral_section_geographic ON infra_layer_neutral_section USING gist (geographic);
CREATE INDEX infra_layer_neutral_section_infra_id ON infra_layer_neutral_section USING btree (infra_id);
CREATE INDEX infra_layer_neutral_section_schematic ON infra_layer_neutral_section USING gist (schematic);


-- infra_layer_operational_point definition

-- Drop table

-- DROP TABLE infra_layer_operational_point;

CREATE TABLE infra_layer_operational_point (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(multipoint, 3857) NOT NULL,
	schematic geometry(multipoint, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_operational_point_geographic ON infra_layer_operational_point USING gist (geographic);
CREATE INDEX infra_layer_operational_point_schematic ON infra_layer_operational_point USING gist (schematic);


-- infra_layer_signal definition

-- Drop table

-- DROP TABLE infra_layer_signal;

CREATE TABLE infra_layer_signal (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(point, 3857) NOT NULL,
	schematic geometry(point, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	angle_geo float8 NOT NULL,
	angle_sch float8 NOT NULL,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_signal_geographic ON infra_layer_signal USING gist (geographic);
CREATE INDEX infra_layer_signal_schematic ON infra_layer_signal USING gist (schematic);


-- infra_layer_speed_section definition

-- Drop table

-- DROP TABLE infra_layer_speed_section;

CREATE TABLE infra_layer_speed_section (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(multilinestring, 3857) NOT NULL,
	schematic geometry(multilinestring, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_speed_section_geographic ON infra_layer_speed_section USING gist (geographic);
CREATE INDEX infra_layer_speed_section_schematic ON infra_layer_speed_section USING gist (schematic);


-- infra_layer_switch definition

-- Drop table

-- DROP TABLE infra_layer_switch;

CREATE TABLE infra_layer_switch (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(point, 3857) NOT NULL,
	schematic geometry(point, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_switch_geographic ON infra_layer_switch USING gist (geographic);
CREATE INDEX infra_layer_switch_schematic ON infra_layer_switch USING gist (schematic);


-- infra_layer_track_section definition

-- Drop table

-- DROP TABLE infra_layer_track_section;

CREATE TABLE infra_layer_track_section (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(linestring, 3857) NOT NULL,
	schematic geometry(linestring, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX idx_infra_layer_track_section_infra_id ON infra_layer_track_section USING btree (infra_id);
CREATE INDEX idx_infra_layer_track_section_obj_id ON infra_layer_track_section USING btree (obj_id);
CREATE INDEX infra_layer_track_section_geographic ON infra_layer_track_section USING gist (geographic);
CREATE INDEX infra_layer_track_section_schematic ON infra_layer_track_section USING gist (schematic);


-- infra_layer_track_section_link definition

-- Drop table

-- DROP TABLE infra_layer_track_section_link;

CREATE TABLE infra_layer_track_section_link (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	geographic geometry(point, 3857) NOT NULL,
	schematic geometry(point, 3857) NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX infra_layer_track_section_link_geographic ON infra_layer_track_section_link USING gist (geographic);
CREATE INDEX infra_layer_track_section_link_schematic ON infra_layer_track_section_link USING gist (schematic);


-- infra_object_buffer_stop definition

-- Drop table

-- DROP TABLE infra_object_buffer_stop;

CREATE TABLE infra_object_buffer_stop (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_catenary definition

-- Drop table

-- DROP TABLE infra_object_catenary;

CREATE TABLE infra_object_catenary (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_detector definition

-- Drop table

-- DROP TABLE infra_object_detector;

CREATE TABLE infra_object_detector (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_neutral_section definition

-- Drop table

-- DROP TABLE infra_object_neutral_section;

CREATE TABLE infra_object_neutral_section (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_operational_point definition

-- Drop table

-- DROP TABLE infra_object_operational_point;

CREATE TABLE infra_object_operational_point (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);

-- Table Triggers

create trigger search_operationalpoint__ins_trig after
insert
    on
    infra_object_operational_point for each row execute function search_operationalpoint__ins_trig_fun();
create trigger search_operationalpoint__upd_trig after
update
    on
    infra_object_operational_point for each row execute function search_operationalpoint__upd_trig_fun();


-- infra_object_route definition

-- Drop table

-- DROP TABLE infra_object_route;

CREATE TABLE infra_object_route (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_signal definition

-- Drop table

-- DROP TABLE infra_object_signal;

CREATE TABLE infra_object_signal (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);

-- Table Triggers

create trigger search_signal__ins_trig after
insert
    on
    infra_object_signal for each row execute function search_signal__ins_trig_fun();
create trigger search_signal__upd_trig after
update
    on
    infra_object_signal for each row execute function search_signal__upd_trig_fun();


-- infra_object_speed_section definition

-- Drop table

-- DROP TABLE infra_object_speed_section;

CREATE TABLE infra_object_speed_section (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_switch definition

-- Drop table

-- DROP TABLE infra_object_switch;

CREATE TABLE infra_object_switch (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_switch_type definition

-- Drop table

-- DROP TABLE infra_object_switch_type;

CREATE TABLE infra_object_switch_type (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- infra_object_track_section definition

-- Drop table

-- DROP TABLE infra_object_track_section;

CREATE TABLE infra_object_track_section (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);
CREATE INDEX idx_infra_object_track_section_infra_id ON infra_object_track_section USING btree (infra_id);
CREATE INDEX idx_infra_object_track_section_line_code ON infra_object_track_section USING btree ((((data #>> '{extensions,sncf,line_code}'::text[]))::integer));

-- Table Triggers

create trigger search_track__del_trig after
delete
    on
    infra_object_track_section for each row execute function search_track__del_trig_fun();
create trigger search_track__ins_trig after
insert
    on
    infra_object_track_section for each row execute function search_track__ins_trig_fun();
create trigger search_track__upd_trig after
update
    on
    infra_object_track_section for each row execute function search_track__upd_trig_fun();


-- infra_object_track_section_link definition

-- Drop table

-- DROP TABLE infra_object_track_section_link;

CREATE TABLE infra_object_track_section_link (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	obj_id varchar(255) NOT NULL,
	data jsonb NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE,
	UNIQUE (infra_id, obj_id)
);


-- pathfinding definition

-- Drop table

-- DROP TABLE pathfinding;

CREATE TABLE pathfinding (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	"owner" uuid NOT NULL,
	created timestamptz NOT NULL,
	payload jsonb NOT NULL,
	slopes jsonb NOT NULL,
	curves jsonb NOT NULL,
	geographic geometry(linestring, 4326) NOT NULL,
	schematic geometry(linestring, 4326) NOT NULL,
	infra_id int8 NOT NULL,
	length float8 NOT NULL,
	CONSTRAINT pathfinding_fkey FOREIGN KEY (infra_id) REFERENCES infra(id) ON DELETE CASCADE
);


-- project definition

-- Drop table

-- DROP TABLE project;

CREATE TABLE project (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	name varchar(128) NOT NULL,
	objectives varchar(4096) NOT NULL,
	description varchar(1024) NOT NULL,
	funders varchar(255) NOT NULL,
	budget int4 NOT NULL,
	creation_date timestamptz NOT NULL,
	last_modification timestamptz NOT NULL,
	tags text[] NOT NULL,
	image_id int8 NULL UNIQUE REFERENCES document(id) DEFERRABLE INITIALLY DEFERRED
);

-- Table Triggers

create trigger search_project__ins_trig after
insert
    on
    project for each row execute function search_project__ins_trig_fun();
create trigger search_project__upd_trig after
update
    on
    project for each row execute function search_project__upd_trig_fun();


-- rolling_stock_livery definition

-- Drop table

-- DROP TABLE rolling_stock_livery;

CREATE TABLE rolling_stock_livery (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	name varchar(255) NOT NULL,
	rolling_stock_id int8 NOT NULL REFERENCES rolling_stock(id) ON DELETE CASCADE,
	compound_image_id int8 NULL UNIQUE REFERENCES "document"(id) ON DELETE SET NULL,
	UNIQUE (rolling_stock_id, name)
);


-- rolling_stock_separate_image definition

-- Drop table

-- DROP TABLE rolling_stock_separate_image;

CREATE TABLE rolling_stock_separate_image (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	"order" int4 NOT NULL DEFAULT 0,
	livery_id int8 NOT NULL REFERENCES rolling_stock_livery(id) ON DELETE CASCADE,
	image_id int8 NOT NULL UNIQUE REFERENCES document(id) ON DELETE CASCADE,
	UNIQUE (livery_id, "order")
);


-- search_operational_point definition

-- Drop table

-- DROP TABLE search_operational_point;

CREATE TABLE search_operational_point (
	id int8 NOT NULL PRIMARY KEY REFERENCES infra_object_operational_point(id) ON DELETE CASCADE ON UPDATE CASCADE,
	name text NULL,
	infra_id int4 NULL,
	obj_id varchar(255) NULL,
	uic int4 NULL,
	ch text NULL,
	trigram varchar(3) NULL
);
CREATE INDEX idx_gin_search_operationalpoint_name ON search_operational_point USING gin (name gin_trgm_ops);


-- search_project definition

-- Drop table

-- DROP TABLE search_project;

CREATE TABLE search_project (
	id int8 NOT NULL PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE ON UPDATE CASCADE,
	name text NULL,
	description text NULL,
	tags text NULL
);
CREATE INDEX idx_gin_search_project_description ON search_project USING gin (description gin_trgm_ops);
CREATE INDEX idx_gin_search_project_name ON search_project USING gin (name gin_trgm_ops);


-- search_signal definition

-- Drop table

-- DROP TABLE search_signal;

CREATE TABLE search_signal (
	id int8 NOT NULL PRIMARY KEY REFERENCES infra_object_signal(id) ON DELETE CASCADE ON UPDATE CASCADE,
	"label" text NULL,
	line_name text NULL,
	infra_id int4 NULL,
	obj_id varchar(255) NULL,
	aspects text[] NULL,
	systems text[] NULL,
	line_code int4 NULL
);
CREATE INDEX idx_gin_search_signal_label ON search_signal USING gin (label gin_trgm_ops);
CREATE INDEX idx_gin_search_signal_line_name ON search_signal USING gin (line_name gin_trgm_ops);
CREATE INDEX search_signal_infra_id_line_code_idx ON search_signal USING btree (infra_id, line_code) INCLUDE (label, aspects);


-- study definition

-- Drop table

-- DROP TABLE study;

CREATE TABLE study (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	name varchar(128) NOT NULL,
	description varchar(1024) NOT NULL,
	business_code varchar(128) NOT NULL,
	service_code varchar(128) NOT NULL,
	creation_date timestamptz NOT NULL,
	last_modification timestamptz NOT NULL,
	start_date date NULL,
	expected_end_date date NULL,
	actual_end_date date NULL,
	budget int4 NOT NULL,
	tags text[] NOT NULL,
	state varchar(16) NOT NULL,
	study_type varchar(100) NOT NULL,
	project_id int8 NOT NULL REFERENCES project(id) ON DELETE CASCADE
);

-- Table Triggers

create trigger search_study__ins_trig after
insert
    on
    study for each row execute function search_study__ins_trig_fun();
create trigger search_study__upd_trig after
update
    on
    study for each row execute function search_study__upd_trig_fun();


-- train_schedule definition

-- Drop table

-- DROP TABLE train_schedule;

CREATE TABLE train_schedule (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	train_name varchar(128) NOT NULL,
	labels jsonb NOT NULL,
	departure_time float8 NOT NULL,
	initial_speed float8 NOT NULL,
	allowances jsonb NOT NULL,
	comfort varchar(8) NOT NULL,
	speed_limit_tags varchar(128) NULL,
	power_restriction_ranges jsonb NULL,
	options jsonb NULL,
	path_id int8 NOT NULL REFERENCES pathfinding(id) ON DELETE CASCADE,
	rolling_stock_id int8 NOT NULL REFERENCES rolling_stock(id) ON DELETE CASCADE,
	timetable_id int8 NOT NULL REFERENCES timetable(id) ON DELETE CASCADE,
	scheduled_points jsonb NOT NULL,
	infra_version varchar(40) NOT NULL,
	rollingstock_version int8 NOT NULL
);


-- scenario definition

-- Drop table

-- DROP TABLE scenario;

CREATE TABLE scenario (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	name varchar(128) NOT NULL,
	description varchar(1024) NOT NULL,
	creation_date timestamptz NOT NULL,
	last_modification timestamptz NOT NULL,
	tags text[] NOT NULL,
	infra_id int8 NOT NULL REFERENCES infra(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
	timetable_id int8 NOT NULL UNIQUE REFERENCES timetable(id) DEFERRABLE INITIALLY DEFERRED,
	study_id int8 NOT NULL REFERENCES study(id) ON DELETE CASCADE,
	electrical_profile_set_id int8 NULL REFERENCES electrical_profile_set(id) ON DELETE CASCADE
);
CREATE INDEX scenario_infra_id ON scenario USING btree (infra_id);

-- Table Triggers

create trigger search_scenario__ins_trig after
insert
    on
    scenario for each row execute function search_scenario__ins_trig_fun();
create trigger search_scenario__upd_trig after
update
    on
    scenario for each row execute function search_scenario__upd_trig_fun();


-- search_scenario definition

-- Drop table

-- DROP TABLE search_scenario;

CREATE TABLE search_scenario (
	id int8 NOT NULL PRIMARY KEY REFERENCES scenario(id) ON DELETE CASCADE ON UPDATE CASCADE,
	name text NULL,
	description text NULL,
	study_id int4 NULL,
	tags text NULL
);
CREATE INDEX idx_gin_search_scenario_description ON search_scenario USING gin (description gin_trgm_ops);
CREATE INDEX idx_gin_search_scenario_name ON search_scenario USING gin (name gin_trgm_ops);


-- search_study definition

-- Drop table

-- DROP TABLE search_study;

CREATE TABLE search_study (
	id int8 NOT NULL PRIMARY KEY REFERENCES study(id) ON DELETE CASCADE ON UPDATE CASCADE,
	name text NULL,
	description text NULL,
	project_id int4 NULL,
	tags text NULL
);
CREATE INDEX idx_gin_search_study_description ON search_study USING gin (description gin_trgm_ops);
CREATE INDEX idx_gin_search_study_name ON search_study USING gin (name gin_trgm_ops);


-- simulation_output definition

-- Drop table

-- DROP TABLE simulation_output;

CREATE TABLE simulation_output (
	id int8 PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
	mrsp jsonb NOT NULL,
	base_simulation jsonb NOT NULL,
	eco_simulation jsonb NULL,
	electrification_ranges jsonb NOT NULL,
	train_schedule_id int8 NULL UNIQUE REFERENCES train_schedule(id) ON DELETE CASCADE,
	power_restriction_ranges jsonb NOT NULL
);
