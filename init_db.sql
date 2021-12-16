create user chartos password 'password';
create user osrd superuser password 'password';
create database chartos;
create database osrd;

grant all privileges on database osrd to osrd;
grant all privileges on database chartos to chartos;

\c chartos
create extension postgis;
\c osrd
create extension postgis;
