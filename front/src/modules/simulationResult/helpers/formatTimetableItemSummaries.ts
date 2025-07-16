import { isScheduledPointsNotHonored, isTooFast } from 'applications/operationalStudies/utils';
import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/components/Timetable/types';
import formatBaseTimetableItemWithDetails from 'modules/timetableItem/helpers/formatBaseTimetableItemWithDetails';
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
    const baseItem = formatBaseTimetableItemWithDetails(timetableItem, rollingStocks);

    if (timetableItemSummary.status !== 'success') {
      return {
        ...baseItem,
        summary: {
          isValid: false,
          invalidReason:
            timetableItemSummary.status === 'pathfinding_not_found' ||
            timetableItemSummary.status === 'pathfinding_input_error'
              ? timetableItemSummary.error_type
              : timetableItemSummary.status,
        },
      };
    }
    let notHonoredReason: Extract<
      NonNullable<TimetableItemWithDetails['summary']>,
      { isValid: true }
    >['notHonoredReason'];
    if (isTooFast(timetableItem, timetableItemSummary)) notHonoredReason = 'trainTooFast';
    if (isScheduledPointsNotHonored(timetableItem, timetableItemSummary))
      notHonoredReason = 'scheduleNotHonored';

    return {
      ...baseItem,
      summary: {
        isValid: true,
        duration: new Duration({ milliseconds: timetableItemSummary.time }),
        pathLength: formatKmValue(timetableItemSummary.length, 'millimeters', 1),
        mechanicalEnergyConsumed: jouleToKwh(timetableItemSummary.energy_consumption, true),
        notHonoredReason,
        pathItemTimes: {
          base: timetableItemSummary.path_item_times_base,
          provisional: timetableItemSummary.path_item_times_provisional,
          final: timetableItemSummary.path_item_times_final,
        },
      },
    };
  });

  return mapBy(items, 'id');
};

export default formatTimetableItemSummaries;
