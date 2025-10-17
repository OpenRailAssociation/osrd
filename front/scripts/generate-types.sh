#!/bin/sh
if ! npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.cts; then
    echo "npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.cts command failed. Exit the script"
    exit 1
fi
if ! npx @rtk-query/codegen-openapi src/config/openapi-gateway-config.cts; then
    echo "npx @rtk-query/codegen-openapi src/config/openapi-gateway-config.cts command failed. Exit the script"
    exit 1
fi
