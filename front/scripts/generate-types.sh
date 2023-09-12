#!/bin/sh
npx @rtk-query/codegen-openapi src/config/openapi-editoast-config.ts
eslint --fix src/common/api/osrdEditoastApi.ts --no-ignore
