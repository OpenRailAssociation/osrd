#!/bin/sh
if ! npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.json; then
    echo "npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.json command failed. Exit the script"
    exit 1
fi
if ! npx @rtk-query/codegen-openapi src/config/openapi-gateway-config.json; then
    echo "npx @rtk-query/codegen-openapi src/config/openapi-gateway-config.json command failed. Exit the script"
    exit 1
fi
if ! npx @rtk-query/codegen-openapi src/config/openapi-railway-manager-interface-config.json; then
    echo "npx @rtk-query/codegen-openapi src/config/openapi-railway-manager-interface-config.json command failed. Exit the script"
    exit 1
fi
npx oxfmt src/common/api/ --write
