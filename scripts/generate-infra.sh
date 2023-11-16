#!/bin/sh

# This script should be compatible with MSYS, the compatibility layer used by
# Git for Windows. Absolute paths which should not be converted to windows paths
# have to start with //, see https://github.com/git-for-windows/git/issues/1387
# On windows, docker cp does not like leading double / on the container path.
# As a workaround, use relative paths: container:tmp/foo instead of container://tmp/foo

set -e

cd "$(dirname "$0")/.."

infra_name="${1:-small_infra}"

echo "Loading $infra_name"
python3 python/railjson_generator/railjson_generator/scripts/generate.py /tmp/generated_infras/
docker cp "/tmp/generated_infras/${infra_name}/infra.json" osrd-editoast:tmp/infra.json
docker exec osrd-editoast editoast infra import-railjson "${infra_name}" //tmp/infra.json

echo "Generate layers"
docker exec osrd-editoast editoast infra generate

echo "Loading example rolling stock"
docker cp editoast/src/tests/example_rolling_stock_1.json osrd-editoast:tmp/stock.json
docker exec osrd-editoast editoast import-rolling-stock //tmp/stock.json
