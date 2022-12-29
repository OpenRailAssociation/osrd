create user osrd with password 'password' createdb;
create database osrd;

grant all privileges on database osrd to osrd;

\c osrd
create extension postgis;
