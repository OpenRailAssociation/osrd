#!/bin/sh

set -e

# Check arguments
if [ $# -ne 2 ]; then
  echo "usage: $0 osrd.backup chartos.backup"
  exit 2
fi

docker cp "$1" osrd-postgres:/backup-osrd
docker cp "$2" osrd-postgres:/backup-chartos
# restoring the backend can partialy fail, and that's sometimes ok
docker exec osrd-postgres pg_restore -d osrd -x -c /backup-osrd || true
docker exec osrd-postgres pg_restore -d chartos -x -c /backup-chartos || true
