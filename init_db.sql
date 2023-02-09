create user osrd with password 'password' createdb;

-- Create template_osrd databse
create database template_osrd WITH IS_TEMPLATE true;
\c template_osrd
create extension postgis;
create extension pg_trgm;
create extension unaccent;

grant all privileges on schema public to osrd;

-- Defining C lang functions require elevation so that's why those functions
-- are defined here. Cf. https://stackoverflow.com/a/11007216

CREATE OR REPLACE FUNCTION public.immutable_unaccent(regdictionary, text)
    RETURNS text
    LANGUAGE c IMMUTABLE PARALLEL SAFE STRICT AS
        '$libdir/unaccent', 'unaccent_dict';

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
    RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
BEGIN ATOMIC
    SELECT immutable_unaccent(regdictionary 'unaccent', $1);
END;

create database osrd TEMPLATE template_osrd;
