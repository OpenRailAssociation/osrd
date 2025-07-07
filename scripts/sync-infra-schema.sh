#!/usr/bin/env bash

set -euo pipefail

OSRD_SCHEMA_DIR="$(realpath "$(dirname "$0")/../python/osrd_schemas")"
FRONT_DIR="$(realpath "$(dirname "$0")/../front")"

echo "Syncing osrd_schemas python dependencies"
uv --directory "$OSRD_SCHEMA_DIR" sync

echo "Generating the infra json schema"
uv --directory "$OSRD_SCHEMA_DIR" run python -m osrd_schemas.infra_editor >"$FRONT_DIR/src/reducers/osrdconf/infra_schema.json"

echo "Extracting the infra editor English translations"
uv --directory "$OSRD_SCHEMA_DIR" run python -m osrd_schemas.infra_editor --translation >"$FRONT_DIR/public/locales/en/infraEditor.json"
