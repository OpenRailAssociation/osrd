import type {
  LightRollingStockWithLiveries,
  TrainScheduleSimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import { formatPacedTrainWithDetails } from 'modules/trainSchedule/helpers/formatTrainScheduleWithDetails';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { mapBy } from 'utils/types';

type SummaryWithCorrespondingTrainScheduleId = {
  trainScheduleId: number;
  summary: TrainScheduleSimulationSummaryResult;
};

const formatTrainScheduleWithDetails = (
  inputs: SummaryWithCorrespondingTrainScheduleId,
  rawTrainSchedules: Map<number, TimetableItem>,
  rollingStocks: LightRollingStockWithLiveries[]
) => {
  const trainSchedule = rawTrainSchedules.get(inputs.trainScheduleId);
  if (!trainSchedule) {
    throw new Error('Missing train schedule');
  }
  const rollingStock = rollingStocks.find((rs) => rs.name === trainSchedule.rolling_stock_name);
  return formatPacedTrainWithDetails(trainSchedule, rollingStock, inputs.summary);
};

/** Format the train schedules with their simulation summaries */
const formatTrainScheduleSummaries = (
  rawPacedTrainSummaries: Map<number, TrainScheduleSimulationSummaryResult>,
  rawTrainSchedules: Map<number, TimetableItem>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<number, TrainScheduleWithDetails> => {
  const trainSchedules: TrainScheduleWithDetails[] = [...rawPacedTrainSummaries].map(
    ([id, pacedTrainSummary]) =>
      formatTrainScheduleWithDetails(
        { trainScheduleId: id, summary: pacedTrainSummary },
        rawTrainSchedules,
        rollingStocks
      )
  );
  return mapBy(trainSchedules, 'id');
};

export default formatTrainScheduleSummaries;
