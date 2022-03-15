#!/bin/sh

set -e

# Check arguments
if [ "$#" -ne 1 ]; then
  echo "usage: $0 osrd.backup"
  exit 1
fi

docker cp "$1" osrd-postgres:/backup-osrd
# restoring the backend can partialy fail, and that's sometimes ok
docker exec osrd-postgres pg_restore -d osrd -x -c /backup-osrd || true
