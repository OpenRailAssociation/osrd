#!/bin/sh

# This script should be compatible with MSYS, the compatibility layer used by
# Git for Windows. Absolute paths which should not be converted to windows paths
# have to start with //, see https://github.com/git-for-windows/git/issues/1387
# On windows, docker cp does not like leading double / on the container path.
# As a workaround, use relative paths: container:tmp/foo instead of container://tmp/foo

set -eu

infra_name="${1:?missing infrastructure name}"
infra_path="${2:?missing path to RailJSON infrastructure}"

echo "Loading infrastructure $infra_path"
docker cp "${infra_path}" osrd-editoast:tmp/infra.json
docker exec osrd-editoast editoast infra import-railjson -g "${infra_name}" //tmp/infra.json
