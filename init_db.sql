create user osrd with password 'password' createdb;
create database osrd;

\c osrd
create extension postgis;

grant all privileges on schema public to osrd;
