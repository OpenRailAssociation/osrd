import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../railway_manager_interface/openapi.yaml',
  apiFile: '../common/api/baseGeneratedApis.ts',
  apiImport: 'baseRailwayManagerApi',
  outputFile: '../common/api/osrdRailwayManagerApi.ts',
  exportName: 'osrdRailwayManagerApi',
  hooks: false,
  tag: true,
  useUnknown: true,
};

exports.default = config;
