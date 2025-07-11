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
        'postInfraByInfraIdMatchOperationalPoints',
        'postInfraByInfraIdObjectsAndObjectType',
        'postInfraByInfraIdPathfinding',
        'postInfraByInfraIdPathfindingBlocks',
        'postInfraByInfraIdPathProperties',
        'postPacedTrainSimulationSummary',
        'postPacedTrainProjectPath',
        'postPacedTrainOccupancyBlocks',
        'postTrainScheduleSimulationSummary',
        'postTrainScheduleProjectPath',
        'postTrainScheduleOccupancyBlocks',
        'postWorkSchedulesProjectPath',
      ],
      type: 'query',
    },
  ],
};

exports.default = config;
