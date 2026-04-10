import type {
  LightRollingStockWithLiveries,
  TrainScheduleSimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import { formatPacedTrainWithDetails } from 'modules/timetableItem/helpers/formatTrainScheduleWithDetails';
import type { TrainScheduleWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { mapBy } from 'utils/types';

type SummaryWithCorrespondingTimetableItemId = {
  timetableItemId: number;
  summary: TrainScheduleSimulationSummaryResult;
};

const formatTimetableItemWithDetails = (
  inputs: SummaryWithCorrespondingTimetableItemId,
  rawTimetableItems: Map<number, TimetableItem>,
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
  rawPacedTrainSummaries: Map<number, TrainScheduleSimulationSummaryResult>,
  rawTimetableItems: Map<number, TimetableItem>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<number, TrainScheduleWithDetails> => {
  const trainSchedules: TrainScheduleWithDetails[] = [...rawPacedTrainSummaries].map(
    ([id, pacedTrainSummary]) =>
      formatTimetableItemWithDetails(
        { timetableItemId: id, summary: pacedTrainSummary },
        rawTimetableItems,
        rollingStocks
      )
  );
  return mapBy(trainSchedules, 'id');
};

export default formatTimetableItemSummaries;
