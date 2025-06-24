#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="osrd-playwright"

if ! docker ps --format '{{.Names}}' | grep -wq "$CONTAINER_NAME"; then
  echo "Error: Container '$CONTAINER_NAME' is not running."
  exit 1
fi

if ! docker exec "$CONTAINER_NAME" test -f /tmp/ready; then
  echo "Error: Container '$CONTAINER_NAME' is not ready."
  exit 1
fi

# Loop through each argument passed to the scripts, and replace --ui with --ui=host=localhost
args=()
for arg in "$@"; do
  if [ "$arg" = "--ui" ]; then
    args+=("--ui-host=localhost")
  else
    args+=("$arg")
  fi
done

docker exec -u "$(stat -c %u:%g .)" -it $CONTAINER_NAME npx playwright test "${args[@]}"
