import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';
import { compact } from 'lodash';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RangedValue,
  RollingStock,
  TrainScheduleBase,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { getRollingStockPowerRestrictionsByMode } from 'modules/rollingStock/helpers/powerRestrictions';
import { mmToKm, mToMm } from 'utils/physics';

/**
 * Format power restrictions data to ranges data base on path steps position
 */
export const formatPowerRestrictionRanges = (
  powerRestrictions: NonNullable<TrainScheduleBase['power_restrictions']>,
  path: TrainScheduleBase['path'],
  stepsPathPositions: PathfindingResultSuccess['path_item_positions']
): LayerData<Omit<PowerRestrictionValues, 'handled'>>[] =>
  compact(
    powerRestrictions.map((powerRestriction) => {
      const startStep = path.findIndex((step) => step.id === powerRestriction.from);
      const stopStep = path.findIndex((step) => step.id === powerRestriction.to);
      if (startStep === -1 || stopStep === -1) {
        console.error('Power restriction range not found in path steps.');
        return null;
      }
      return {
        position: {
          start: stepsPathPositions[startStep],
          end: stepsPathPositions[stopStep],
        },
        value: { powerRestriction: powerRestriction.value },
      };
    })
  );

/** Format power restrictions data to be used in simulation results charts */
export const convertPowerRestrictionsAndCheckCompatibility = (
  powerRestrictionRanges: LayerData<Omit<PowerRestrictionValues, 'handled'>>[],
  voltageRanges: RangedValue[],
  rollingStockEffortCurves: RollingStock['effort_curves']['modes']
): LayerData<PowerRestrictionValues>[] => {
  const powerRestrictionsByMode = getRollingStockPowerRestrictionsByMode(rollingStockEffortCurves);

  const restrictionsWithHandled: LayerData<PowerRestrictionValues>[] = [];

  powerRestrictionRanges.forEach(({ position: { start, end }, value: { powerRestriction } }) => {
    // find all the voltage ranges which overlap the powerRestrictionRange
    voltageRanges.forEach(({ begin, end: voltageRangeEnd, value }) => {
      const beginInMm = mToMm(begin);
      const endInMm = mToMm(voltageRangeEnd);

      const restrictionBeginIsInRange = beginInMm <= start && start < endInMm;
      const restrictionEndIsInRange = beginInMm < end! && end! <= endInMm;

      if (restrictionBeginIsInRange || restrictionEndIsInRange) {
        const powerRestrictionForVoltage = powerRestrictionsByMode[value];
        const isHandled =
          !!powerRestrictionForVoltage && powerRestrictionForVoltage.includes(powerRestriction);

        // add the restriction corresponding to the voltage range, format the position to km
        restrictionsWithHandled.push({
          position: { start: mmToKm(start), end: mmToKm(end!) },
          value: { powerRestriction, handled: isHandled },
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
      pathfindingResult.path_item_positions
    );
    const powerRestrictionsWithHandled = convertPowerRestrictionsAndCheckCompatibility(
      powerRestrictionsRanges,
      pathProperties.voltages,
      selectedTrainRollingStock.effort_curves.modes
    );

    return powerRestrictionsWithHandled;
  }
  return undefined;
};

export default formatPowerRestrictionRangesWithHandled;
