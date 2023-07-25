#! /bin/sh

set -e

cd "$(dirname "$0")/.."

infra_name="${1:-small_infra}"

echo "Loading $infra_name"
python3 python/railjson_generator/railjson_generator/scripts/generate.py /tmp/generated_infras/
docker cp "/tmp/generated_infras/${infra_name}/infra.json" osrd-api:/tmp/infra.json
docker exec osrd-api python manage.py import_railjson "${infra_name}" /tmp/infra.json

echo "Generate layers"
docker exec osrd-editoast editoast generate

echo "Loading example rolling stock"
docker cp python/api/static/example_rolling_stock.json osrd-api:/tmp/stock.json
docker exec osrd-api python manage.py import_rolling_stock -f /tmp/stock.json
