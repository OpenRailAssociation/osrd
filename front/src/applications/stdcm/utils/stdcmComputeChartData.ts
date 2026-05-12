import type { TFunction } from 'i18next';

import { preparePathPropertiesData } from 'applications/operationalStudies/utils';
import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import type {
  PathProperties,
  RollingStockWithLiveries,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import type { SpeedDistanceDiagramData } from 'modules/simulationResult/types';

const computeChartData = (
  stdcmResponse: StdcmSuccessResponse,
  stdcmTrainResult: Omit<TrainScheduleResponse, 'train_schedule_set_id'>,
  t: TFunction,
  rollingStock: RollingStockWithLiveries,
  pathProperties: PathProperties
): SpeedDistanceDiagramData => {
  const { simulation, pathfinding_result: pathfindingResult } = stdcmResponse;

  const formattedPathProperties = preparePathPropertiesData(
    simulation.electrical_profiles,
    pathProperties,
    pathfindingResult,
    stdcmTrainResult.path,
    t
  );
  const formattedPowerRestrictions = formatPowerRestrictionRangesWithHandled({
    selectedTrainSchedule: stdcmTrainResult,
    selectedTrainRollingStock: rollingStock,
    pathfindingResult,
    pathProperties: formattedPathProperties,
  });
  return {
    rollingStock,
    formattedPowerRestrictions,
    simulation,
    formattedPathProperties,
  };
};

export default computeChartData;
