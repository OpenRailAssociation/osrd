#!/bin/sh

: "${FRONT_PORT:=80}"

sed -i "s|%FRONT_PORT%|${FRONT_PORT}|g" /etc/nginx/conf.d/nginx.conf

exec "$@"
