#! /bin/sh

set -e

cd "$(dirname "$0")/.."

infra_name="${1:-small_infra}"

echo "Loading $infra_name"
python3 python/railjson_generator/railjson_generator/scripts/generate.py /tmp/generated_infras/
docker cp "/tmp/generated_infras/${infra_name}/infra.json" osrd-editoast:/tmp/infra.json
docker exec osrd-editoast editoast import-railjson "${infra_name}" /tmp/infra.json

echo "Generate layers"
docker exec osrd-editoast editoast generate

echo "Loading example rolling stock"
docker cp editoast/src/tests/example_rolling_stock_1.json osrd-editoast:/tmp/stock.json
docker exec osrd-editoast editoast import-rolling-stock /tmp/stock.json
