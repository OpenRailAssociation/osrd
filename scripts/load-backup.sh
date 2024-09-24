#!/bin/sh

# This script should be compatible with MSYS, the compatibility layer used by
# Git for Windows. Absolute paths which should not be converted to windows paths
# have to start with //, see https://github.com/git-for-windows/git/issues/1387
# On windows, docker cp does not like leading double / on the container path.
# As a workaround, use relative paths: container:tmp/foo instead of container://tmp/foo

set -e

# Check arguments
if [ "$#" -ne 1 ]; then
  echo "usage: $0 osrd.backup"
  exit 1
fi

# Check sha1 is matching
echo "Checking backup integrity..."
BACKUP_PATH="$1"
BACKUP_FILENAME=$(basename -s ".backup" "$BACKUP_PATH")
EXPECTED_SHA1=$(echo "$BACKUP_FILENAME" | grep -o -E '[0-9a-f]{40}' || echo "renamed")
CURRENT_SHA1=$(sha1sum "$BACKUP_PATH" | cut -d' ' -f1)
if [ "$EXPECTED_SHA1" = "$CURRENT_SHA1" ]; then
  echo "  ✔ The backup is valid"
elif [ "$EXPECTED_SHA1" = "renamed" ]; then
  echo "  ✘ Invalid backup file name (you may have renamed the file)"
  echo "    Found:    '${BACKUP_FILENAME}'"
  echo "    Expected: 'osrd_full_01_01_2000_sha1_0000000000000000000000000000000000000000.backup' "
  echo "               └───┬───┘ └───┬────┘ └─────────────────────┬─────────────────────┘ └─┬──┘  "
  echo "                 name      date                   sha1 of the backup             extension"
  exit 2
else
  echo "  ✘ Corrupted backup (you should download it again)"
  echo "    Expected sha1: ${EXPECTED_SHA1}"
  echo "    Current sha1:  ${CURRENT_SHA1}"
  exit 2
fi

# These variables are necessary to load the infra on the correct instance (the pr-infra or the dev one)
OSRD_POSTGRES="osrd-postgres"
OSRD_POSTGRES_PORT=5432
if [ "$PR_TEST" -eq 1 ]; then
  OSRD_POSTGRES="osrd-postgres-pr-tests"
  OSRD_POSTGRES_PORT=5433
fi

$(dirname "$0")/cleanup-db.sh # Cleanup and init db (no migration)

# Copy needed files to the container
docker cp "$BACKUP_PATH" "$OSRD_POSTGRES:tmp/backup-osrd"

# restoring the backend can partialy fail, and that's sometimes ok
echo "Restore backup..."
docker exec "$OSRD_POSTGRES" pg_restore --if-exists -p "$OSRD_POSTGRES_PORT" -c -d osrd -x //tmp/backup-osrd > /dev/null

# analyze db for performances
echo "Analyze for performances..."
docker exec "$OSRD_POSTGRES" psql -p "$OSRD_POSTGRES_PORT" -d osrd -c 'ANALYZE;' > /dev/null

echo "Load backup done!"
