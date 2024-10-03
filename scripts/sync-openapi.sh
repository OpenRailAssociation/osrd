#!/bin/sh

set -e

root_path="$(realpath "$(dirname "$0")"/..)"

echo "Generating editoast's openapi"
( cd "${root_path}/editoast" && cargo run openapi > "${root_path}"/editoast/openapi.yaml )

echo "Generating the typescript client"
npm run --cwd "${root_path}"/front generate-types
