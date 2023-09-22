#!/bin/sh

set -e

root_path="$(realpath "$(dirname "$0")"/..)"

echo "Generating editoast's openapi"
docker run osrd/editoast editoast openapi > "${root_path}"/editoast/openapi.yaml

echo "Generating the typescript client"
yarn --cwd "${root_path}"/front generate-types
