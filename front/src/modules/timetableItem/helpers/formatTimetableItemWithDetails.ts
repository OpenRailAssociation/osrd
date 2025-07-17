import { isTooFast, isScheduledPointsNotHonored } from 'applications/operationalStudies/utils';
import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type {
  TimetableItemWithDetails,
  SimulationSummary,
} from 'modules/timetableItem/components/Timetable/types';
import type {
  PacedTrainWithPacedTrainId,
  TimetableItem,
  TrainScheduleWithTrainId,
} from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';

const formatSummary = (
  timetableItem: TimetableItem,
  summary?: SimulationSummaryResult
): SimulationSummary | undefined => {
  // not loaded
  if (!summary) {
    return undefined;
  }

  // invalid train
  if (summary.status !== 'success')
    return {
      isValid: false,
      invalidReason:
        summary.status === 'pathfinding_not_found' || summary.status === 'pathfinding_input_error'
          ? summary.error_type
          : summary.status,
    };

  // valid train
  let notHonoredReason: Extract<
    NonNullable<TimetableItemWithDetails['summary']>,
    { isValid: true }
  >['notHonoredReason'];
  if (isTooFast(timetableItem, summary)) notHonoredReason = 'trainTooFast';
  if (isScheduledPointsNotHonored(timetableItem, summary)) notHonoredReason = 'scheduleNotHonored';
  return {
    isValid: true,
    duration: new Duration({ milliseconds: summary.time }),
    pathLength: formatKmValue(summary.length, 'millimeters', 1),
    mechanicalEnergyConsumed: jouleToKwh(summary.energy_consumption, true),
    notHonoredReason,
    pathItemTimes: {
      base: summary.path_item_times_base,
      provisional: summary.path_item_times_provisional,
      final: summary.path_item_times_final,
    },
  };
};

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
  rollingStock?: LightRollingStockWithLiveries,
  summary?: SimulationSummaryResult
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
    summary: formatSummary(trainSchedule, summary),
  };
};

export const formatPacedTrainWithDetails = (
  pacedTrain: PacedTrainWithPacedTrainId,
  rollingStock?: LightRollingStockWithLiveries,
  pacedTrainSummary?: SimulationSummaryResult
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
    summary: formatSummary(pacedTrain, pacedTrainSummary),
  };
};
