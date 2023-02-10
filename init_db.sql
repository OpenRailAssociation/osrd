create user osrd with password 'password' createdb;

-- Create template_osrd databse
create database template_osrd WITH IS_TEMPLATE true;
\c template_osrd
create extension postgis;
create extension pg_trgm;
create extension unaccent;

grant all privileges on schema public to osrd;

create database osrd TEMPLATE template_osrd;
