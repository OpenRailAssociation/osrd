#! /bin/sh

set -e

cd $(dirname $0)
infra_name=${1:-tiny_infra}
echo Loading $infra_name
python3 core/examples/generated/generate.py /tmp/generated_infras/ > /dev/null
docker cp "/tmp/generated_infras/${infra_name}/infra.json" osrd-api:/tmp/infra.json
docker exec osrd-api python manage.py import_railjson "${infra_name}" /tmp/infra.json 2> /dev/null
echo Generate layers
docker exec osrd-editoast editoast generate > /dev/null

echo Loading example rolling stock
docker cp api/static/example_rolling_stock.json osrd-api:/tmp/stock.json
docker exec osrd-api python manage.py import_rolling_stock -f /tmp/stock.json 2> /dev/null
