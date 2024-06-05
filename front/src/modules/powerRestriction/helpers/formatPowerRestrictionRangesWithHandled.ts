import { compact } from 'lodash';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RangedValue,
  RollingStock,
  SimulationPowerRestrictionRange,
  TrainScheduleBase,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { getRollingStockPowerRestrictionsByMode } from 'modules/rollingStock/helpers/powerRestrictions';
import { mToMm, mmToM } from 'utils/physics';

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

/** Format power restrictions data to be used in simulation results charts */
export const addHandledToPowerRestrictions = (
  powerRestrictionRanges: Omit<SimulationPowerRestrictionRange, 'handled'>[],
  voltageRanges: RangedValue[],
  rollingStockEffortCurves: RollingStock['effort_curves']['modes']
): SimulationPowerRestrictionRange[] => {
  const powerRestrictionsByMode = getRollingStockPowerRestrictionsByMode(rollingStockEffortCurves);

  const restrictionsWithHandled: SimulationPowerRestrictionRange[] = [];

  powerRestrictionRanges.forEach((powerRestrictionRange) => {
    const powerRestrictionBeginInMm = mToMm(powerRestrictionRange.start);
    const powerRestrictionEndInMm = mToMm(powerRestrictionRange.stop);

    // find all the voltage ranges which overlap the powerRestrictionRange
    voltageRanges.forEach((voltageRange) => {
      const restrictionBeginIsInRange =
        voltageRange.begin <= powerRestrictionBeginInMm &&
        powerRestrictionBeginInMm < voltageRange.end;
      const restrictionEndIsInRange =
        voltageRange.begin < powerRestrictionEndInMm && powerRestrictionEndInMm <= voltageRange.end;

      if (restrictionBeginIsInRange || restrictionEndIsInRange) {
        const powerRestrictionForVoltage = powerRestrictionsByMode[voltageRange.value];
        const isHandled =
          !!powerRestrictionForVoltage &&
          powerRestrictionForVoltage.includes(powerRestrictionRange.code);

        // add the restriction corresponding to the voltage range
        restrictionsWithHandled.push({
          start: restrictionBeginIsInRange
            ? powerRestrictionRange.start
            : mmToM(voltageRange.begin),
          stop: restrictionEndIsInRange ? powerRestrictionRange.stop : mmToM(voltageRange.end),
          code: powerRestrictionRange.code,
          handled: isHandled,
        });
      }
    });
  });
  return restrictionsWithHandled;
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
      pathProperties.voltages,
      selectedTrainRollingStock.effort_curves.modes
    );

    return powerRestrictionsWithHandled;
  }
  return null;
};

export default formatPowerRestrictionRangesWithHandled;
