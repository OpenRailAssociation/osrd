import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/components/Timetable/types';
import {
  formatPacedTrainWithDetails,
  formatTrainScheduleWithDetails,
} from 'modules/timetableItem/helpers/formatTimetableItemWithDetails';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
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
    return isPacedTrainResponseWithPacedTrainId(timetableItem)
      ? formatPacedTrainWithDetails(timetableItem, rollingStock, timetableItemSummary)
      : formatTrainScheduleWithDetails(timetableItem, rollingStock, timetableItemSummary);
  });

  return mapBy(items, 'id');
};

export default formatTimetableItemSummaries;
