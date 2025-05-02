import { isScheduledPointsNotHonored, isTooFast } from 'applications/operationalStudies/utils';
import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';
import { isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';
import { mapBy } from 'utils/types';

/**
 * Format the timetable items with their simulation summaries
 */
const formatTimetableItemSummaries = (
  rawSummaries: Map<TimetableItemId, SimulationSummaryResult>,
  rawTimetableItems: Map<TimetableItemId, TimetableItem>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<TimetableItemId, TimetableItemWithDetails> => {
  const items = [...rawSummaries].map(([id, timetableItemSummary]): TimetableItemWithDetails => {
    const timetableItem = rawTimetableItems.get(id);
    if (!timetableItem) {
      throw new Error('Missing timetable item');
    }

    const rollingStock = rollingStocks.find((rs) => rs.name === timetableItem.rolling_stock_name);

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

    if (isPacedTrainResponseWithPacedTrainId(formattedItem)) {
      return {
        ...formattedItem,
        paced: {
          timeWindow: Duration.parse(formattedItem.paced.time_window),
          interval: Duration.parse(formattedItem.paced.interval),
        },
        exceptions: [],
      };
    }
    return formattedItem;
  });

  return mapBy(items, 'id');
};

export default formatTimetableItemSummaries;
