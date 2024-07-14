#!/bin/sh

docker rm -f dyn-osrd-core-$1

docker compose \
    -p "osrd" \
    -f "docker-compose.yml" \
    exec rabbitmq rabbitmqctl delete_queue core-$1
