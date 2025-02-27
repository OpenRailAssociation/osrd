import type { TFunction } from 'i18next';

import { preparePathPropertiesData } from 'applications/operationalStudies/utils';
import type { StdcmPathProperties, StdcmSuccessResponse } from 'applications/stdcm/types';
import type { TrainScheduleResult, RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import type { SpeedSpaceChartData } from 'modules/simulationResult/types';

const computeChartData = (
  stdcmResponse: StdcmSuccessResponse,
  stdcmTrainResult: TrainScheduleResult,
  t: TFunction,
  rollingStock: RollingStockWithLiveries,
  pathProperties: StdcmPathProperties
): SpeedSpaceChartData => {
  const { simulation, path: pathfindingResult, departure_time: departureTime } = stdcmResponse;
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
    departureTime,
  } as SpeedSpaceChartData;
};

export default computeChartData;
