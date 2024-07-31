import dayjs from 'dayjs';
import { compact } from 'lodash';

import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/TimetableV2/types';
import { formatToIsoDate, isoDateToMs } from 'utils/date';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';
import { ISO8601Duration2sec } from 'utils/timeManipulation';
import { mapBy } from 'utils/types';

import { isScheduledPointsNotHonored, isTooFast } from '../utils';

const formatTrainScheduleSummaries = (
  trainIds: number[],
  rawSummaries: Record<string, SimulationSummaryResult>,
  rawTrainSchedules: Map<number, TrainScheduleResult>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<number, TrainScheduleWithDetails> => {
  const relevantTrainSchedules = compact(trainIds.map((trainId) => rawTrainSchedules.get(trainId)));

  const trainScheduleWithDetails = relevantTrainSchedules.map((trainSchedule) => {
    const rollingStock = rollingStocks.find((rs) => rs.name === trainSchedule.rolling_stock_name);
    const trainSummary = rawSummaries[trainSchedule.id];

    if (!trainSummary) return null;

    let notHonoredReason: TrainScheduleWithDetails['notHonoredReason'];
    if (trainSummary.status === 'success') {
      if (isTooFast(trainSchedule, trainSummary)) notHonoredReason = 'trainTooFast';
      if (isScheduledPointsNotHonored(trainSchedule, trainSummary))
        notHonoredReason = 'scheduleNotHonored';
    }

    const otherProps =
      trainSummary.status === 'success'
        ? {
            isValid: true,
            arrivalTime: formatToIsoDate(
              isoDateToMs(trainSchedule.start_time) + trainSummary.time,
              true
            ),
            duration: trainSummary.time,
            pathLength: formatKmValue(trainSummary.length, 'millimeters', 1),
            mechanicalEnergyConsumed: jouleToKwh(trainSummary.energy_consumption, true),
          }
        : {
            isValid: false,
            arrivalTime: '',
            duration: 0,
            pathLength: '',
            mechanicalEnergyConsumed: 0,
            invalidReason: trainSummary.status,
          };

    return {
      id: trainSchedule.id,
      trainName: trainSchedule.train_name,
      startTime: dayjs(trainSchedule.start_time).format('D/MM/YYYY HH:mm:ss'), // format to time
      stopsCount:
        (trainSchedule.schedule?.filter(
          (step) => step.stop_for && ISO8601Duration2sec(step.stop_for) > 0
        ).length ?? 0) + 1, // +1 to take the final stop (destination) into account
      speedLimitTag: trainSchedule.speed_limit_tag ?? null,
      labels: trainSchedule.labels ?? [],
      rollingStock,
      scheduledPointsNotHonored: notHonoredReason !== undefined,
      notHonoredReason,
      ...otherProps,
    };
  });

  return mapBy(compact(trainScheduleWithDetails), 'id');
};

export default formatTrainScheduleSummaries;
