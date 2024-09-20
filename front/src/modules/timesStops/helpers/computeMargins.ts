import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import type {
  ReportTrain,
  SimulationSummaryResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainSchedule/types';
import { interpolateValue } from 'modules/trainschedule/components/DriverTrainSchedule/utils';
import { mToMm, msToS } from 'utils/physics';

import { formatDigitsAndUnit } from './utils';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';

function getTheoreticalMargin(selectedTrainSchedule: TrainScheduleResult, pathStepId: string) {
  if (selectedTrainSchedule.path.length === 0) {
    return undefined;
  }
  // pathStep is starting point => we take the first margin
  if (selectedTrainSchedule.path[0].id === pathStepId) {
    return selectedTrainSchedule.margins?.values[0];
  }
  const theoreticalMarginBoundaryIndex = selectedTrainSchedule.margins?.boundaries?.findIndex(
    (id) => id === pathStepId
  );
  if (
    theoreticalMarginBoundaryIndex === undefined ||
    theoreticalMarginBoundaryIndex < 0 ||
    theoreticalMarginBoundaryIndex > selectedTrainSchedule.margins!.values.length - 2
  ) {
    return undefined;
  }

  return selectedTrainSchedule.margins!.values[theoreticalMarginBoundaryIndex + 1];
}

function computeDuration(
  trainSimulation: ReportTrain,
  opPoint: OperationalPointWithTimeAndSpeed,
  nextOpPoint: OperationalPointWithTimeAndSpeed
) {
  const opPointTime = interpolateValue(trainSimulation, mToMm(opPoint.position), 'times');
  const nextOpPointTime = interpolateValue(trainSimulation, mToMm(nextOpPoint.position), 'times');
  return msToS(nextOpPointTime - opPointTime);
}

function computeMargins(
  trainSimulation: SimulationResponseSuccess,
  opPoint: OperationalPointWithTimeAndSpeed,
  nextOpPoint: OperationalPointWithTimeAndSpeed,
  selectedTrainSchedule: TrainScheduleResult,
  pathStepId: string
) {
  const theoreticalMargin = getTheoreticalMargin(selectedTrainSchedule, pathStepId);

  // durations to go from current scheduled point to next scheduled point.
  // base = no margin
  // provisional = margins
  // final = margin + requested arrival times
  const baseDuration = computeDuration(trainSimulation.base, opPoint, nextOpPoint);
  const provisionalDuration = computeDuration(trainSimulation.provisional, opPoint, nextOpPoint);
  const finalDuration = computeDuration(trainSimulation.final_output, opPoint, nextOpPoint);

  // how much longer it took (s) with the margin than without
  const provisionalLostTime = provisionalDuration - baseDuration;
  const finalLostTime = finalDuration - baseDuration;

  const theoreticalMarginWithUnit = formatDigitsAndUnit(theoreticalMargin);
  const theoreticalMarginSeconds = formatDigitsAndUnit(provisionalLostTime, 's');
  const calculatedMargin = formatDigitsAndUnit(finalLostTime, 's');
  const diffMargins = formatDigitsAndUnit(finalLostTime - provisionalLostTime, 's');

  return {
    theoreticalMargin: theoreticalMarginWithUnit,
    theoreticalMarginSeconds,
    calculatedMargin,
    diffMargins,
  };
}

export function computeMarginsResults(
  selectedTrainSchedule: TrainScheduleResult,
  pathStepIndex: number,
  pathItemTimes: NonNullable<TrainScheduleWithDetails['pathItemTimes']>
) {
  const { path, margins } = selectedTrainSchedule;
  if (!margins) {
    return {
      theoreticalMargin: undefined,
      theoreticalMarginSeconds: undefined,
      calculatedMargin: undefined,
      diffMargins: undefined,
    };
  }

  const pathStepId = path[pathStepIndex].id;
  const theoreticalMargin = getTheoreticalMargin(selectedTrainSchedule, pathStepId);

  // find the previous pathStep where margin was defined
  let previousPathStepIndexWithMargin = 0;
  for (let index = 1; index < pathStepIndex; index++) {
    if (margins.boundaries.includes(path[index].id)) {
      previousPathStepIndexWithMargin = index;
    }
  }

  // durations to go from the previous pathStep with margin to current one.
  // base = no margin
  // provisional = margins
  // final = margin + requested arrival times
  const { base, provisional, final } = pathItemTimes;
  const baseDuration = base[pathStepIndex] - base[previousPathStepIndexWithMargin];
  const provisionalDuration =
    provisional[pathStepIndex] - provisional[previousPathStepIndexWithMargin];
  const finalDuration = final[pathStepIndex] - final[previousPathStepIndexWithMargin];

  // how much longer it took (s) with the margin than without
  const provisionalLostTime = provisionalDuration - baseDuration;
  const finalLostTime = finalDuration - baseDuration;

  const theoreticalMarginSeconds = formatDigitsAndUnit(provisionalLostTime, 's');
  const calculatedMargin = formatDigitsAndUnit(finalLostTime, 's');
  const diffMargins = formatDigitsAndUnit(finalLostTime - provisionalLostTime, 's');

  return {
    theoreticalMargin: formatDigitsAndUnit(theoreticalMargin),
    theoreticalMarginSeconds,
    calculatedMargin,
    diffMargins,
  };
}

export default computeMargins;
