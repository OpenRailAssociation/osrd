#!/bin/sh
npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.ts
if [ $? -ne 0 ]; then
    echo "npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.ts command failed. Exit the script"
    exit 1
fi
npm exec eslint -- --fix src/common/api/generatedEditoastApi.ts --no-ignore
npx @rtk-query/codegen-openapi src/config/openapi-gateway-config.ts
if [ $? -ne 0 ]; then
    echo "npx @rtk-query/codegen-openapi src/config/openapi-gateway-config.ts command failed. Exit the script"
    exit 1
fi
npm exec eslint -- --fix src/common/api/osrdGatewayApi.ts --no-ignore
