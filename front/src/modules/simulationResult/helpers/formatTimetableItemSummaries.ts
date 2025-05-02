import { isScheduledPointsNotHonored, isTooFast } from 'applications/operationalStudies/utils';
import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import formatBaseTimetableItemWithDetails from 'modules/trainschedule/helpers/formatBaseTimetableItemWithDetails';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';
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

    let notHonoredReason: TimetableItemWithDetails['notHonoredReason'];
    if (timetableItemSummary.status === 'success') {
      if (isTooFast(timetableItem, timetableItemSummary)) notHonoredReason = 'trainTooFast';
      if (isScheduledPointsNotHonored(timetableItem, timetableItemSummary))
        notHonoredReason = 'scheduleNotHonored';
    }

    const baseItem = formatBaseTimetableItemWithDetails(timetableItem, rollingStocks);
    return {
      ...baseItem,
      scheduledPointsNotHonored: notHonoredReason !== undefined,
      notHonoredReason,
      ...(timetableItemSummary.status === 'success'
        ? {
            isValid: true,
            arrivalTime: new Date(baseItem.startTime.getTime() + timetableItemSummary.time),
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
          }),
    };
  });

  return mapBy(items, 'id');
};

export default formatTimetableItemSummaries;
