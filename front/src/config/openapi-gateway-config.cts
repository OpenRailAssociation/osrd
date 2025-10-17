import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../gateway/openapi.yaml',
  apiFile: '../common/api/baseGeneratedApis.ts',
  apiImport: 'baseGatewayApi',
  outputFile: '../common/api/osrdGatewayApi.ts',
  exportName: 'osrdGatewayApi',
  hooks: false,
  tag: true,
  useUnknown: true,
};

exports.default = config;
