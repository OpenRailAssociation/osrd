import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import type { ReportTrain, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainSchedule/types';
import { interpolateValue } from 'modules/trainschedule/components/DriverTrainSchedule/utils';
import { mToMm, msToS } from 'utils/physics';

import { formatDigitsAndUnit } from './utils';

function getTheoreticalMargin(selectedTrainSchedule: TrainScheduleResult, pathStepId: string) {
  if (selectedTrainSchedule.path.length === 0) {
    return undefined;
  }
  // pathStep is starting point => we take the first margin
  if (selectedTrainSchedule.path[0].id === pathStepId) {
    return selectedTrainSchedule.margins?.values[0];
  }
  const theoriticalMarginBoundaryIndex = selectedTrainSchedule.margins?.boundaries?.findIndex(
    (id) => id === pathStepId
  );
  if (
    theoriticalMarginBoundaryIndex === undefined ||
    theoriticalMarginBoundaryIndex < 0 ||
    theoriticalMarginBoundaryIndex > selectedTrainSchedule.margins!.values.length - 2
  ) {
    return undefined;
  }

  return selectedTrainSchedule.margins!.values[theoriticalMarginBoundaryIndex + 1];
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

export default computeMargins;
