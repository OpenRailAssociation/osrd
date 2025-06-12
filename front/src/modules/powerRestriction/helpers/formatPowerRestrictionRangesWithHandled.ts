import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';
import { compact } from 'lodash';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RollingStock,
  TrainSchedule,
} from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';
import { getRollingStockPowerRestrictionsByMode } from 'modules/rollingStock/helpers/powerRestrictions';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { mmToKm, mToMm } from 'utils/physics';

/**
 * Format power restrictions data to ranges data base on path steps position
 */
export const formatPowerRestrictionRanges = (
  powerRestrictions: NonNullable<TrainSchedule['power_restrictions']>,
  path: TrainSchedule['path'],
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
  selectedTimetableItem: { power_restrictions: powerRestrictions, path: pathInput },
  selectedTrainRollingStock,
  pathfindingResult,
  pathProperties,
}: {
  selectedTimetableItem: Pick<TimetableItem, 'path' | 'power_restrictions'>;
  selectedTrainRollingStock?: RollingStock;
  pathfindingResult: PathfindingResultSuccess;
  pathProperties: PathPropertiesFormatted;
}) => {
  if (powerRestrictions && selectedTrainRollingStock) {
    const powerRestrictionsRanges = formatPowerRestrictionRanges(
      powerRestrictions,
      pathInput,
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
