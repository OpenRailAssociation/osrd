import type {
  LightRollingStockWithLiveries,
  TrainScheduleSimulationSummaryResult,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { formatTrainScheduleWithDetails } from 'modules/trainSchedule/helpers/formatTrainScheduleWithDetails';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { mapBy } from 'utils/types';

/** Format the train schedules with their simulation summaries */
const formatTrainScheduleSummaries = (
  rawTrainScheduleSummaries: Map<number, TrainScheduleSimulationSummaryResult>,
  rawTrainSchedules: Map<number, TrainScheduleResponse>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<number, TrainScheduleWithDetails> => {
  const trainSchedules: TrainScheduleWithDetails[] = [...rawTrainScheduleSummaries].map(
    ([id, trainScheduleSummary]) => {
      const trainSchedule = rawTrainSchedules.get(id);
      if (!trainSchedule) {
        throw new Error('Missing train schedule');
      }
      const rollingStock = rollingStocks.find((rs) => rs.name === trainSchedule.rolling_stock_name);
      return formatTrainScheduleWithDetails(trainSchedule, rollingStock, trainScheduleSummary);
    }
  );
  return mapBy(trainSchedules, 'id');
};

export default formatTrainScheduleSummaries;
