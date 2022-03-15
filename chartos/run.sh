#!/bin/sh
export PSQL_DSN='postgres://osrd:nopasswd@localhost/chartos'
export ROOT_URL=http://localhost:8000
export REDIS_URL=redis://localhost
exec "$@"
