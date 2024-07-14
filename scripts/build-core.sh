#!/bin/sh

docker compose \
    -p "osrd" \
    -f "docker-compose.yml" \
    build core
