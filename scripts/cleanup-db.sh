#!/bin/sh

# This script should be compatible with MSYS, the compatibility layer used by
# Git for Windows. Absolute paths which should not be converted to windows paths
# have to start with //, see https://github.com/git-for-windows/git/issues/1387
# On windows, docker cp does not like leading double / on the container path.
# As a workaround, use relative paths: container:tmp/foo instead of container://tmp/foo

set -e

# Check arguments
if [ "$#" -ne 0 ]; then
  echo "usage: $0"
  exit 1
fi

# These variables are necessary to load the infra on the correct instance (the pr-infra or the dev one)
OSRD_POSTGRES="osrd-postgres"
OSRD_EDITOAST="osrd-editoast"
OSRD_VALKEY="osrd-valkey"
OSRD_POSTGRES_PORT=5432
OSRD_VALKEY_PORT=6379
if [ "$PR_TEST" -eq 1 ]; then
  OSRD_POSTGRES="osrd-postgres-pr-tests"
  OSRD_EDITOAST="osrd-editoast-pr-tests"
  OSRD_VALKEY="osrd-valkey-pr-tests"
  OSRD_POSTGRES_PORT=5433
  OSRD_VALKEY_PORT=6380
fi

# Check if the database exists
echo "Checking database exists..."
DB_EXISTS="$(docker exec $OSRD_POSTGRES psql -p $OSRD_POSTGRES_PORT -c "SELECT EXISTS (SELECT FROM pg_stat_database WHERE datname = 'osrd');")"
DB_EXISTS="$(echo "$DB_EXISTS" | grep -o -E '[tf]$')"

if [ $DB_EXISTS = 't' ]; then
  echo "  Database 'osrd' found"
else
  echo "  Database 'osrd' not found"
fi

if [ $DB_EXISTS = 't' ]; then
  # Check that no service is connected to the database
  echo "Checking database availability..."

  # if editoast is running, shut it down.
  if [ "$(docker ps -q -f name=$OSRD_EDITOAST)" ]; then
    echo "Stopping $OSRD_EDITOAST..."
    docker stop "$OSRD_EDITOAST"
  fi

  DB_CONN="$(docker exec "$OSRD_POSTGRES" psql -p "$OSRD_POSTGRES_PORT" -c "SELECT numbackends FROM pg_stat_database WHERE datname = 'osrd';")"
  DB_CONN="$(echo "$DB_CONN" | grep -o -E '[0-9]+$')"

  if [ $DB_CONN -ne 0 ]; then
    echo "  The database can not be cleared."
    echo "  A process is connected to your database, please check it and close it."
    echo "  In doubt, you can shutdown the whole compose stack and only keep the database running."
    exit 2
  fi

  # Drop database
  echo "Deleting osrd database..."
  docker exec "$OSRD_POSTGRES" psql -p "$OSRD_POSTGRES_PORT" -c 'DROP DATABASE osrd;' > /dev/null
fi

echo "Initialize new database (no migration)..."
# Here I remove the first line of the script cause the user already exists
docker exec "$OSRD_POSTGRES" sh -c 'cat /docker-entrypoint-initdb.d/init.sql | tail -n 1 > /tmp/init.sql'
docker exec "$OSRD_POSTGRES" psql -p "$OSRD_POSTGRES_PORT" -f //tmp/init.sql > /dev/null

# Clear Valkey Cache
echo "Deleting valkey cache..."
docker exec "$OSRD_VALKEY" valkey-cli -p "$OSRD_VALKEY_PORT" FLUSHALL > /dev/null 2>&1 || docker volume rm -f osrd_valkey_data > /dev/null

echo "Cleanup done!\n"
echo "You may want to apply migrations if you don't load a backup:"
echo "'diesel migration run --migration-dir $(dirname $0)/../editoast/migrations'  # 'docker compose up editoast' does it automatically"
