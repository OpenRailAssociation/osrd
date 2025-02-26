import { compact } from 'lodash';

import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type {
  PacedTrainWithDetails,
  TimetableItemWithDetails,
  TrainScheduleWithDetails,
} from 'modules/trainschedule/components/Timetable/types';
import type { TimetableItemId, TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';
import { isPacedTrainResultWithPacedTrainId } from 'utils/trainId';
import { mapBy } from 'utils/types';

import { isScheduledPointsNotHonored, isTooFast } from '../utils';

/**
 * This function formats the timetable items with their simulation summaries.
 * Mapping the simulation results to the timetable items needs to be done in a second part
 * because otherwise typescript doesn't understand that a PacedTrainWithDetails will necessarily
 * be mapped with a PacedTrainId and not a TrainScheduleId (same for TrainScheduleWithDetails)
 */
const formatTimetableItemSummaries = (
  timetableItemIds: TimetableItemId[],
  rawSummaries: Map<TimetableItemId, SimulationSummaryResult>,
  rawTimetableItems: Map<TimetableItemId, TimetableItemWithTimetableId>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<TimetableItemId, TimetableItemWithDetails> => {
  const relevantTimetableItems = compact(
    timetableItemIds.map((timetableItemId) => rawTimetableItems.get(timetableItemId))
  );

  const [trainScheduleWithDetails, pacedTrainWithDetails] = relevantTimetableItems.reduce<
    [TrainScheduleWithDetails[], PacedTrainWithDetails[]]
  >(
    (acc, timetableItem) => {
      const rollingStock = rollingStocks.find((rs) => rs.name === timetableItem.rolling_stock_name);

      const timetableItemSummary = rawSummaries.get(timetableItem.id);

      if (!timetableItemSummary) return acc;

      let notHonoredReason: TimetableItemWithDetails['notHonoredReason'];
      if (timetableItemSummary.status === 'success') {
        if (isTooFast(timetableItem, timetableItemSummary)) notHonoredReason = 'trainTooFast';
        if (isScheduledPointsNotHonored(timetableItem, timetableItemSummary))
          notHonoredReason = 'scheduleNotHonored';
      }

      const startTime = new Date(timetableItem.start_time);

      const otherProps =
        timetableItemSummary.status === 'success'
          ? {
              isValid: true,
              arrivalTime: new Date(startTime.getTime() + timetableItemSummary.time),
              duration: new Duration({ milliseconds: timetableItemSummary.time }),
              pathLength: formatKmValue(timetableItemSummary.length, 'millimeters', 1),
              mechanicalEnergyConsumed: jouleToKwh(timetableItemSummary.energy_consumption, true),
              pathItemTimes: {
                base: timetableItemSummary.path_item_times_base,
                provisional: timetableItemSummary.path_item_times_provisional,
                final: timetableItemSummary.path_item_times_final,
              },
            }
          : {
              isValid: false,
              arrivalTime: null,
              duration: null,
              pathLength: '',
              mechanicalEnergyConsumed: 0,
              invalidReason:
                timetableItemSummary.status === 'pathfinding_not_found' ||
                timetableItemSummary.status === 'pathfinding_input_error'
                  ? timetableItemSummary.error_type
                  : timetableItemSummary.status,
            };

      const formattedItem = {
        ...timetableItem,
        name: timetableItem.train_name,
        startTime,
        stopsCount:
          (timetableItem.schedule?.filter(
            (step) => step.stop_for && Duration.parse(step.stop_for).ms > 0
          ).length ?? 0) + 1, // +1 to take the final stop (destination) into account
        speedLimitTag: timetableItem.speed_limit_tag ?? null,
        labels: timetableItem.labels ?? [],
        rollingStock,
        scheduledPointsNotHonored: notHonoredReason !== undefined,
        notHonoredReason,
        ...otherProps,
      };

      if (isPacedTrainResultWithPacedTrainId(formattedItem)) {
        const formattedPacedTrains = {
          ...formattedItem,
          paced: {
            duration: Duration.parse(formattedItem.paced.duration),
            step: Duration.parse(formattedItem.paced.step),
          },
        } as PacedTrainWithDetails;
        acc[1].push(formattedPacedTrains);
      } else {
        acc[0].push(formattedItem as TrainScheduleWithDetails);
      }
      return acc;
    },
    [[], []]
  );

  const mappedTrainSchedules = mapBy(trainScheduleWithDetails, 'id');
  const mappedPacedTrains = mapBy(pacedTrainWithDetails, 'id');

  return new Map<TimetableItemId, TimetableItemWithDetails>([
    ...mappedTrainSchedules,
    ...mappedPacedTrains,
  ]);
};

export default formatTimetableItemSummaries;
