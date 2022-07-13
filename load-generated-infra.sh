#! /bin/sh

set -e

cd $(dirname $0)
infra_name=${1:-tiny_infra}
echo loading $infra_name
python3 core/examples/generated/generate.py /tmp/generated_infras/
docker cp "/tmp/generated_infras/${infra_name}/infra.json" osrd-api:/tmp/infra.json
docker cp api/static/example_rolling_stock.json osrd-api:/tmp/stock.json
docker exec osrd-api python manage.py import_railjson "${infra_name}" /tmp/infra.json
docker exec osrd-api python manage.py import_rolling_stock /tmp/stock.json
docker exec osrd-editoast editoast generate
