import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../editoast/openapi.yaml',
  apiFile: '../common/api/emptyApi.ts',
  apiImport: 'baseEditoastApi',
  outputFile: '../common/api/osrdEditoastApi.ts',
  exportName: 'osrdEditoastApi',
  hooks: false,
  tag: true,
};

export default config;
