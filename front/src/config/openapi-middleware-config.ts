import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../api/openapi.yaml',
  apiFile: '../common/api/emptyApi.ts',
  apiImport: 'emptySplitApi',
  outputFile: '../common/api/osrdMiddlewareApi.ts',
  exportName: 'osrdMiddlewareApi',
  hooks: false,
};

export default config;
