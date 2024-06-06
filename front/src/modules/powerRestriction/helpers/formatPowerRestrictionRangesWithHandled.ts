import { compact } from 'lodash';

import type {
  ElectrificationRangeV2,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RollingStock,
  SimulationPowerRestrictionRange,
  TrainScheduleBase,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { getRollingStockPowerRestrictionsByMode } from 'modules/rollingStock/helpers/powerRestrictions';
import { mmToM } from 'utils/physics';

/**
 * Format power restrictions data to ranges data base on path steps position
 */
export const formatPowerRestrictionRanges = (
  powerRestrictions: NonNullable<TrainScheduleBase['power_restrictions']>,
  path: TrainScheduleBase['path'],
  stepsPathPositions: PathfindingResultSuccess['path_items_positions']
): Omit<SimulationPowerRestrictionRange, 'handled'>[] =>
  compact(
    powerRestrictions.map((powerRestriction) => {
      const startStep = path.findIndex((step) => step.id === powerRestriction.from);
      const stopStep = path.findIndex((step) => step.id === powerRestriction.to);
      if (startStep === -1 || stopStep === -1) {
        console.error('Power restriction range not found in path steps.');
        return null;
      }
      return {
        start: mmToM(stepsPathPositions[startStep]),
        stop: mmToM(stepsPathPositions[stopStep]),
        code: powerRestriction.value,
      };
    })
  );

/**
 * Format power restrictions data to be used in simulation results charts
 */
export const addHandledToPowerRestrictions = (
  powerRestrictionRanges: Omit<SimulationPowerRestrictionRange, 'handled'>[],
  electrificationRanges: ElectrificationRangeV2[],
  rollingStockEffortCurves: RollingStock['effort_curves']['modes']
): SimulationPowerRestrictionRange[] => {
  const powerRestrictionsByMode = getRollingStockPowerRestrictionsByMode(rollingStockEffortCurves);

  return powerRestrictionRanges.map((powerRestrictionRange) => {
    const foundElectrificationRange = electrificationRanges.find(
      (electrificationRange) =>
        electrificationRange.start <= powerRestrictionRange.start &&
        electrificationRange.stop >= powerRestrictionRange.stop
    );

    let isHandled = false;
    if (
      foundElectrificationRange &&
      foundElectrificationRange.electrificationUsage.type === 'electrification' &&
      powerRestrictionsByMode[foundElectrificationRange.electrificationUsage.voltage]
    ) {
      isHandled = powerRestrictionsByMode[
        foundElectrificationRange.electrificationUsage.voltage
      ].includes(powerRestrictionRange.code);
    }

    return {
      ...powerRestrictionRange,
      handled: isHandled,
    };
  });
};

const formatPowerRestrictionRangesWithHandled = ({
  selectedTrainSchedule,
  selectedTrainRollingStock,
  pathfindingResult,
  pathProperties,
}: {
  selectedTrainSchedule?: TrainScheduleResult;
  selectedTrainRollingStock?: RollingStock;
  pathfindingResult: PathfindingResultSuccess;
  pathProperties: PathPropertiesFormatted;
}) => {
  if (
    selectedTrainSchedule &&
    selectedTrainSchedule.power_restrictions &&
    selectedTrainRollingStock
  ) {
    const powerRestrictionsRanges = formatPowerRestrictionRanges(
      selectedTrainSchedule.power_restrictions,
      selectedTrainSchedule.path,
      pathfindingResult.path_items_positions
    );
    const powerRestrictionsWithHandled = addHandledToPowerRestrictions(
      powerRestrictionsRanges,
      pathProperties.electrifications,
      selectedTrainRollingStock.effort_curves.modes
    );

    return powerRestrictionsWithHandled;
  }
  return null;
};

export default formatPowerRestrictionRangesWithHandled;
