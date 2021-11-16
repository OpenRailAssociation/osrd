#!/bin/sh

set -e

# Check arguments
if [ $# -ne 1 ]; then
  echo "usage: $0 osrd.backup"
  exit 2
fi

docker cp "$1" postgres:/backup
docker exec -u postgres postgres pg_restore -d osrd -x -c /backup
docker exec osrd-api python manage.py generate_layers
