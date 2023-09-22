#!/bin/sh

while getopts ":o" opt; do
  case $opt in
    o)
      echo "\nGenerating editoast openapi" >&2
      cd ../editoast
      cargo run openapi > openapi.yaml
      cd ../front
      echo "Done"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

echo ""

npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.ts

echo "\nLinting osrdEditoastApi.ts"
eslint --fix src/common/api/osrdEditoastApi.ts --no-ignore
echo "Done\n"

