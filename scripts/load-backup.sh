#!/bin/sh

set -e

# Check arguments
if [ "$#" -ne 1 ]; then
  echo "usage: $0 osrd.backup"
  exit 1
fi

# Check sha1 is matching
echo Checking backup integrity...
BACKUP_PATH="$1"
BACKUP_FILENAME=$(basename -s ".backup" "$BACKUP_PATH")
echo "$BACKUP_FILENAME"
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

# Check if the database exists
echo "Checking database exists..."
DB_EXISTS="$(docker exec osrd-postgres psql -c "SELECT EXISTS (SELECT FROM pg_stat_database WHERE datname = 'osrd');")"
DB_EXISTS="$(echo "$DB_EXISTS" | grep -o -E '[tf]$')"

if [ $DB_EXISTS = 't' ]; then
  echo "  Database 'osrd' found"
else
  echo "  Database 'osrd' not found"
fi

if [ $DB_EXISTS = 't' ]; then
  # Check that no service is connected to the database
  echo "Checking database availability..."
  DB_CONN="$(docker exec osrd-postgres psql -c "SELECT numbackends FROM pg_stat_database WHERE datname = 'osrd';")"
  DB_CONN="$(echo "$DB_CONN" | grep -o -E '[0-9]+$')"

  if [ $DB_CONN -ne 0 ]; then
    echo "  The database can not cleared."
    echo "  You must only have your postgres container runnning!"
    exit 2
  fi

  # Drop database
  echo Deleting osrd database...
  docker exec osrd-postgres psql -c 'DROP DATABASE osrd;' > /dev/null
fi

echo Initialize new database...
# Here I remove the first line of the script cause the user already exists
docker exec osrd-postgres sh -c 'cat /docker-entrypoint-initdb.d/init.sql | tail -n 1 > /tmp/init.sql'
docker exec osrd-postgres psql -f /tmp/init.sql > /dev/null

# Copy needed files to the container
docker cp "$BACKUP_PATH" osrd-postgres:/tmp/backup-osrd

# restoring the backend can partialy fail, and that's sometimes ok
echo Restore backup...
docker exec osrd-postgres pg_restore --if-exists -c -d osrd -x /tmp/backup-osrd > /dev/null

echo Done !
