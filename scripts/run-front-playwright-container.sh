#!/usr/bin/env bash

set -e

# Open the base osrd folder, assuming the script is located in osrd/scripts
cd "$(realpath "$(dirname "$0")"/..)"

# Detect the playwright version installed in the front
if ! command -v jq &>/dev/null; then
  echo "Error: jq is not installed. Please install jq using your package manager to continue." >&2
  exit 1
fi
cd front
VERSION=$(npm list --package-lock-only --pattern playwright --json | jq -r '.dependencies["@playwright/test"].version' | sort -u)
if [ "$(echo "$VERSION" | wc -l)" -ne 1 ]; then
  echo "Error: Zero or multiple playwright versions found: $VERSION" >&2
  exit 1
fi
cd ..

# Loop through each argument passed to the scripts, and replace --ui with --ui=host=localhost
args=()
for arg in "$@"; do
  if [ "$arg" = "--ui" ]; then
    args+=("--ui-host=localhost")
  else
    args+=("$arg")
  fi
done

docker build --build-arg PLAYWRIGHT_VERSION=v"$VERSION" -t osrd-playwright:latest -f front/docker/Dockerfile.playwright .

# Create the bind mounted folders if they don't exist, to avoid them being created as root
mkdir -p "$PWD/front/playwright-report"
mkdir -p "$PWD/front/test-results"
mkdir -p "$PWD/front/tests/test-saved-environment"

docker run -it --rm \
  --ipc=host \
  --network=host \
  -v "$PWD/front/playwright-report:/app/front/playwright-report" \
  -v "$PWD/front/test-results:/app/front/test-results" \
  -v "$PWD/front/tests/test-saved-environment:/app/front/tests/test-saved-environment" \
  -u "$(stat -c %u:%g .)" \
  osrd-playwright:latest npx playwright test "${args[@]}"
