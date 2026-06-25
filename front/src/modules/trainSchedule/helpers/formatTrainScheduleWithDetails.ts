import {
  isTooFast,
  isScheduledPointsNotHonored,
  intermediateStopsCount,
} from 'applications/operationalStudies/utils';
import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
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

const extractBaseTrainScheduleProps = (trainSchedule: TrainScheduleResponse) => ({
  name: trainSchedule.train_name,
  startTime: new Date(trainSchedule.start_time),
  stopsCount: intermediateStopsCount(trainSchedule),
  rollingStockName: trainSchedule.rolling_stock_name,
  speedLimitTag: trainSchedule.speed_limit_tag ?? null,
  labels: trainSchedule.labels ?? [],
});

export const formatPacedTrainWithDetails = (
  pacedTrain: TrainScheduleResponse,
  rollingStock?: LightRollingStockWithLiveries,
  pacedTrainSummary?: TrainScheduleSimulationSummaryResult
): TrainScheduleWithDetails => {
  // we omit the following props since they're not expected in TrainScheduleWithDetails
  const {
    train_name: _,
    start_time: __,
    speed_limit_tag: ___,
    paced,
    ...pacedTrainProps
  } = pacedTrain;

  if (!paced) {
    return {
      ...pacedTrainProps,
      ...extractBaseTrainScheduleProps(pacedTrain),
      rollingStock,
      summary: formatSummary(pacedTrainSummary?.train_schedule),
    };
  }

  let simulatedExceptions: SimulatedException[] = [];
  if (pacedTrainSummary) {
    paced.exceptions.forEach((exception) => {
      const simulationSummary = pacedTrainSummary.exceptions[exception.id];

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
    ...pacedTrainProps,
    ...extractBaseTrainScheduleProps(pacedTrain),
    rollingStock,
    paced: {
      timeWindow: Duration.parse(paced.time_window),
      interval: Duration.parse(paced.interval),
      exceptions: simulatedExceptions,
    },
    summary: formatSummary(pacedTrainSummary?.train_schedule),
  };
};
