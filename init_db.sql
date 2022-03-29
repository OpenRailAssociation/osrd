create user osrd password 'password';
create database osrd;

grant all privileges on database osrd to osrd;

\c osrd
create extension postgis;
