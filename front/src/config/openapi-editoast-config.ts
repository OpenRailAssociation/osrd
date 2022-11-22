import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../editoast/openapi.yaml',
  apiFile: '../common/api/emptyApi.ts',
  apiImport: 'emptySplitApi',
  outputFile: '../common/api/osrdEditoastApi.ts',
  exportName: 'osrdEditoastApi',
  hooks: false,
};

export default config;
