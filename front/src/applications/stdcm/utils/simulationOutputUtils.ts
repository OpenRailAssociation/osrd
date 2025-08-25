import type {
  StdcmSimulationOutputs,
  StdcmSuccessResponse,
  StdcmPathProperties,
} from 'applications/stdcm/types';
import type { Conflict } from 'common/api/osrdEditoastApi';
import type { SpeedDistanceDiagramData } from 'modules/simulationResult/types';

export const hasResults = (
  outputs?: StdcmSimulationOutputs
): outputs is {
  pathProperties: StdcmPathProperties;
  results: StdcmSuccessResponse;
  speedDistanceDiagramData: SpeedDistanceDiagramData;
} => !!outputs && 'results' in outputs;

export const hasConflicts = (
  outputs?: StdcmSimulationOutputs
): outputs is { pathProperties: StdcmPathProperties; conflicts: Conflict[] } =>
  !!outputs && 'conflicts' in outputs;
