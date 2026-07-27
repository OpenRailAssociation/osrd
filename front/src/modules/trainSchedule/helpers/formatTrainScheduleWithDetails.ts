import {
  isTooFast,
  isScheduledPointsNotHonored,
  intermediateStopsCount,
} from 'applications/operationalStudies/utils';
import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
  TimetableType,
  TrainScheduleSimulationSummaryResult,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type {
  SimulatedException,
  SimulationSummary,
  TrainScheduleWithDetails,
} from 'modules/trainSchedule/types';
import { Duration } from 'utils/duration';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';

const extractInvalidReason = (summary: Exclude<SimulationSummaryResult, { status: 'success' }>) =>
  summary.status === 'pathfinding_not_found' || summary.status === 'pathfinding_input_error'
    ? summary.error_type
    : summary.status;

const formatSuccessfulSummary = (
  summary: Extract<SimulationSummaryResult, { status: 'success' }>
): SimulationSummary => {
  let notHonoredReason: Extract<
    NonNullable<TrainScheduleWithDetails['summary']>,
    { isValid: true }
  >['notHonoredReason'];
  if (isTooFast(summary)) notHonoredReason = 'trainTooFast';
  if (isScheduledPointsNotHonored(summary)) notHonoredReason = 'scheduleNotHonored';
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
    pathItemRespect: {
      margins: summary.path_item_respect_margins,
      times: summary.path_item_respect_times,
    },
  };
};

const formatSummary = (summary?: SimulationSummaryResult): SimulationSummary | undefined => {
  if (!summary) {
    return undefined;
  }
  return summary.status === 'success'
    ? formatSuccessfulSummary(summary)
    : { isValid: false, invalidReason: extractInvalidReason(summary) };
};

/**
 * Convert a start time received from the backend (a number of ms) according to the
 * timetable type: elapsed ms since 1970-01-01T00:00:00Z (a Date) for calendar
 * timetables, elapsed ms since the timetable start (a Duration) for hourly
 * timetables.
 */
export const parseStartTime = (startTime: number, timetableType: TimetableType) =>
  timetableType === 'HOURLY' ? new Duration({ milliseconds: startTime }) : new Date(startTime);

const extractBaseTrainScheduleProps = (
  trainSchedule: TrainScheduleResponse,
  timetableType: TimetableType
) => ({
  name: trainSchedule.train_name,
  startTime: parseStartTime(trainSchedule.start_time, timetableType),
  stopsCount: intermediateStopsCount(trainSchedule),
  rollingStockName: trainSchedule.rolling_stock_name,
  speedLimitTag: trainSchedule.speed_limit_tag ?? null,
  labels: trainSchedule.labels ?? [],
});

export const formatTrainScheduleWithDetails = (
  trainSchedule: TrainScheduleResponse,
  timetableType: TimetableType,
  rollingStock?: LightRollingStockWithLiveries,
  trainScheduleSummary?: TrainScheduleSimulationSummaryResult
): TrainScheduleWithDetails => {
  // we omit the following props since they're not expected in TrainScheduleWithDetails
  const {
    train_name: _,
    start_time: __,
    speed_limit_tag: ___,
    paced,
    ...trainScheduleProps
  } = trainSchedule;

  if (!paced) {
    if (timetableType === 'HOURLY') {
      throw new Error('An hourly timetable cannot contain unique trains');
    }
    return {
      ...trainScheduleProps,
      ...extractBaseTrainScheduleProps(trainSchedule, timetableType),
      rollingStock,
      summary: formatSummary(trainScheduleSummary?.train_schedule),
    };
  }

  let simulatedExceptions: SimulatedException[] = [];
  if (trainScheduleSummary) {
    paced.exceptions.forEach((exception) => {
      // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
      const simulationSummary = trainScheduleSummary.exceptions[exception.id!];

      let summary: SimulationSummary | undefined;
      if (simulationSummary) {
        summary =
          simulationSummary.status === 'success'
            ? formatSuccessfulSummary(simulationSummary)
            : { isValid: false, invalidReason: extractInvalidReason(simulationSummary) };
      }

      simulatedExceptions.push({
        ...exception,
        summary,
      });
    });
  } else {
    simulatedExceptions = paced.exceptions;
  }

  return {
    ...trainScheduleProps,
    ...extractBaseTrainScheduleProps(trainSchedule, timetableType),
    rollingStock,
    paced: {
      timeWindow: Duration.parse(paced.time_window),
      interval: Duration.parse(paced.interval),
      exceptions: simulatedExceptions,
    },
    summary: formatSummary(trainScheduleSummary?.train_schedule),
  };
};
