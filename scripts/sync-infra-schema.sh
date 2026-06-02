#!/usr/bin/env bash

set -euo pipefail

OSRD_SCHEMA_DIR="$(realpath "$(dirname "$0")/../osrd_schemas_auto")"
FRONT_DIR="$(realpath "$(dirname "$0")/../front")"

echo "Syncing osrd_schemas_auto python dependencies"
uv --directory "$OSRD_SCHEMA_DIR" sync

echo "Generating the infra json schema"
uv --directory "$OSRD_SCHEMA_DIR" run python -m osrd_schemas_auto.infra_editor >"$FRONT_DIR/src/reducers/osrdconf/infra_schema.json"

echo "Extracting the infra editor English translations"
uv --directory "$OSRD_SCHEMA_DIR" run python -m osrd_schemas_auto.infra_editor --translation >"$FRONT_DIR/public/locales/en/infraEditor.json"
