#!/bin/sh
npx @rtk-query/codegen-openapi src/config/openapi-middleware-config.ts
npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.ts
eslint --fix src/common/api/osrdMiddlewareApi.ts src/common/api/osrdMiddlewareApi.ts
