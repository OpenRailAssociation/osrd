import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/components/Timetable/types';
import type {
  PacedTrainWithPacedTrainId,
  TimetableItem,
  TrainScheduleWithTrainId,
} from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

const extractBaseTimetableItemProps = (timetableItem: TimetableItem) => ({
  name: timetableItem.train_name,
  startTime: new Date(timetableItem.start_time),
  stopsCount:
    (timetableItem.schedule?.filter((step) => step.stop_for && Duration.parse(step.stop_for).ms > 0)
      .length ?? 0) + 1, // +1 to take the final stop (destination) into account
  speedLimitTag: timetableItem.speed_limit_tag ?? null,
  labels: timetableItem.labels ?? [],
});

export const formatTrainScheduleWithDetails = (
  trainSchedule: TrainScheduleWithTrainId,
  rollingStock?: LightRollingStockWithLiveries
): TimetableItemWithDetails => {
  // we omit the following props since they're not expected in TimetableItemWithDetails
  const {
    train_name: _,
    start_time: __,
    speed_limit_tag: ___,
    rolling_stock_name: ____,
    ...trainScheduleProps
  } = trainSchedule;

  return {
    ...trainScheduleProps,
    ...extractBaseTimetableItemProps(trainSchedule),
    rollingStock,
  };
};

export const formatPacedTrainWithDetails = (
  pacedTrain: PacedTrainWithPacedTrainId,
  rollingStock?: LightRollingStockWithLiveries
): TimetableItemWithDetails => {
  // we omit the following props since they're not expected in TimetableItemWithDetails
  const {
    train_name: _,
    start_time: __,
    speed_limit_tag: ___,
    rolling_stock_name: ____,
    paced,
    ...pacedTrainProps
  } = pacedTrain;

  return {
    ...pacedTrainProps,
    ...extractBaseTimetableItemProps(pacedTrain),
    rollingStock,
    paced: {
      timeWindow: Duration.parse(paced.time_window),
      interval: Duration.parse(paced.interval),
    },
  };
};
