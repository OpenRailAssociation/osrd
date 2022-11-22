import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../chartos/openapi.yaml',
  apiFile: '../common/api/emptyApi.ts',
  apiImport: 'emptySplitApi',
  outputFile: '../common/api/osrdChartosApi.ts',
  exportName: 'osrdChartosApi',
  hooks: false,
};

export default config;
