import type { ConfigFile } from '@rtk-query/codegen-openapi';

const config: ConfigFile = {
  schemaFile: '../../../editoast/openapi.yaml',
  apiFile: '../common/api/baseGeneratedApis.ts',
  apiImport: 'baseEditoastApi',
  outputFile: '../common/api/generatedEditoastApi.ts',
  exportName: 'generatedEditoastApi',
  hooks: false,
  tag: true,
  useUnknown: true,
  endpointOverrides: [
    {
      pattern: [
        'postWorkerLoad',
        'postInfraByInfraIdMatchOperationalPoints',
        'postInfraByInfraIdObjectsAndObjectType',
        'postInfraByInfraIdPathfinding',
        'postInfraByInfraIdPathfindingBlocks',
        'postInfraByInfraIdPathProperties',
        'postPacedTrainSimulationSummary',
        'postPacedTrainProjectPath',
        'postPacedTrainProjectPathOp',
        'postPacedTrainOccupancyBlocks',
        'postTrainScheduleSimulationSummary',
        'postTrainScheduleProjectPath',
        'postTrainScheduleProjectPathOp',
        'postTrainScheduleOccupancyBlocks',
        'postWorkSchedulesProjectPath',
      ],
      type: 'query',
    },
  ],
};

exports.default = config;
