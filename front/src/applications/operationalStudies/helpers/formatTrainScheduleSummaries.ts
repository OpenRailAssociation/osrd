import { compact } from 'lodash';

import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type {
  TrainId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';
import { mapBy } from 'utils/types';

import { isScheduledPointsNotHonored, isTooFast } from '../utils';

const formatTrainScheduleSummaries = (
  trainIds: TrainId[],
  rawSummaries: Record<TrainScheduleId, SimulationSummaryResult>,
  rawTrainSchedules: Map<TrainScheduleId, TrainScheduleResultWithTrainId>,
  rollingStocks: LightRollingStockWithLiveries[]
): Map<TrainId, TrainScheduleWithDetails> => {
  const relevantTrainSchedules = compact(
    // TODO Paced train : Adapt this for the add paced train issue : https://github.com/OpenRailAssociation/osrd/issues/10615
    trainIds.map((trainId) => rawTrainSchedules.get(trainId as TrainScheduleId))
  );

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

    const startTime = new Date(trainSchedule.start_time);

    const otherProps =
      trainSummary.status === 'success'
        ? {
            isValid: true,
            arrivalTime: new Date(startTime.getTime() + trainSummary.time),
            duration: new Duration(trainSummary.time),
            pathLength: formatKmValue(trainSummary.length, 'millimeters', 1),
            mechanicalEnergyConsumed: jouleToKwh(trainSummary.energy_consumption, true),
            pathItemTimes: {
              base: trainSummary.path_item_times_base,
              provisional: trainSummary.path_item_times_provisional,
              final: trainSummary.path_item_times_final,
            },
          }
        : {
            isValid: false,
            arrivalTime: null,
            duration: null,
            pathLength: '',
            mechanicalEnergyConsumed: 0,
            invalidReason:
              trainSummary.status === 'pathfinding_not_found' ||
              trainSummary.status === 'pathfinding_input_error'
                ? trainSummary.error_type
                : trainSummary.status,
          };

    return {
      ...trainSchedule,
      trainName: trainSchedule.train_name,
      startTime,
      stopsCount:
        (trainSchedule.schedule?.filter(
          (step) => step.stop_for && Duration.parse(step.stop_for).ms > 0
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
