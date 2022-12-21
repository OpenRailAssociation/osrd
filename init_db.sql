create user osrd with password 'password' createdb;
create database osrd;
\ c osrd create extension postgis;
create extension pg_trgm;
grant all privileges on schema public to osrd;
