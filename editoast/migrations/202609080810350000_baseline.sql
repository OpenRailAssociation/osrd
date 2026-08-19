--
-- PostgreSQL database dump
--

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: timetable_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.timetable_type AS ENUM (
    'CALENDAR',
    'HOURLY'
);


--
-- Name: train_main_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.train_main_category AS ENUM (
    'HIGH_SPEED_TRAIN',
    'INTERCITY_TRAIN',
    'REGIONAL_TRAIN',
    'NIGHT_TRAIN',
    'COMMUTER_TRAIN',
    'FREIGHT_TRAIN',
    'FAST_FREIGHT_TRAIN',
    'TRAM_TRAIN',
    'TOURISTIC_TRAIN',
    'WORK_TRAIN'
);


--
-- Name: check_add_only_paced_in_hourly_train_schedule_set(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_add_only_paced_in_hourly_train_schedule_set() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM train_schedule_set
        WHERE train_schedule_set.id = NEW.train_schedule_set_id
        AND train_schedule_set.timetable_type = 'HOURLY'
    ) THEN
        -- Check if a unique train is inserted or updated in an HOURLY train_schedule_set
        IF NEW.time_window IS NULL OR NEW.interval IS NULL THEN
            RAISE EXCEPTION 'Cannot insert or update train_schedule with NULL time_window or interval for HOURLY timetable_type in train_schedule_set';
        END IF;
        IF NOT (0 <= NEW.start_time AND NEW.start_time * INTERVAL '1 millisecond' < NEW.interval AND NEW.interval <= NEW.time_window) THEN
            RAISE EXCEPTION 'Invalid paced train_schedule: start_time=% must be >= 0 and < interval=%, interval must be <= time_window=%',
                NEW.start_time,
                NEW.interval,
                NEW.time_window;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_authn_user_identity_update_does_not_leave_user_without_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_authn_user_identity_update_does_not_leave_user_without_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if not exists (
        select * from authn_user_identity
        where user_id = old.user_id
    ) then
        raise exception 'Updating the user associated with an identity would leave its prior user without any identity';
    end if;
    return old;
end;
$$;


--
-- Name: check_search_journey_environment_timetable_type_is_calendar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_search_journey_environment_timetable_type_is_calendar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE timetable.id = NEW.timetable_id
            AND timetable.timetable_type != 'CALENDAR'
    )
    THEN
        RAISE EXCEPTION 'Cannot insert or update search_journey_environment_timetable with non calendar timetable_type in timetable';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_stdcm_search_environment_timetable_type_is_calendar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_stdcm_search_environment_timetable_type_is_calendar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE timetable.id = NEW.timetable_id
            AND timetable.timetable_type != 'CALENDAR'
    )
    THEN
        RAISE EXCEPTION 'Cannot insert or update stdcm_search_environment with non calendar timetable_type in timetable';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_timetable_and_train_schedule_set_same_type(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_timetable_and_train_schedule_set_same_type() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM timetable, train_schedule_set
        WHERE timetable.id = NEW.timetable_id
            AND train_schedule_set.id = NEW.train_schedule_set_id
            AND timetable.timetable_type != train_schedule_set.timetable_type
    )
    THEN
        RAISE EXCEPTION 'Cannot insert or update timetable_train_schedule_set with mismatched timetable and train_schedule_set types';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_timetable_type_is_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_timetable_type_is_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.timetable_type IS DISTINCT FROM OLD.timetable_type THEN
        RAISE EXCEPTION 'Cannot change timetable_type on timetable';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_train_schedule_set_timetable_type_is_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_train_schedule_set_timetable_type_is_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.timetable_type IS DISTINCT FROM OLD.timetable_type THEN
        RAISE EXCEPTION 'Cannot change timetable_type on train_schedule_set';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_user_has_at_least_one_identity_after_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_has_at_least_one_identity_after_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if not (
        select count(*) > 0
        from authn_user_identity
        where user_id = new.id
    ) then
        raise exception 'Inserting user with no associated identity';
    end if;
    return old;
end;
$$;


--
-- Name: delete_associated_authn_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_associated_authn_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if not exists (
        select *
        from authn_user
        inner join authn_user_identity on authn_user.id = authn_user_identity.user_id
        where authn_user.id = old.user_id
    ) then
        delete from authn_user where id = old.user_id;
    end if;
    return old;
end;
$$;


--
-- Name: diesel_manage_updated_at(regclass); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.diesel_manage_updated_at(_tbl regclass) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s
                    FOR EACH ROW EXECUTE PROCEDURE diesel_set_updated_at()', _tbl);
END;
$$;


--
-- Name: diesel_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.diesel_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (
        NEW IS DISTINCT FROM OLD AND
        NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at
    ) THEN
        NEW.updated_at := current_timestamp;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: op_add_type(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.op_add_type(path jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN COALESCE(
                    elem->'location'->'operational_point',
                    '{}'::jsonb
                ) ? 'uic' THEN jsonb_set(
                    elem,
                    '{location,operational_point,type}',
                    '"uic"'::jsonb,
                    true
                )
                WHEN COALESCE(
                    elem->'location'->'operational_point',
                    '{}'::jsonb
                ) ? 'trigram' THEN jsonb_set(
                    elem,
                    '{location,operational_point,type}',
                    '"trigram"'::jsonb,
                    true
                )
                WHEN COALESCE(
                    elem->'location'->'operational_point',
                    '{}'::jsonb
                ) ? 'operational_point' THEN jsonb_set(
                    elem,
                    '{location,operational_point,type}',
                    '"id"'::jsonb,
                    true
                )
                ELSE elem
            END
        ),
        '[]'::jsonb
    )
FROM jsonb_array_elements(COALESCE(path, '[]'::jsonb)) AS elem;
$$;


--
-- Name: osrd_prepare_for_search(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.osrd_prepare_for_search(input_text text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
SELECT array_to_string(
        tsvector_to_array(
            to_tsvector('simple', unaccent(coalesce(input_text, '')))
        ),
        E'\n'
    ) $$;


--
-- Name: osrd_prepare_for_search_tags(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.osrd_prepare_for_search_tags(tags text[]) RETURNS text
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    AS $$
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
$$;


--
-- Name: osrd_to_ilike_search(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.osrd_to_ilike_search(query text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
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
    ) || '%' $$;


--
-- Name: search_operational_point__ins_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_operational_point__ins_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO "search_operational_point" (id, obj_id, infra_id, uic, main_code, secondary_code, name, is_passenger_station, secondary_name, country_code)
        SELECT "infra_object_operational_point".id AS id, (infra_object_operational_point.obj_id) AS obj_id,
    (infra_object_operational_point.infra_id) AS infra_id,
    ((infra_object_operational_point.data->>'uic')::integer) AS uic,
    (infra_object_operational_point.data->>'main_code') AS main_code,
    (infra_object_operational_point.data->>'secondary_code') AS secondary_code,
    osrd_prepare_for_search(infra_object_operational_point.data->>'name') AS name,
    ((infra_object_operational_point.data->>'is_passenger_station')::boolean) AS is_passenger_station,
    (infra_object_operational_point.data->>'secondary_name') AS secondary_name,
    (infra_object_operational_point.data->>'country_code') AS country_code
        FROM (SELECT NEW.*) AS "infra_object_operational_point"
        ;
    RETURN NEW;
END;
$$;


--
-- Name: search_operational_point__upd_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_operational_point__upd_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE "search_operational_point"
        SET "obj_id" = (infra_object_operational_point.obj_id),
        "infra_id" = (infra_object_operational_point.infra_id),
        "uic" = ((infra_object_operational_point.data->>'uic')::integer),
        "main_code" = (infra_object_operational_point.data->>'main_code'),
        "secondary_code" = (infra_object_operational_point.data->>'secondary_code'),
        "name" = osrd_prepare_for_search(infra_object_operational_point.data->>'name'),
        "is_passenger_station" = ((infra_object_operational_point.data->>'is_passenger_station')::boolean),
        "secondary_name" = (infra_object_operational_point.data->>'secondary_name'),
        "country_code" = (infra_object_operational_point.data->>'country_code')
        FROM (SELECT NEW.*) AS "infra_object_operational_point"
        
        WHERE "infra_object_operational_point".id = "search_operational_point".id;
    RETURN NEW;
END;
$$;


--
-- Name: search_project__ins_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_project__ins_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
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
$$;


--
-- Name: search_project__upd_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_project__upd_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
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
$$;


--
-- Name: search_scenario__ins_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_scenario__ins_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO "search_scenario" (id, name, description, tags, study_id)
        SELECT "scenario".id AS id, osrd_prepare_for_search(scenario.name) AS name,
    osrd_prepare_for_search(scenario.description) AS description,
    (osrd_prepare_for_search_tags(scenario.tags)) AS tags,
    (scenario.study_id) AS study_id
        FROM (SELECT NEW.*) AS "scenario"
        ;
    RETURN NEW;
END;
$$;


--
-- Name: search_scenario__upd_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_scenario__upd_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE "search_scenario"
        SET "name" = osrd_prepare_for_search(scenario.name),
        "description" = osrd_prepare_for_search(scenario.description),
        "tags" = (osrd_prepare_for_search_tags(scenario.tags)),
        "study_id" = (scenario.study_id)
        FROM (SELECT NEW.*) AS "scenario"
        
        WHERE "scenario".id = "search_scenario".id;
    RETURN NEW;
END;
$$;


--
-- Name: search_signal__ins_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_signal__ins_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
    INSERT INTO "search_signal" (id, label, line_name, infra_id, obj_id, signaling_systems, settings, line_code)
        SELECT "infra_object_signal".id AS id, osrd_prepare_for_search(infra_object_signal.data->'extensions'->'sncf'->>'label') AS label,
    osrd_prepare_for_search(track_section.data->'extensions'->'sncf'->>'line_name') AS line_name,
    (infra_object_signal.infra_id) AS infra_id,
    (infra_object_signal.obj_id) AS obj_id,
    (ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].signaling_system')->>0)) AS signaling_systems,
    (ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].settings.keyvalue().key')->>0)) AS settings,
    ((track_section.data->'extensions'->'sncf'->>'line_code')::integer) AS line_code
        FROM (SELECT NEW.*) AS "infra_object_signal"
        
            INNER JOIN infra_object_track_section AS track_section
            ON track_section.infra_id = infra_object_signal.infra_id
                AND track_section.obj_id = infra_object_signal.data->>'track';
    RETURN NEW;
END;
$_$;


--
-- Name: search_signal__upd_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_signal__upd_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
    UPDATE "search_signal"
        SET "label" = osrd_prepare_for_search(infra_object_signal.data->'extensions'->'sncf'->>'label'),
        "line_name" = osrd_prepare_for_search(track_section.data->'extensions'->'sncf'->>'line_name'),
        "infra_id" = (infra_object_signal.infra_id),
        "obj_id" = (infra_object_signal.obj_id),
        "signaling_systems" = (ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].signaling_system')->>0)),
        "settings" = (ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].settings.keyvalue().key')->>0)),
        "line_code" = ((track_section.data->'extensions'->'sncf'->>'line_code')::integer)
        FROM (SELECT NEW.*) AS "infra_object_signal"
        
            INNER JOIN infra_object_track_section AS track_section
            ON track_section.infra_id = infra_object_signal.infra_id
                AND track_section.obj_id = infra_object_signal.data->>'track'
        WHERE "infra_object_signal".id = "search_signal".id;
    RETURN NEW;
END;
$_$;


--
-- Name: search_study__ins_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_study__ins_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
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
$$;


--
-- Name: search_study__upd_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_study__upd_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
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
$$;


--
-- Name: search_track__del_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_track__del_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
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
$$;


--
-- Name: search_track__ins_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_track__ins_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF NEW."data"#>>'{extensions,sncf,line_code}' IS NULL
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
$$;


--
-- Name: search_track__upd_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_track__upd_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN -- line_code or infra_id may have been changed which would create a new track
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
$$;


--
-- Name: search_user__ins_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_user__ins_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO "search_user" (id, name)
        SELECT "authn_user".id AS id, osrd_prepare_for_search(authn_user.name) AS name
        FROM (SELECT NEW.*) AS "authn_user"
        ;
    RETURN NEW;
END;
$$;


--
-- Name: search_user__upd_trig_fun(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_user__upd_trig_fun() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE "search_user"
        SET "name" = osrd_prepare_for_search(authn_user.name)
        FROM (SELECT NEW.*) AS "authn_user"
        
        WHERE "authn_user".id = "search_user".id;
    RETURN NEW;
END;
$$;


--
-- Name: tilebbox(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tilebbox(z integer, x integer, y integer, srid integer DEFAULT 3857) RETURNS public.geometry
    LANGUAGE plpgsql IMMUTABLE
    AS $$
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
$$;


--
-- Name: authn_subject_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.authn_subject_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: authn_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authn_group (
    id bigint DEFAULT nextval('public.authn_subject_id_seq'::regclass) NOT NULL,
    name text NOT NULL
);


--
-- Name: authn_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authn_user (
    id bigint DEFAULT nextval('public.authn_subject_id_seq'::regclass) NOT NULL,
    name text NOT NULL
);


--
-- Name: authn_user_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authn_user_identity (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    identity text NOT NULL
);


--
-- Name: authn_user_identity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.authn_user_identity ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.authn_user_identity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: catalog_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_entry (
    id bigint NOT NULL,
    name character varying(255)
);


--
-- Name: catalog_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.catalog_entry ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.catalog_entry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    id bigint NOT NULL,
    content_type character varying(255) NOT NULL,
    data bytea NOT NULL
);


--
-- Name: document_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.document ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.document_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: electrical_profile_set; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.electrical_profile_set (
    id bigint NOT NULL,
    name character varying(128) NOT NULL,
    data jsonb NOT NULL
);


--
-- Name: electrical_profile_set_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.electrical_profile_set ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.electrical_profile_set_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra (
    id bigint NOT NULL,
    name character varying(128) NOT NULL,
    railjson_version character varying(16) DEFAULT '3.4.12'::character varying NOT NULL,
    owner uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    generated_version bigint,
    locked boolean DEFAULT false NOT NULL,
    created timestamp with time zone DEFAULT now() NOT NULL,
    modified timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: infra_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_buffer_stop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_buffer_stop (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(Point,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_buffer_stop_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_buffer_stop ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_buffer_stop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_electrification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_electrification (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(MultiLineString,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_catenary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_electrification ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_catenary_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_detector; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_detector (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(Point,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_detector_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_detector ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_detector_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_error; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_error (
    id bigint NOT NULL,
    geographic public.geometry(Geometry,3857),
    information jsonb NOT NULL,
    infra_id bigint NOT NULL,
    info_hash character varying(40) DEFAULT 'undefined'::character varying NOT NULL
);


--
-- Name: infra_layer_error_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_error ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_error_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_level_crossing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_level_crossing (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(MultiPoint,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_level_crossing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_level_crossing ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_level_crossing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_psl_sign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_psl_sign (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(Point,3857) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL,
    angle_geo double precision DEFAULT 0
);


--
-- Name: infra_layer_lpv_panel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_psl_sign ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_lpv_panel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_neutral_section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_neutral_section (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(MultiLineString,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_neutral_section_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_neutral_section ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_neutral_section_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_neutral_sign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_neutral_sign (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(Point,3857) NOT NULL,
    angle_geo double precision NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_neutral_sign_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_neutral_sign ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_neutral_sign_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_operational_point; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_operational_point (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(Point,3857) NOT NULL,
    infra_id bigint NOT NULL,
    kp text,
    track_section text NOT NULL,
    part_index bigint NOT NULL
);


--
-- Name: infra_layer_operational_point_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_operational_point ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_operational_point_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_signal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_signal (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(Point,3857) NOT NULL,
    infra_id bigint NOT NULL,
    angle_geo double precision NOT NULL,
    signaling_system character varying(255),
    sprite character varying(255)
);


--
-- Name: infra_layer_signal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_signal ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_signal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_speed_section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_speed_section (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(MultiLineString,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_speed_section_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_speed_section ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_speed_section_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_switch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_switch (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(Point,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_switch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_switch ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_switch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_layer_track_section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_layer_track_section (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    geographic public.geometry(LineString,3857) NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_layer_track_section_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_layer_track_section ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_layer_track_section_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_buffer_stop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_buffer_stop (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_buffer_stop_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_buffer_stop ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_buffer_stop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_electrification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_electrification (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_catenary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_electrification ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_catenary_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_detector; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_detector (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_detector_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_detector ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_detector_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_extended_switch_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_extended_switch_type (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_level_crossing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_level_crossing (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_level_crossing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_level_crossing ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_level_crossing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_neutral_section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_neutral_section (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_neutral_section_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_neutral_section ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_neutral_section_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_operational_point; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_operational_point (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL,
    CONSTRAINT check_main_code_not_empty CHECK ((((data ->> 'main_code'::text) IS NOT NULL) AND ((data ->> 'main_code'::text) <> ''::text))),
    CONSTRAINT check_secondary_code_not_empty CHECK ((((data ->> 'secondary_code'::text) IS NULL) OR ((data ->> 'secondary_code'::text) <> ''::text))),
    CONSTRAINT check_secondary_name_not_empty CHECK ((((data ->> 'secondary_name'::text) IS NULL) OR ((data ->> 'secondary_name'::text) <> ''::text)))
);


--
-- Name: infra_object_operational_point_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_operational_point ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_operational_point_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_route; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_route (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_route_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_route ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_route_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_signal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_signal (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_signal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_signal ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_signal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_speed_section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_speed_section (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_speed_section_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_speed_section ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_speed_section_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_switch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_switch (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_switch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_switch ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_switch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_switch_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_extended_switch_type ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_switch_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: infra_object_track_section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_object_track_section (
    id bigint NOT NULL,
    obj_id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: infra_object_track_section_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.infra_object_track_section ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.infra_object_track_section_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: macro_node; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.macro_node (
    id bigint NOT NULL,
    scenario_id bigint NOT NULL,
    position_x bigint NOT NULL,
    position_y bigint NOT NULL,
    full_name character varying(255),
    labels text[] NOT NULL,
    trigram character varying(255),
    path_item_key character varying(255) NOT NULL,
    is_collapsed boolean DEFAULT false NOT NULL
);


--
-- Name: macro_node_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.macro_node ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.macro_node_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: macro_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.macro_note (
    id bigint NOT NULL,
    scenario_id bigint NOT NULL,
    x bigint NOT NULL,
    y bigint NOT NULL,
    title text NOT NULL,
    text text NOT NULL,
    labels text[] NOT NULL
);


--
-- Name: macro_note_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.macro_note ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.macro_note_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: train_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.train_schedule (
    id bigint NOT NULL,
    train_name character varying(128) NOT NULL,
    labels text[] NOT NULL,
    rolling_stock_name character varying(128) NOT NULL,
    start_time bigint NOT NULL,
    schedule jsonb NOT NULL,
    margins jsonb NOT NULL,
    initial_speed double precision NOT NULL,
    comfort smallint NOT NULL,
    path jsonb NOT NULL,
    constraint_distribution smallint NOT NULL,
    speed_limit_tag character varying(128),
    power_restrictions jsonb NOT NULL,
    options jsonb NOT NULL,
    time_window interval,
    "interval" interval,
    main_category public.train_main_category,
    sub_category character varying(255),
    train_schedule_set_id bigint NOT NULL,
    CONSTRAINT non_zero_paced CHECK ((("interval" > '00:00:00'::interval) AND (time_window > '00:00:00'::interval))),
    CONSTRAINT only_one_category CHECK (((sub_category IS NULL) OR (main_category IS NULL)))
);


--
-- Name: paced_train_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.train_schedule ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.paced_train_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: train_schedule_round_trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.train_schedule_round_trips (
    id bigint NOT NULL,
    left_id bigint NOT NULL,
    right_id bigint,
    CONSTRAINT id_order CHECK (((right_id IS NULL) OR (left_id < right_id)))
);


--
-- Name: paced_train_round_trips_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.train_schedule_round_trips ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.paced_train_round_trips_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id bigint NOT NULL,
    name character varying(128) NOT NULL,
    objectives character varying(4096) DEFAULT ''::character varying,
    description character varying(1024) DEFAULT ''::character varying,
    funders character varying(255) DEFAULT ''::character varying,
    budget integer,
    creation_date timestamp with time zone NOT NULL,
    last_modification timestamp with time zone NOT NULL,
    tags text[] NOT NULL,
    image_id bigint
);


--
-- Name: project_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.project ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.project_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rolling_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rolling_stock (
    id bigint NOT NULL,
    railjson_version character varying(16) NOT NULL,
    name character varying(255) NOT NULL,
    effort_curves jsonb NOT NULL,
    metadata jsonb NOT NULL,
    length double precision NOT NULL,
    max_speed double precision NOT NULL,
    startup_time double precision NOT NULL,
    startup_acceleration double precision NOT NULL,
    comfort_acceleration double precision NOT NULL,
    const_gamma double precision NOT NULL,
    inertia_coefficient double precision NOT NULL,
    base_power_class character varying(255),
    mass double precision NOT NULL,
    rolling_resistance jsonb NOT NULL,
    loading_gauge smallint NOT NULL,
    power_restrictions jsonb DEFAULT '{}'::jsonb NOT NULL,
    energy_sources jsonb NOT NULL,
    locked boolean NOT NULL,
    electrical_power_startup_time double precision,
    raise_pantograph_time double precision,
    version bigint NOT NULL,
    primary_category public.train_main_category DEFAULT 'FREIGHT_TRAIN'::public.train_main_category NOT NULL,
    other_categories public.train_main_category[] DEFAULT '{}'::public.train_main_category[] NOT NULL,
    supported_signaling_systems jsonb NOT NULL,
    CONSTRAINT base_power_class_null_or_non_empty CHECK (((base_power_class IS NULL) OR (length((base_power_class)::text) > 0)))
);


--
-- Name: rolling_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rolling_stock ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rolling_stock_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rolling_stock_livery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rolling_stock_livery (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    rolling_stock_id bigint NOT NULL,
    compound_image_id bigint
);


--
-- Name: rolling_stock_livery_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rolling_stock_livery ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rolling_stock_livery_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rolling_stock_separate_image; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rolling_stock_separate_image (
    id bigint NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    livery_id bigint NOT NULL,
    image_id bigint NOT NULL
);


--
-- Name: rolling_stock_separate_image_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rolling_stock_separate_image ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rolling_stock_separate_image_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: scenario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario (
    id bigint NOT NULL,
    infra_id bigint NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(1024) NOT NULL,
    creation_date timestamp with time zone NOT NULL,
    last_modification timestamp with time zone NOT NULL,
    tags text[] NOT NULL,
    timetable_id bigint NOT NULL,
    study_id bigint NOT NULL,
    electrical_profile_set_id bigint
);


--
-- Name: scenario_v2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.scenario ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.scenario_v2_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: search_journey_environment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_journey_environment (
    id bigint NOT NULL,
    infra_id bigint NOT NULL
);


--
-- Name: search_journey_environment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.search_journey_environment ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.search_journey_environment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: search_journey_environment_timetable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_journey_environment_timetable (
    id bigint NOT NULL,
    search_journey_environment_id bigint NOT NULL,
    timetable_id bigint NOT NULL
);


--
-- Name: search_journey_environment_timetable_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.search_journey_environment_timetable ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.search_journey_environment_timetable_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: search_operational_point; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_operational_point (
    id bigint NOT NULL,
    obj_id character varying(255),
    infra_id integer,
    uic integer,
    main_code character varying(255),
    secondary_code text,
    name text,
    is_passenger_station boolean,
    secondary_name text,
    country_code text
);


--
-- Name: search_project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_project (
    id bigint NOT NULL,
    name text,
    description text,
    tags text
);


--
-- Name: search_scenario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_scenario (
    id bigint NOT NULL,
    name text,
    description text,
    tags text,
    study_id integer
);


--
-- Name: search_signal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_signal (
    id bigint NOT NULL,
    label text,
    line_name text,
    infra_id integer,
    obj_id character varying(255),
    signaling_systems text[],
    settings text[],
    line_code integer
);


--
-- Name: search_study; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_study (
    id bigint NOT NULL,
    name text,
    description text,
    project_id integer,
    tags text
);


--
-- Name: search_track; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_track (
    infra_id integer NOT NULL,
    line_code integer NOT NULL,
    line_name text NOT NULL,
    unprocessed_line_name text NOT NULL,
    id bigint NOT NULL
);


--
-- Name: search_track_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.search_track_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: search_track_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.search_track_id_seq OWNED BY public.search_track.id;


--
-- Name: search_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_user (
    id bigint NOT NULL,
    name text
);


--
-- Name: stdcm_search_environment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stdcm_search_environment (
    id bigint NOT NULL,
    infra_id bigint NOT NULL,
    electrical_profile_set_id bigint,
    work_schedule_group_id bigint,
    timetable_id bigint NOT NULL,
    search_window_begin timestamp with time zone NOT NULL,
    search_window_end timestamp with time zone NOT NULL,
    temporary_speed_limit_group_id bigint,
    enabled_from timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone NOT NULL,
    enabled_until timestamp with time zone DEFAULT '1970-01-02 00:00:00+00'::timestamp with time zone NOT NULL,
    operational_points bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
    speed_limit_tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_speed_limit_tag character varying(25),
    operational_points_id_filtered text[] DEFAULT ARRAY[]::text[] NOT NULL,
    allowed_tracks jsonb DEFAULT 'null'::jsonb NOT NULL,
    CONSTRAINT check_default_speed_limit_tag CHECK (((default_speed_limit_tag IS NULL) OR (speed_limit_tags ? (default_speed_limit_tag)::text)))
);


--
-- Name: stdcm_search_environment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stdcm_search_environment ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.stdcm_search_environment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: study; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study (
    id bigint NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(1024) DEFAULT ''::character varying,
    business_code character varying(128) DEFAULT ''::character varying,
    service_code character varying(128) DEFAULT ''::character varying,
    creation_date timestamp with time zone NOT NULL,
    last_modification timestamp with time zone NOT NULL,
    start_date date,
    expected_end_date date,
    actual_end_date date,
    budget integer,
    tags text[] NOT NULL,
    state character varying(16) NOT NULL,
    study_type character varying(100) DEFAULT ''::character varying,
    project_id bigint NOT NULL
);


--
-- Name: study_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.study ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.study_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sub_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_categories (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    main_category public.train_main_category NOT NULL,
    color character varying(7) NOT NULL,
    background_color character varying(7) NOT NULL,
    hovered_color character varying(7) NOT NULL
);


--
-- Name: sub_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sub_categories ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sub_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: temporary_speed_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_speed_limit (
    id bigint NOT NULL,
    start_date_time timestamp with time zone NOT NULL,
    end_date_time timestamp with time zone NOT NULL,
    speed_limit double precision NOT NULL,
    track_ranges jsonb NOT NULL,
    obj_id character varying(255) NOT NULL,
    temporary_speed_limit_group_id bigint NOT NULL,
    CONSTRAINT valid_time_period CHECK ((start_date_time < end_date_time))
);


--
-- Name: temporary_speed_limit_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_speed_limit_group (
    id bigint NOT NULL,
    creation_date timestamp with time zone NOT NULL,
    name character varying(255) NOT NULL
);


--
-- Name: temporary_speed_limit_group_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.temporary_speed_limit_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.temporary_speed_limit_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: temporary_speed_limit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.temporary_speed_limit ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.temporary_speed_limit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: timetable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timetable (
    id bigint NOT NULL,
    timetable_type public.timetable_type DEFAULT 'CALENDAR'::public.timetable_type NOT NULL
);


--
-- Name: timetable_train_schedule_set; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timetable_train_schedule_set (
    id bigint NOT NULL,
    timetable_id bigint NOT NULL,
    train_schedule_set_id bigint NOT NULL
);


--
-- Name: timetable_train_schedule_set_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.timetable_train_schedule_set ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.timetable_train_schedule_set_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: timetable_v2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.timetable ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.timetable_v2_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: towed_rolling_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.towed_rolling_stock (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    railjson_version character varying(16) NOT NULL,
    locked boolean NOT NULL,
    mass double precision NOT NULL,
    length double precision NOT NULL,
    comfort_acceleration double precision NOT NULL,
    startup_acceleration double precision NOT NULL,
    inertia_coefficient double precision NOT NULL,
    rolling_resistance jsonb NOT NULL,
    const_gamma double precision NOT NULL,
    version bigint NOT NULL,
    label character varying(255) DEFAULT ''::character varying NOT NULL,
    max_speed double precision
);


--
-- Name: towed_rolling_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.towed_rolling_stock ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.towed_rolling_stock_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: train_schedule_exception; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.train_schedule_exception (
    id bigint NOT NULL,
    key text,
    occurrence_index bigint,
    disabled boolean DEFAULT false NOT NULL,
    change_groups jsonb NOT NULL,
    timetable_id bigint NOT NULL,
    train_schedule_id bigint NOT NULL
);


--
-- Name: train_schedule_exception_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.train_schedule_exception ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.train_schedule_exception_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: train_schedule_linking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.train_schedule_linking (
    id bigint NOT NULL,
    timetable_id bigint NOT NULL,
    source_train_schedule_id bigint NOT NULL,
    source_occurrence_index bigint,
    source_added_exception_id bigint,
    source_train_schedule_instance_index bigint,
    target_train_schedule_id bigint NOT NULL,
    target_occurrence_index bigint,
    target_added_exception_id bigint,
    target_train_schedule_instance_index bigint,
    CONSTRAINT train_schedule_linking_check CHECK (((source_occurrence_index IS NULL) OR (source_added_exception_id IS NULL))),
    CONSTRAINT train_schedule_linking_check1 CHECK (((target_occurrence_index IS NULL) OR (target_added_exception_id IS NULL)))
);


--
-- Name: train_schedule_linking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.train_schedule_linking ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.train_schedule_linking_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: train_schedule_set; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.train_schedule_set (
    id bigint NOT NULL,
    catalog_entry_id bigint,
    name character varying(255),
    description text DEFAULT ''::text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    timetable_type public.timetable_type DEFAULT 'CALENDAR'::public.timetable_type NOT NULL,
    CONSTRAINT train_schedule_set_catalog_entry_or_not_published CHECK (((NOT published) OR (catalog_entry_id IS NOT NULL))),
    CONSTRAINT train_schedule_set_name_or_not_catalog_entry CHECK (((catalog_entry_id IS NULL) OR (name IS NOT NULL)))
);


--
-- Name: train_schedule_set_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.train_schedule_set ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.train_schedule_set_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: work_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_schedule (
    id bigint NOT NULL,
    start_date_time timestamp with time zone NOT NULL,
    end_date_time timestamp with time zone NOT NULL,
    track_ranges jsonb NOT NULL,
    obj_id character varying(255) NOT NULL,
    work_schedule_type smallint NOT NULL,
    work_schedule_group_id bigint NOT NULL
);


--
-- Name: work_schedule_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_schedule_group (
    id bigint NOT NULL,
    creation_date timestamp with time zone NOT NULL,
    name character varying(255) NOT NULL
);


--
-- Name: work_schedule_group_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.work_schedule_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.work_schedule_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: work_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.work_schedule ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.work_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: search_track id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_track ALTER COLUMN id SET DEFAULT nextval('public.search_track_id_seq'::regclass);


--
-- Name: authn_group authn_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authn_group
    ADD CONSTRAINT authn_group_pkey PRIMARY KEY (id);


--
-- Name: authn_user_identity authn_user_identity_identity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authn_user_identity
    ADD CONSTRAINT authn_user_identity_identity_key UNIQUE (identity);


--
-- Name: authn_user_identity authn_user_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authn_user_identity
    ADD CONSTRAINT authn_user_identity_pkey PRIMARY KEY (id);


--
-- Name: authn_user authn_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authn_user
    ADD CONSTRAINT authn_user_pkey PRIMARY KEY (id);


--
-- Name: catalog_entry catalog_entry_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_entry
    ADD CONSTRAINT catalog_entry_name_unique UNIQUE (name);


--
-- Name: catalog_entry catalog_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_entry
    ADD CONSTRAINT catalog_entry_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: electrical_profile_set electrical_profile_set_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electrical_profile_set
    ADD CONSTRAINT electrical_profile_set_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_error error_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_error
    ADD CONSTRAINT error_hash_unique UNIQUE (info_hash, infra_id);


--
-- Name: authn_group group_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authn_group
    ADD CONSTRAINT group_name_unique UNIQUE (name);


--
-- Name: train_schedule_exception idx_unique_train_schedule_by_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_exception
    ADD CONSTRAINT idx_unique_train_schedule_by_key UNIQUE (timetable_id, train_schedule_id, key);


--
-- Name: infra_layer_buffer_stop infra_layer_buffer_stop_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_buffer_stop
    ADD CONSTRAINT infra_layer_buffer_stop_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_buffer_stop infra_layer_buffer_stop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_buffer_stop
    ADD CONSTRAINT infra_layer_buffer_stop_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_electrification infra_layer_catenary_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_electrification
    ADD CONSTRAINT infra_layer_catenary_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_electrification infra_layer_catenary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_electrification
    ADD CONSTRAINT infra_layer_catenary_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_detector infra_layer_detector_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_detector
    ADD CONSTRAINT infra_layer_detector_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_detector infra_layer_detector_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_detector
    ADD CONSTRAINT infra_layer_detector_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_error infra_layer_error_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_error
    ADD CONSTRAINT infra_layer_error_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_level_crossing infra_layer_level_crossing_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_level_crossing
    ADD CONSTRAINT infra_layer_level_crossing_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_level_crossing infra_layer_level_crossing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_level_crossing
    ADD CONSTRAINT infra_layer_level_crossing_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_psl_sign infra_layer_lpv_panel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_psl_sign
    ADD CONSTRAINT infra_layer_lpv_panel_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_neutral_section infra_layer_neutral_section_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_neutral_section
    ADD CONSTRAINT infra_layer_neutral_section_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_neutral_section infra_layer_neutral_section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_neutral_section
    ADD CONSTRAINT infra_layer_neutral_section_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_neutral_sign infra_layer_neutral_sign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_neutral_sign
    ADD CONSTRAINT infra_layer_neutral_sign_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_operational_point infra_layer_operational_point_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_operational_point
    ADD CONSTRAINT infra_layer_operational_point_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_signal infra_layer_signal_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_signal
    ADD CONSTRAINT infra_layer_signal_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_signal infra_layer_signal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_signal
    ADD CONSTRAINT infra_layer_signal_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_speed_section infra_layer_speed_section_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_speed_section
    ADD CONSTRAINT infra_layer_speed_section_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_speed_section infra_layer_speed_section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_speed_section
    ADD CONSTRAINT infra_layer_speed_section_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_switch infra_layer_switch_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_switch
    ADD CONSTRAINT infra_layer_switch_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_switch infra_layer_switch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_switch
    ADD CONSTRAINT infra_layer_switch_pkey PRIMARY KEY (id);


--
-- Name: infra_layer_track_section infra_layer_track_section_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_track_section
    ADD CONSTRAINT infra_layer_track_section_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_layer_track_section infra_layer_track_section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_track_section
    ADD CONSTRAINT infra_layer_track_section_pkey PRIMARY KEY (id);


--
-- Name: infra_object_buffer_stop infra_object_buffer_stop_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_buffer_stop
    ADD CONSTRAINT infra_object_buffer_stop_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_buffer_stop infra_object_buffer_stop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_buffer_stop
    ADD CONSTRAINT infra_object_buffer_stop_pkey PRIMARY KEY (id);


--
-- Name: infra_object_electrification infra_object_catenary_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_electrification
    ADD CONSTRAINT infra_object_catenary_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_electrification infra_object_catenary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_electrification
    ADD CONSTRAINT infra_object_catenary_pkey PRIMARY KEY (id);


--
-- Name: infra_object_detector infra_object_detector_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_detector
    ADD CONSTRAINT infra_object_detector_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_detector infra_object_detector_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_detector
    ADD CONSTRAINT infra_object_detector_pkey PRIMARY KEY (id);


--
-- Name: infra_object_level_crossing infra_object_level_crossing_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_level_crossing
    ADD CONSTRAINT infra_object_level_crossing_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_level_crossing infra_object_level_crossing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_level_crossing
    ADD CONSTRAINT infra_object_level_crossing_pkey PRIMARY KEY (id);


--
-- Name: infra_object_neutral_section infra_object_neutral_section_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_neutral_section
    ADD CONSTRAINT infra_object_neutral_section_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_neutral_section infra_object_neutral_section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_neutral_section
    ADD CONSTRAINT infra_object_neutral_section_pkey PRIMARY KEY (id);


--
-- Name: infra_object_operational_point infra_object_operational_point_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_operational_point
    ADD CONSTRAINT infra_object_operational_point_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_operational_point infra_object_operational_point_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_operational_point
    ADD CONSTRAINT infra_object_operational_point_pkey PRIMARY KEY (id);


--
-- Name: infra_object_route infra_object_route_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_route
    ADD CONSTRAINT infra_object_route_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_route infra_object_route_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_route
    ADD CONSTRAINT infra_object_route_pkey PRIMARY KEY (id);


--
-- Name: infra_object_signal infra_object_signal_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_signal
    ADD CONSTRAINT infra_object_signal_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_signal infra_object_signal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_signal
    ADD CONSTRAINT infra_object_signal_pkey PRIMARY KEY (id);


--
-- Name: infra_object_speed_section infra_object_speed_section_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_speed_section
    ADD CONSTRAINT infra_object_speed_section_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_speed_section infra_object_speed_section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_speed_section
    ADD CONSTRAINT infra_object_speed_section_pkey PRIMARY KEY (id);


--
-- Name: infra_object_switch infra_object_switch_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_switch
    ADD CONSTRAINT infra_object_switch_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_switch infra_object_switch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_switch
    ADD CONSTRAINT infra_object_switch_pkey PRIMARY KEY (id);


--
-- Name: infra_object_extended_switch_type infra_object_switch_type_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_extended_switch_type
    ADD CONSTRAINT infra_object_switch_type_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_extended_switch_type infra_object_switch_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_extended_switch_type
    ADD CONSTRAINT infra_object_switch_type_pkey PRIMARY KEY (id);


--
-- Name: infra_object_track_section infra_object_track_section_infra_id_obj_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_track_section
    ADD CONSTRAINT infra_object_track_section_infra_id_obj_id_key UNIQUE (infra_id, obj_id);


--
-- Name: infra_object_track_section infra_object_track_section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_track_section
    ADD CONSTRAINT infra_object_track_section_pkey PRIMARY KEY (id);


--
-- Name: infra infra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra
    ADD CONSTRAINT infra_pkey PRIMARY KEY (id);


--
-- Name: macro_node macro_node_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macro_node
    ADD CONSTRAINT macro_node_pkey PRIMARY KEY (id);


--
-- Name: macro_node macro_node_scenario_id_path_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macro_node
    ADD CONSTRAINT macro_node_scenario_id_path_item_key_key UNIQUE (scenario_id, path_item_key);


--
-- Name: macro_note macro_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macro_note
    ADD CONSTRAINT macro_note_pkey PRIMARY KEY (id);


--
-- Name: train_schedule paced_train_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule
    ADD CONSTRAINT paced_train_pkey PRIMARY KEY (id);


--
-- Name: train_schedule_round_trips paced_train_round_trips_left_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_round_trips
    ADD CONSTRAINT paced_train_round_trips_left_id_key UNIQUE (left_id);


--
-- Name: train_schedule_round_trips paced_train_round_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_round_trips
    ADD CONSTRAINT paced_train_round_trips_pkey PRIMARY KEY (id);


--
-- Name: train_schedule_round_trips paced_train_round_trips_right_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_round_trips
    ADD CONSTRAINT paced_train_round_trips_right_id_key UNIQUE (right_id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: rolling_stock_livery rolling_stock_livery_compound_image_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_livery
    ADD CONSTRAINT rolling_stock_livery_compound_image_id_key UNIQUE (compound_image_id);


--
-- Name: rolling_stock_livery rolling_stock_livery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_livery
    ADD CONSTRAINT rolling_stock_livery_pkey PRIMARY KEY (id);


--
-- Name: rolling_stock_livery rolling_stock_livery_rolling_stock_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_livery
    ADD CONSTRAINT rolling_stock_livery_rolling_stock_id_name_key UNIQUE (rolling_stock_id, name);


--
-- Name: rolling_stock rolling_stock_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock
    ADD CONSTRAINT rolling_stock_name_key UNIQUE (name);


--
-- Name: rolling_stock rolling_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock
    ADD CONSTRAINT rolling_stock_pkey PRIMARY KEY (id);


--
-- Name: rolling_stock_separate_image rolling_stock_separate_image_image_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_separate_image
    ADD CONSTRAINT rolling_stock_separate_image_image_id_key UNIQUE (image_id);


--
-- Name: rolling_stock_separate_image rolling_stock_separate_image_livery_id_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_separate_image
    ADD CONSTRAINT rolling_stock_separate_image_livery_id_order_key UNIQUE (livery_id, "order");


--
-- Name: rolling_stock_separate_image rolling_stock_separate_image_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_separate_image
    ADD CONSTRAINT rolling_stock_separate_image_pkey PRIMARY KEY (id);


--
-- Name: scenario scenario_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_v2_pkey PRIMARY KEY (id);


--
-- Name: scenario scenario_v2_timetable_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_v2_timetable_id_key UNIQUE (timetable_id);


--
-- Name: search_journey_environment search_journey_environment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_journey_environment
    ADD CONSTRAINT search_journey_environment_pkey PRIMARY KEY (id);


--
-- Name: search_journey_environment_timetable search_journey_environment_ti_search_journey_environment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_journey_environment_timetable
    ADD CONSTRAINT search_journey_environment_ti_search_journey_environment_id_key UNIQUE (search_journey_environment_id, timetable_id);


--
-- Name: search_journey_environment_timetable search_journey_environment_timetable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_journey_environment_timetable
    ADD CONSTRAINT search_journey_environment_timetable_pkey PRIMARY KEY (id);


--
-- Name: search_operational_point search_operational_point_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_operational_point
    ADD CONSTRAINT search_operational_point_pkey PRIMARY KEY (id);


--
-- Name: search_project search_project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_project
    ADD CONSTRAINT search_project_pkey PRIMARY KEY (id);


--
-- Name: search_scenario search_scenario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_scenario
    ADD CONSTRAINT search_scenario_pkey PRIMARY KEY (id);


--
-- Name: search_signal search_signal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_signal
    ADD CONSTRAINT search_signal_pkey PRIMARY KEY (id);


--
-- Name: search_study search_study_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_study
    ADD CONSTRAINT search_study_pkey PRIMARY KEY (id);


--
-- Name: search_track search_track_infra_id_line_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_track
    ADD CONSTRAINT search_track_infra_id_line_code_key UNIQUE (infra_id, line_code);


--
-- Name: search_track search_track_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_track
    ADD CONSTRAINT search_track_pkey PRIMARY KEY (id);


--
-- Name: search_user search_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_user
    ADD CONSTRAINT search_user_pkey PRIMARY KEY (id);


--
-- Name: stdcm_search_environment stdcm_search_environment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stdcm_search_environment
    ADD CONSTRAINT stdcm_search_environment_pkey PRIMARY KEY (id);


--
-- Name: study study_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study
    ADD CONSTRAINT study_pkey PRIMARY KEY (id);


--
-- Name: sub_categories sub_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_categories
    ADD CONSTRAINT sub_categories_code_key UNIQUE (code);


--
-- Name: sub_categories sub_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_categories
    ADD CONSTRAINT sub_categories_pkey PRIMARY KEY (id);


--
-- Name: temporary_speed_limit_group temporary_speed_limit_group_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_speed_limit_group
    ADD CONSTRAINT temporary_speed_limit_group_name_key UNIQUE (name);


--
-- Name: temporary_speed_limit_group temporary_speed_limit_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_speed_limit_group
    ADD CONSTRAINT temporary_speed_limit_group_pkey PRIMARY KEY (id);


--
-- Name: temporary_speed_limit temporary_speed_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_speed_limit
    ADD CONSTRAINT temporary_speed_limit_pkey PRIMARY KEY (id);


--
-- Name: timetable_train_schedule_set timetable_train_schedule_set_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_train_schedule_set
    ADD CONSTRAINT timetable_train_schedule_set_pkey PRIMARY KEY (id);


--
-- Name: timetable_train_schedule_set timetable_train_schedule_set_timetable_id_train_schedule_se_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_train_schedule_set
    ADD CONSTRAINT timetable_train_schedule_set_timetable_id_train_schedule_se_key UNIQUE (timetable_id, train_schedule_set_id);


--
-- Name: timetable timetable_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable
    ADD CONSTRAINT timetable_v2_pkey PRIMARY KEY (id);


--
-- Name: towed_rolling_stock towed_rolling_stock_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.towed_rolling_stock
    ADD CONSTRAINT towed_rolling_stock_name_key UNIQUE (name);


--
-- Name: towed_rolling_stock towed_rolling_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.towed_rolling_stock
    ADD CONSTRAINT towed_rolling_stock_pkey PRIMARY KEY (id);


--
-- Name: train_schedule_exception train_schedule_exception_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_exception
    ADD CONSTRAINT train_schedule_exception_pkey PRIMARY KEY (id);


--
-- Name: train_schedule_exception train_schedule_exception_timetable_id_train_schedule_id_occ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_exception
    ADD CONSTRAINT train_schedule_exception_timetable_id_train_schedule_id_occ_key UNIQUE (timetable_id, train_schedule_id, occurrence_index);


--
-- Name: train_schedule_linking train_schedule_linking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT train_schedule_linking_pkey PRIMARY KEY (id);


--
-- Name: train_schedule_set train_schedule_set_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_set
    ADD CONSTRAINT train_schedule_set_pkey PRIMARY KEY (id);


--
-- Name: train_schedule_linking unique_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT unique_source UNIQUE NULLS NOT DISTINCT (timetable_id, source_train_schedule_id, source_occurrence_index, source_added_exception_id, source_train_schedule_instance_index);


--
-- Name: train_schedule_linking unique_target; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT unique_target UNIQUE NULLS NOT DISTINCT (timetable_id, target_train_schedule_id, target_occurrence_index, target_added_exception_id, target_train_schedule_instance_index);


--
-- Name: work_schedule_group work_schedule_group_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_schedule_group
    ADD CONSTRAINT work_schedule_group_name_key UNIQUE (name);


--
-- Name: work_schedule_group work_schedule_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_schedule_group
    ADD CONSTRAINT work_schedule_group_pkey PRIMARY KEY (id);


--
-- Name: work_schedule work_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_schedule
    ADD CONSTRAINT work_schedule_pkey PRIMARY KEY (id);


--
-- Name: domestic_unique_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domestic_unique_index ON public.infra_object_operational_point USING btree (infra_id, ((data ->> 'country_code'::text)), ((data ->> 'main_code'::text)), ((data ->> 'secondary_code'::text))) NULLS NOT DISTINCT;


--
-- Name: idx_authn_user_identity_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_authn_user_identity_user_id ON public.authn_user_identity USING btree (user_id);


--
-- Name: idx_gin_search_project_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gin_search_project_description ON public.search_project USING gin (description public.gin_trgm_ops);


--
-- Name: idx_gin_search_project_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gin_search_project_name ON public.search_project USING gin (name public.gin_trgm_ops);


--
-- Name: idx_gin_search_study_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gin_search_study_description ON public.search_study USING gin (description public.gin_trgm_ops);


--
-- Name: idx_gin_search_study_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gin_search_study_name ON public.search_study USING gin (name public.gin_trgm_ops);


--
-- Name: idx_gin_search_track_line_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gin_search_track_line_name ON public.search_track USING gin (line_name public.gin_trgm_ops);


--
-- Name: idx_infra_layer_error_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infra_layer_error_infra_id ON public.infra_layer_error USING btree (infra_id);


--
-- Name: idx_infra_layer_operational_point_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infra_layer_operational_point_infra_id ON public.infra_layer_operational_point USING btree (infra_id);


--
-- Name: idx_infra_layer_operational_point_obj_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infra_layer_operational_point_obj_id ON public.infra_layer_operational_point USING btree (obj_id);


--
-- Name: idx_infra_layer_track_section_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infra_layer_track_section_infra_id ON public.infra_layer_track_section USING btree (infra_id);


--
-- Name: idx_infra_layer_track_section_obj_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infra_layer_track_section_obj_id ON public.infra_layer_track_section USING btree (obj_id);


--
-- Name: idx_infra_object_track_section_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infra_object_track_section_infra_id ON public.infra_object_track_section USING btree (infra_id);


--
-- Name: idx_infra_object_track_section_line_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infra_object_track_section_line_code ON public.infra_object_track_section USING btree ((((data #>> '{extensions,sncf,line_code}'::text[]))::integer));


--
-- Name: idx_macro_note_scenario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_macro_note_scenario_id ON public.macro_note USING btree (scenario_id);


--
-- Name: idx_paced_train_sub_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_paced_train_sub_category ON public.train_schedule USING btree (sub_category);


--
-- Name: idx_paced_train_train_schedule_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_paced_train_train_schedule_set_id ON public.train_schedule USING btree (train_schedule_set_id);


--
-- Name: idx_project_image_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_image_id ON public.project USING btree (image_id);


--
-- Name: idx_search_environment_enabled_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_environment_enabled_from ON public.stdcm_search_environment USING btree (enabled_from);


--
-- Name: idx_search_environment_enabled_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_environment_enabled_until ON public.stdcm_search_environment USING btree (enabled_until);


--
-- Name: idx_sub_categories_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_categories_code ON public.sub_categories USING btree (code);


--
-- Name: idx_timetable_id_train_schedule_exception; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timetable_id_train_schedule_exception ON public.train_schedule_exception USING btree (timetable_id);


--
-- Name: idx_timetable_train_schedule_set_train_schedule_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timetable_train_schedule_set_train_schedule_set_id ON public.timetable_train_schedule_set USING btree (train_schedule_set_id);


--
-- Name: idx_train_schedule_id_train_schedule_exception; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_train_schedule_id_train_schedule_exception ON public.train_schedule_exception USING btree (train_schedule_id);


--
-- Name: idx_train_schedule_set_catalog_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_train_schedule_set_catalog_entry_id ON public.train_schedule_set USING btree (catalog_entry_id);


--
-- Name: infra_layer_buffer_stop_geographic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_buffer_stop_geographic_id ON public.infra_layer_buffer_stop USING gist (geographic);


--
-- Name: infra_layer_catenary_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_catenary_geographic ON public.infra_layer_electrification USING gist (geographic);


--
-- Name: infra_layer_detector_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_detector_geographic ON public.infra_layer_detector USING gist (geographic);


--
-- Name: infra_layer_error_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_error_geographic ON public.infra_layer_error USING gist (geographic);


--
-- Name: infra_layer_level_crossing_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_level_crossing_geographic ON public.infra_layer_level_crossing USING gist (geographic);


--
-- Name: infra_layer_lpv_panel_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_lpv_panel_geographic ON public.infra_layer_psl_sign USING gist (geographic);


--
-- Name: infra_layer_neutral_section_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_neutral_section_geographic ON public.infra_layer_neutral_section USING gist (geographic);


--
-- Name: infra_layer_neutral_section_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_neutral_section_infra_id ON public.infra_layer_neutral_section USING btree (infra_id);


--
-- Name: infra_layer_neutral_sign_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_neutral_sign_geographic ON public.infra_layer_neutral_sign USING gist (geographic);


--
-- Name: infra_layer_operational_point_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_operational_point_geographic ON public.infra_layer_operational_point USING gist (geographic);


--
-- Name: infra_layer_signal_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_signal_geographic ON public.infra_layer_signal USING gist (geographic);


--
-- Name: infra_layer_speed_section_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_speed_section_geographic ON public.infra_layer_speed_section USING gist (geographic);


--
-- Name: infra_layer_switch_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_switch_geographic ON public.infra_layer_switch USING gist (geographic);


--
-- Name: infra_layer_track_section_geographic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX infra_layer_track_section_geographic ON public.infra_layer_track_section USING gist (geographic);


--
-- Name: pga_idx_fk_infra_layer_neutral_sign_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_infra_layer_neutral_sign_infra_id ON public.infra_layer_neutral_sign USING btree (infra_id);


--
-- Name: pga_idx_fk_infra_layer_psl_sign_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_infra_layer_psl_sign_infra_id ON public.infra_layer_psl_sign USING btree (infra_id);


--
-- Name: pga_idx_fk_scenario_electrical_profile_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_scenario_electrical_profile_set_id ON public.scenario USING btree (electrical_profile_set_id);


--
-- Name: pga_idx_fk_scenario_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_scenario_infra_id ON public.scenario USING btree (infra_id);


--
-- Name: pga_idx_fk_scenario_study_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_scenario_study_id ON public.scenario USING btree (study_id);


--
-- Name: pga_idx_fk_stdcm_search_environment_electrical_profile_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_stdcm_search_environment_electrical_profile_set_id ON public.stdcm_search_environment USING btree (electrical_profile_set_id);


--
-- Name: pga_idx_fk_stdcm_search_environment_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_stdcm_search_environment_infra_id ON public.stdcm_search_environment USING btree (infra_id);


--
-- Name: pga_idx_fk_stdcm_search_environment_temporary_speed_limit_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_stdcm_search_environment_temporary_speed_limit_group ON public.stdcm_search_environment USING btree (temporary_speed_limit_group_id);


--
-- Name: pga_idx_fk_stdcm_search_environment_timetable_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_stdcm_search_environment_timetable_id ON public.stdcm_search_environment USING btree (timetable_id);


--
-- Name: pga_idx_fk_stdcm_search_environment_work_schedule_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_stdcm_search_environment_work_schedule_group_id ON public.stdcm_search_environment USING btree (work_schedule_group_id);


--
-- Name: pga_idx_fk_study_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_study_project_id ON public.study USING btree (project_id);


--
-- Name: pga_idx_fk_temporary_speed_limit_temporary_speed_limit_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_temporary_speed_limit_temporary_speed_limit_group_id ON public.temporary_speed_limit USING btree (temporary_speed_limit_group_id);


--
-- Name: pga_idx_fk_work_schedule_work_schedule_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pga_idx_fk_work_schedule_work_schedule_group_id ON public.work_schedule USING btree (work_schedule_group_id);


--
-- Name: plc_unique_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plc_unique_index ON public.infra_object_operational_point USING btree (infra_id, ((data ->> 'plc'::text))) WHERE ((data ->> 'plc'::text) IS NOT NULL);


--
-- Name: search_operational_point_country_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_country_code ON public.search_operational_point USING btree (country_code);


--
-- Name: search_operational_point_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_infra_id ON public.search_operational_point USING btree (infra_id);


--
-- Name: search_operational_point_is_passenger_station; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_is_passenger_station ON public.search_operational_point USING btree (is_passenger_station);


--
-- Name: search_operational_point_main_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_main_code ON public.search_operational_point USING btree (main_code);


--
-- Name: search_operational_point_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_name ON public.search_operational_point USING gin (name public.gin_trgm_ops);


--
-- Name: search_operational_point_obj_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_obj_id ON public.search_operational_point USING btree (obj_id);


--
-- Name: search_operational_point_secondary_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_secondary_code ON public.search_operational_point USING btree (secondary_code);


--
-- Name: search_operational_point_secondary_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_secondary_name ON public.search_operational_point USING btree (secondary_name);


--
-- Name: search_operational_point_uic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_operational_point_uic ON public.search_operational_point USING btree (uic);


--
-- Name: search_scenario_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_scenario_description ON public.search_scenario USING gin (description public.gin_trgm_ops);


--
-- Name: search_scenario_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_scenario_name ON public.search_scenario USING gin (name public.gin_trgm_ops);


--
-- Name: search_scenario_study_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_scenario_study_id ON public.search_scenario USING btree (study_id);


--
-- Name: search_scenario_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_scenario_tags ON public.search_scenario USING btree (tags);


--
-- Name: search_signal_infra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_signal_infra_id ON public.search_signal USING btree (infra_id);


--
-- Name: search_signal_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_signal_label ON public.search_signal USING gin (label public.gin_trgm_ops);


--
-- Name: search_signal_line_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_signal_line_code ON public.search_signal USING btree (line_code);


--
-- Name: search_signal_line_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_signal_line_name ON public.search_signal USING gin (line_name public.gin_trgm_ops);


--
-- Name: search_signal_obj_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_signal_obj_id ON public.search_signal USING btree (obj_id);


--
-- Name: search_signal_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_signal_settings ON public.search_signal USING btree (settings);


--
-- Name: search_signal_signaling_systems; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_signal_signaling_systems ON public.search_signal USING btree (signaling_systems);


--
-- Name: search_user_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_user_name ON public.search_user USING gin (name public.gin_trgm_ops);


--
-- Name: temporary_speed_limit_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX temporary_speed_limit_date_time ON public.temporary_speed_limit USING btree (start_date_time);


--
-- Name: temporary_speed_limit_end_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX temporary_speed_limit_end_date_time ON public.temporary_speed_limit USING btree (end_date_time);


--
-- Name: train_schedule_set_catalog_entry_name_published_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX train_schedule_set_catalog_entry_name_published_unique ON public.train_schedule_set USING btree (catalog_entry_id, name, timetable_type) WHERE (published = true);


--
-- Name: train_schedule_train_schedule_set_id_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX train_schedule_train_schedule_set_id_id_idx ON public.train_schedule USING btree (id, train_schedule_set_id);


--
-- Name: uic_unique_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uic_unique_index ON public.infra_object_operational_point USING btree (infra_id, ((data ->> 'uic'::text)), ((data ->> 'secondary_code'::text))) NULLS NOT DISTINCT WHERE ((data ->> 'uic'::text) IS NOT NULL);


--
-- Name: work_schedule_end_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_schedule_end_date_time ON public.work_schedule USING btree (end_date_time);


--
-- Name: work_schedule_start_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_schedule_start_date_time ON public.work_schedule USING btree (start_date_time);


--
-- Name: authn_user_identity authn_user_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER authn_user_delete_trigger AFTER DELETE ON public.authn_user_identity FOR EACH ROW EXECUTE FUNCTION public.delete_associated_authn_user();


--
-- Name: authn_user check_authn_user_has_at_least_one_identity_after_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER check_authn_user_has_at_least_one_identity_after_delete AFTER INSERT ON public.authn_user DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_user_has_at_least_one_identity_after_delete();


--
-- Name: authn_user_identity check_authn_user_identity_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_authn_user_identity_update AFTER UPDATE OF user_id ON public.authn_user_identity FOR EACH ROW EXECUTE FUNCTION public.check_authn_user_identity_update_does_not_leave_user_without_id();


--
-- Name: infra_object_operational_point search_operational_point__ins_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_operational_point__ins_trig AFTER INSERT ON public.infra_object_operational_point FOR EACH ROW EXECUTE FUNCTION public.search_operational_point__ins_trig_fun();


--
-- Name: infra_object_operational_point search_operational_point__upd_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_operational_point__upd_trig AFTER UPDATE ON public.infra_object_operational_point FOR EACH ROW EXECUTE FUNCTION public.search_operational_point__upd_trig_fun();


--
-- Name: project search_project__ins_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_project__ins_trig AFTER INSERT ON public.project FOR EACH ROW EXECUTE FUNCTION public.search_project__ins_trig_fun();


--
-- Name: project search_project__upd_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_project__upd_trig AFTER UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.search_project__upd_trig_fun();


--
-- Name: scenario search_scenario__ins_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_scenario__ins_trig AFTER INSERT ON public.scenario FOR EACH ROW EXECUTE FUNCTION public.search_scenario__ins_trig_fun();


--
-- Name: scenario search_scenario__upd_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_scenario__upd_trig AFTER UPDATE ON public.scenario FOR EACH ROW EXECUTE FUNCTION public.search_scenario__upd_trig_fun();


--
-- Name: infra_object_signal search_signal__ins_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_signal__ins_trig AFTER INSERT ON public.infra_object_signal FOR EACH ROW EXECUTE FUNCTION public.search_signal__ins_trig_fun();


--
-- Name: infra_object_signal search_signal__upd_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_signal__upd_trig AFTER UPDATE ON public.infra_object_signal FOR EACH ROW EXECUTE FUNCTION public.search_signal__upd_trig_fun();


--
-- Name: study search_study__ins_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_study__ins_trig AFTER INSERT ON public.study FOR EACH ROW EXECUTE FUNCTION public.search_study__ins_trig_fun();


--
-- Name: study search_study__upd_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_study__upd_trig AFTER UPDATE ON public.study FOR EACH ROW EXECUTE FUNCTION public.search_study__upd_trig_fun();


--
-- Name: infra_object_track_section search_track__del_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_track__del_trig AFTER DELETE ON public.infra_object_track_section FOR EACH ROW EXECUTE FUNCTION public.search_track__del_trig_fun();


--
-- Name: infra_object_track_section search_track__ins_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_track__ins_trig AFTER INSERT ON public.infra_object_track_section FOR EACH ROW EXECUTE FUNCTION public.search_track__ins_trig_fun();


--
-- Name: infra_object_track_section search_track__upd_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_track__upd_trig AFTER UPDATE ON public.infra_object_track_section FOR EACH ROW EXECUTE FUNCTION public.search_track__upd_trig_fun();


--
-- Name: authn_user search_user__ins_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_user__ins_trig AFTER INSERT ON public.authn_user FOR EACH ROW EXECUTE FUNCTION public.search_user__ins_trig_fun();


--
-- Name: authn_user search_user__upd_trig; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_user__upd_trig AFTER UPDATE ON public.authn_user FOR EACH ROW EXECUTE FUNCTION public.search_user__upd_trig_fun();


--
-- Name: train_schedule trigger_check_add_only_paced_in_hourly_train_schedule_set; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_add_only_paced_in_hourly_train_schedule_set BEFORE INSERT OR UPDATE OF train_schedule_set_id, time_window, "interval", start_time ON public.train_schedule FOR EACH ROW EXECUTE FUNCTION public.check_add_only_paced_in_hourly_train_schedule_set();


--
-- Name: search_journey_environment_timetable trigger_check_search_journey_environment_timetable_type_is_cale; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_search_journey_environment_timetable_type_is_cale BEFORE INSERT OR UPDATE OF timetable_id ON public.search_journey_environment_timetable FOR EACH ROW EXECUTE FUNCTION public.check_search_journey_environment_timetable_type_is_calendar();


--
-- Name: stdcm_search_environment trigger_check_stdcm_search_environment_timetable_type_is_calend; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_stdcm_search_environment_timetable_type_is_calend BEFORE INSERT OR UPDATE OF timetable_id ON public.stdcm_search_environment FOR EACH ROW EXECUTE FUNCTION public.check_stdcm_search_environment_timetable_type_is_calendar();


--
-- Name: timetable_train_schedule_set trigger_check_timetable_and_train_schedule_set_same_type; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_timetable_and_train_schedule_set_same_type BEFORE INSERT OR UPDATE OF timetable_id, train_schedule_set_id ON public.timetable_train_schedule_set FOR EACH ROW EXECUTE FUNCTION public.check_timetable_and_train_schedule_set_same_type();


--
-- Name: timetable trigger_check_timetable_type_is_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_timetable_type_is_immutable BEFORE UPDATE OF timetable_type ON public.timetable FOR EACH ROW EXECUTE FUNCTION public.check_timetable_type_is_immutable();


--
-- Name: train_schedule_set trigger_check_train_schedule_set_timetable_type_is_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_train_schedule_set_timetable_type_is_immutable BEFORE UPDATE OF timetable_type ON public.train_schedule_set FOR EACH ROW EXECUTE FUNCTION public.check_train_schedule_set_timetable_type_is_immutable();


--
-- Name: authn_user_identity authn_user_identity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authn_user_identity
    ADD CONSTRAINT authn_user_identity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.authn_user(id) ON DELETE CASCADE;


--
-- Name: train_schedule fk_paced_train_sub_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule
    ADD CONSTRAINT fk_paced_train_sub_category FOREIGN KEY (sub_category) REFERENCES public.sub_categories(code) ON DELETE SET NULL;


--
-- Name: macro_node fk_scenario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macro_node
    ADD CONSTRAINT fk_scenario FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: macro_note fk_scenario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macro_note
    ADD CONSTRAINT fk_scenario FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: infra_layer_buffer_stop infra_layer_buffer_stop_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_buffer_stop
    ADD CONSTRAINT infra_layer_buffer_stop_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_electrification infra_layer_catenary_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_electrification
    ADD CONSTRAINT infra_layer_catenary_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_detector infra_layer_detector_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_detector
    ADD CONSTRAINT infra_layer_detector_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_error infra_layer_error_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_error
    ADD CONSTRAINT infra_layer_error_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_level_crossing infra_layer_level_crossing_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_level_crossing
    ADD CONSTRAINT infra_layer_level_crossing_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_psl_sign infra_layer_lpv_panel_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_psl_sign
    ADD CONSTRAINT infra_layer_lpv_panel_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_neutral_section infra_layer_neutral_section_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_neutral_section
    ADD CONSTRAINT infra_layer_neutral_section_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_neutral_sign infra_layer_neutral_sign_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_neutral_sign
    ADD CONSTRAINT infra_layer_neutral_sign_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_operational_point infra_layer_operational_point_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_operational_point
    ADD CONSTRAINT infra_layer_operational_point_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_signal infra_layer_signal_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_signal
    ADD CONSTRAINT infra_layer_signal_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_speed_section infra_layer_speed_section_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_speed_section
    ADD CONSTRAINT infra_layer_speed_section_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_switch infra_layer_switch_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_switch
    ADD CONSTRAINT infra_layer_switch_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_layer_track_section infra_layer_track_section_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_layer_track_section
    ADD CONSTRAINT infra_layer_track_section_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_buffer_stop infra_object_buffer_stop_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_buffer_stop
    ADD CONSTRAINT infra_object_buffer_stop_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_electrification infra_object_catenary_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_electrification
    ADD CONSTRAINT infra_object_catenary_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_detector infra_object_detector_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_detector
    ADD CONSTRAINT infra_object_detector_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_level_crossing infra_object_level_crossing_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_level_crossing
    ADD CONSTRAINT infra_object_level_crossing_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_neutral_section infra_object_neutral_section_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_neutral_section
    ADD CONSTRAINT infra_object_neutral_section_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_operational_point infra_object_operational_point_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_operational_point
    ADD CONSTRAINT infra_object_operational_point_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_route infra_object_route_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_route
    ADD CONSTRAINT infra_object_route_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_signal infra_object_signal_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_signal
    ADD CONSTRAINT infra_object_signal_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_speed_section infra_object_speed_section_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_speed_section
    ADD CONSTRAINT infra_object_speed_section_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_switch infra_object_switch_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_switch
    ADD CONSTRAINT infra_object_switch_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_extended_switch_type infra_object_switch_type_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_extended_switch_type
    ADD CONSTRAINT infra_object_switch_type_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: infra_object_track_section infra_object_track_section_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_object_track_section
    ADD CONSTRAINT infra_object_track_section_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE;


--
-- Name: train_schedule_round_trips paced_train_round_trips_left_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_round_trips
    ADD CONSTRAINT paced_train_round_trips_left_id_fkey FOREIGN KEY (left_id) REFERENCES public.train_schedule(id) ON DELETE CASCADE;


--
-- Name: train_schedule_round_trips paced_train_round_trips_right_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_round_trips
    ADD CONSTRAINT paced_train_round_trips_right_id_fkey FOREIGN KEY (right_id) REFERENCES public.train_schedule(id) ON DELETE CASCADE;


--
-- Name: train_schedule paced_train_train_schedule_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule
    ADD CONSTRAINT paced_train_train_schedule_set_id_fkey FOREIGN KEY (train_schedule_set_id) REFERENCES public.train_schedule_set(id) ON DELETE CASCADE;


--
-- Name: project project_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.document(id) ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: rolling_stock_livery rolling_stock_livery_compound_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_livery
    ADD CONSTRAINT rolling_stock_livery_compound_image_id_fkey FOREIGN KEY (compound_image_id) REFERENCES public.document(id) ON DELETE SET NULL;


--
-- Name: rolling_stock_livery rolling_stock_livery_rolling_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_livery
    ADD CONSTRAINT rolling_stock_livery_rolling_stock_id_fkey FOREIGN KEY (rolling_stock_id) REFERENCES public.rolling_stock(id) ON DELETE CASCADE;


--
-- Name: rolling_stock_separate_image rolling_stock_separate_image_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_separate_image
    ADD CONSTRAINT rolling_stock_separate_image_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: rolling_stock_separate_image rolling_stock_separate_image_livery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolling_stock_separate_image
    ADD CONSTRAINT rolling_stock_separate_image_livery_id_fkey FOREIGN KEY (livery_id) REFERENCES public.rolling_stock_livery(id) ON DELETE CASCADE;


--
-- Name: scenario scenario_v2_electrical_profile_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_v2_electrical_profile_set_id_fkey FOREIGN KEY (electrical_profile_set_id) REFERENCES public.electrical_profile_set(id) ON DELETE CASCADE;


--
-- Name: scenario scenario_v2_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_v2_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: scenario scenario_v2_study_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_v2_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.study(id) ON DELETE CASCADE;


--
-- Name: scenario scenario_v2_timetable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_v2_timetable_id_fkey FOREIGN KEY (timetable_id) REFERENCES public.timetable(id) ON DELETE CASCADE;


--
-- Name: search_journey_environment search_journey_environment_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_journey_environment
    ADD CONSTRAINT search_journey_environment_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id);


--
-- Name: search_journey_environment_timetable search_journey_environment_ti_search_journey_environment_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_journey_environment_timetable
    ADD CONSTRAINT search_journey_environment_ti_search_journey_environment_i_fkey FOREIGN KEY (search_journey_environment_id) REFERENCES public.search_journey_environment(id) ON DELETE CASCADE;


--
-- Name: search_journey_environment_timetable search_journey_environment_timetable_timetable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_journey_environment_timetable
    ADD CONSTRAINT search_journey_environment_timetable_timetable_id_fkey FOREIGN KEY (timetable_id) REFERENCES public.timetable(id);


--
-- Name: search_operational_point search_operational_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_operational_point
    ADD CONSTRAINT search_operational_point_id_fkey FOREIGN KEY (id) REFERENCES public.infra_object_operational_point(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: search_project search_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_project
    ADD CONSTRAINT search_project_id_fkey FOREIGN KEY (id) REFERENCES public.project(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: search_scenario search_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_scenario
    ADD CONSTRAINT search_scenario_id_fkey FOREIGN KEY (id) REFERENCES public.scenario(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: search_signal search_signal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_signal
    ADD CONSTRAINT search_signal_id_fkey FOREIGN KEY (id) REFERENCES public.infra_object_signal(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: search_study search_study_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_study
    ADD CONSTRAINT search_study_id_fkey FOREIGN KEY (id) REFERENCES public.study(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: search_user search_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_user
    ADD CONSTRAINT search_user_id_fkey FOREIGN KEY (id) REFERENCES public.authn_user(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stdcm_search_environment stdcm_search_environment_electrical_profile_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stdcm_search_environment
    ADD CONSTRAINT stdcm_search_environment_electrical_profile_set_id_fkey FOREIGN KEY (electrical_profile_set_id) REFERENCES public.electrical_profile_set(id);


--
-- Name: stdcm_search_environment stdcm_search_environment_infra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stdcm_search_environment
    ADD CONSTRAINT stdcm_search_environment_infra_id_fkey FOREIGN KEY (infra_id) REFERENCES public.infra(id);


--
-- Name: stdcm_search_environment stdcm_search_environment_temporary_speed_limit_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stdcm_search_environment
    ADD CONSTRAINT stdcm_search_environment_temporary_speed_limit_group_id_fkey FOREIGN KEY (temporary_speed_limit_group_id) REFERENCES public.temporary_speed_limit_group(id);


--
-- Name: stdcm_search_environment stdcm_search_environment_timetable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stdcm_search_environment
    ADD CONSTRAINT stdcm_search_environment_timetable_id_fkey FOREIGN KEY (timetable_id) REFERENCES public.timetable(id);


--
-- Name: stdcm_search_environment stdcm_search_environment_work_schedule_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stdcm_search_environment
    ADD CONSTRAINT stdcm_search_environment_work_schedule_group_id_fkey FOREIGN KEY (work_schedule_group_id) REFERENCES public.work_schedule_group(id);


--
-- Name: study study_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study
    ADD CONSTRAINT study_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: temporary_speed_limit temporary_speed_limit_temporary_speed_limit_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_speed_limit
    ADD CONSTRAINT temporary_speed_limit_temporary_speed_limit_group_id_fkey FOREIGN KEY (temporary_speed_limit_group_id) REFERENCES public.temporary_speed_limit_group(id) ON DELETE CASCADE;


--
-- Name: timetable_train_schedule_set timetable_train_schedule_set_timetable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_train_schedule_set
    ADD CONSTRAINT timetable_train_schedule_set_timetable_id_fkey FOREIGN KEY (timetable_id) REFERENCES public.timetable(id) ON DELETE CASCADE;


--
-- Name: timetable_train_schedule_set timetable_train_schedule_set_train_schedule_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetable_train_schedule_set
    ADD CONSTRAINT timetable_train_schedule_set_train_schedule_set_id_fkey FOREIGN KEY (train_schedule_set_id) REFERENCES public.train_schedule_set(id) ON DELETE CASCADE;


--
-- Name: train_schedule_exception train_schedule_exception_timetable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_exception
    ADD CONSTRAINT train_schedule_exception_timetable_id_fkey FOREIGN KEY (timetable_id) REFERENCES public.timetable(id) ON DELETE CASCADE;


--
-- Name: train_schedule_exception train_schedule_exception_train_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_exception
    ADD CONSTRAINT train_schedule_exception_train_schedule_id_fkey FOREIGN KEY (train_schedule_id) REFERENCES public.train_schedule(id) ON DELETE CASCADE;


--
-- Name: train_schedule_linking train_schedule_linking_source_added_exception_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT train_schedule_linking_source_added_exception_id_fkey FOREIGN KEY (source_added_exception_id) REFERENCES public.train_schedule_exception(id) ON DELETE CASCADE;


--
-- Name: train_schedule_linking train_schedule_linking_source_train_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT train_schedule_linking_source_train_schedule_id_fkey FOREIGN KEY (source_train_schedule_id) REFERENCES public.train_schedule(id) ON DELETE CASCADE;


--
-- Name: train_schedule_linking train_schedule_linking_target_added_exception_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT train_schedule_linking_target_added_exception_id_fkey FOREIGN KEY (target_added_exception_id) REFERENCES public.train_schedule_exception(id) ON DELETE CASCADE;


--
-- Name: train_schedule_linking train_schedule_linking_target_train_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT train_schedule_linking_target_train_schedule_id_fkey FOREIGN KEY (target_train_schedule_id) REFERENCES public.train_schedule(id) ON DELETE CASCADE;


--
-- Name: train_schedule_linking train_schedule_linking_timetable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_linking
    ADD CONSTRAINT train_schedule_linking_timetable_id_fkey FOREIGN KEY (timetable_id) REFERENCES public.timetable(id) ON DELETE CASCADE;


--
-- Name: train_schedule_set train_schedule_set_catalog_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.train_schedule_set
    ADD CONSTRAINT train_schedule_set_catalog_entry_id_fkey FOREIGN KEY (catalog_entry_id) REFERENCES public.catalog_entry(id);


--
-- Name: work_schedule work_schedule_work_schedule_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_schedule
    ADD CONSTRAINT work_schedule_work_schedule_group_id_fkey FOREIGN KEY (work_schedule_group_id) REFERENCES public.work_schedule_group(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
