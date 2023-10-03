#!/bin/sh
npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.ts
eslint --fix src/common/api/osrdEditoastApi.ts --no-ignore
npx @rtk-query/codegen-openapi src/config/openapi-gateway-config.ts
eslint --fix src/common/api/osrdGatewayApi.ts --no-ignore
