create user osrd with password 'password' createdb;

-- Create template_osrd database
create database template_osrd WITH IS_TEMPLATE true;

-- Connect to template_osrd
\c template_osrd

-- Create openfga schema
create schema openfga;

-- Enable required extensions
create extension postgis;
create extension pg_trgm;
create extension unaccent;

-- Grant privileges to user
grant all privileges on schema public to osrd;
grant all privileges on schema openfga to osrd;


-- Create osrd database using template_osrd
create database osrd TEMPLATE template_osrd;
