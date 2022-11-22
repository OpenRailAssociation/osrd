import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../../api/openapi.yaml',
  apiFile: './emptyApi.ts',
  apiImport: 'emptySplitApi',
  outputFile: 'osrdApi.ts',
  exportName: 'osrdApi',
  hooks: false,
};

export default config;
