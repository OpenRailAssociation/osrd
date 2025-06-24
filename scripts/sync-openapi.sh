#!/bin/sh

set -eu

root_path="$(realpath "$(dirname "$0")"/..)"

echo "Generating editoast's openapi"
( cd "${root_path}/editoast" && cargo run openapi > "${root_path}"/editoast/openapi.yaml )

echo "Generating the typescript client"
( cd "${root_path}"/front && npm run generate-types )
