import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../python/api/openapi.yaml',
  apiFile: '../common/api/emptyApi.ts',
  apiImport: 'baseApi',
  outputFile: '../common/api/osrdMiddlewareApi.ts',
  exportName: 'osrdMiddlewareApi',
  hooks: false,
};

export default config;
