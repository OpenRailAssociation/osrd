import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../editoast/openapi.yaml',
  apiFile: '../common/api/baseGeneratedApis.ts',
  apiImport: 'baseEditoastApi',
  outputFile: '../common/api/generatedEditoastApi.ts',
  exportName: 'generatedEditoastApi',
  hooks: false,
  tag: true,
  endpointOverrides: [
    {
      pattern: [
        'postV2TrainSchedule',
        'postV2TrainScheduleSimulationSummary',
        'postV2TrainScheduleProjectPath',
      ],
      type: 'query',
    },
  ],
};

export default config;
