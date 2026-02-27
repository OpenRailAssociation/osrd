import type {
  LightRollingStockWithLiveries,
  TrainScheduleSimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import { formatPacedTrainWithDetails } from 'modules/timetableItem/helpers/formatTimetableItemWithDetails';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItemId, TimetableItem, PacedTrainId } from 'reducers/osrdconf/types';
import { mapBy } from 'utils/types';

type SummaryWithCorrespondingTimetableItemId = {
  timetableItemId: PacedTrainId;
  summary: TrainScheduleSimulationSummaryResult;
};

const formatTimetableItemWithDetails = (
  inputs: SummaryWithCorrespondingTimetableItemId,
  rawTimetableItems: Map<TimetableItemId, TimetableItem>,
  rollingStocks: LightRollingStockWithLiveries[]
) => {
  const timetableItem = rawTimetableItems.get(inputs.timetableItemId);
  if (!timetableItem) {
    throw new Error('Missing timetable item');
  }
  const rollingStock = rollingStocks.find((rs) => rs.name === timetableItem.rolling_stock_name);
  return formatPacedTrainWithDetails(timetableItem, rollingStock, inputs.summary);
};

/** Format the timetable items with their simulation summaries */
const formatTimetableItemSummaries = (
  rawPacedTrainSummaries: Map<PacedTrainId, TrainScheduleSimulationSummaryResult>,
  rawTimetableItems: Map<TimetableItemId, TimetableItem>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<TimetableItemId, TimetableItemWithDetails> => {
  const items: TimetableItemWithDetails[] = [...rawPacedTrainSummaries].map(
    ([id, pacedTrainSummary]) =>
      formatTimetableItemWithDetails(
        { timetableItemId: id, summary: pacedTrainSummary },
        rawTimetableItems,
        rollingStocks
      )
  );
  return mapBy(items, 'id');
};

export default formatTimetableItemSummaries;
