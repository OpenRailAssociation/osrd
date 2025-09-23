import type { TFunction } from 'i18next';

import { preparePathPropertiesData } from 'applications/operationalStudies/utils';
import type { StdcmPathProperties, StdcmSuccessResponse } from 'applications/stdcm/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import type { SpeedDistanceDiagramData } from 'modules/simulationResult/types';
import type { TimetableItem } from 'reducers/osrdconf/types';

const computeChartData = (
  stdcmResponse: StdcmSuccessResponse,
  stdcmTrainResult: TimetableItem,
  t: TFunction,
  rollingStock: RollingStockWithLiveries,
  pathProperties: StdcmPathProperties
): SpeedDistanceDiagramData => {
  const { simulation, pathfinding_result: pathfindingResult } = stdcmResponse;

  /**
   * TODO:
   * Investigate the following fishy code:
   * - pathProperties is of type **StdcmPathProperties**
   * - preparePathPropertiesData requires a second argument of type **PathProperties**
   * - TypeScript is fine with that, because all keys in PathProperties are optional
   * - StdcmPathProperties and PathProperties have two keys in common (so this code might be on purpose)
   */
  const formattedPathProperties = preparePathPropertiesData(
    simulation.electrical_profiles,
    pathProperties,
    pathfindingResult,
    stdcmTrainResult.path,
    t
  );
  const formattedPowerRestrictions = formatPowerRestrictionRangesWithHandled({
    selectedTimetableItem: stdcmTrainResult,
    selectedTrainRollingStock: rollingStock,
    pathfindingResult,
    pathProperties: formattedPathProperties,
  });
  return {
    rollingStock,
    formattedPowerRestrictions,
    simulation,
    formattedPathProperties,
  } as SpeedDistanceDiagramData;
};

export default computeChartData;
