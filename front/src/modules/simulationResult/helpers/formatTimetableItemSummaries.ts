import type {
  LightRollingStockWithLiveries,
  PacedTrainSimulationSummaryResult,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import {
  formatPacedTrainWithDetails,
  formatTrainScheduleWithDetails,
} from 'modules/timetableItem/helpers/formatTimetableItemWithDetails';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type {
  TimetableItemId,
  TimetableItem,
  TrainScheduleId,
  PacedTrainId,
} from 'reducers/osrdconf/types';
import { isPacedTrainId, isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';
import { mapBy } from 'utils/types';

type SummaryWithCorrespondingTimetableItemId =
  | { timetableItemId: TrainScheduleId; summary: SimulationSummaryResult }
  | { timetableItemId: PacedTrainId; summary: PacedTrainSimulationSummaryResult };

const isPacedTrainInputs = (
  inputs: SummaryWithCorrespondingTimetableItemId
): inputs is Extract<SummaryWithCorrespondingTimetableItemId, { timetableItemId: PacedTrainId }> =>
  isPacedTrainId(inputs.timetableItemId);

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

  if (isPacedTrainResponseWithPacedTrainId(timetableItem) && isPacedTrainInputs(inputs)) {
    return formatPacedTrainWithDetails(timetableItem, rollingStock, inputs.summary);
  }
  if (isPacedTrainInputs(inputs) || isPacedTrainResponseWithPacedTrainId(timetableItem)) {
    throw new Error('Mismatch between timetableItemId and timetableItem');
  }
  return formatTrainScheduleWithDetails(timetableItem, rollingStock, inputs.summary);
};

/** Format the timetable items with their simulation summaries */
const formatTimetableItemSummaries = (
  rawTrainScheduleSummaries: Map<TrainScheduleId, SimulationSummaryResult>,
  rawPacedTrainSummaries: Map<PacedTrainId, PacedTrainSimulationSummaryResult>,
  rawTimetableItems: Map<TimetableItemId, TimetableItem>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<TimetableItemId, TimetableItemWithDetails> => {
  const items: TimetableItemWithDetails[] = [];

  // train schedules
  [...rawTrainScheduleSummaries].forEach(([id, summary]) => {
    const trainScheduleWithDetails = formatTimetableItemWithDetails(
      { timetableItemId: id, summary },
      rawTimetableItems,
      rollingStocks
    );
    items.push(trainScheduleWithDetails);
  });

  // paced trains
  [...rawPacedTrainSummaries].forEach(([id, pacedTrainSummary]) => {
    const pacedTrainWithDetails = formatTimetableItemWithDetails(
      { timetableItemId: id, summary: pacedTrainSummary },
      rawTimetableItems,
      rollingStocks
    );
    items.push(pacedTrainWithDetails);
  });

  return mapBy(items, 'id');
};

export default formatTimetableItemSummaries;
