import type { SimulationSummary } from 'modules/timetableItem/types';
import type { Train } from 'reducers/osrdconf/types';
import { ms2sec } from 'utils/timeManipulation';

import { formatDigitsAndUnit } from './utils';
import type { ScheduleEntry, TheoreticalMarginsRecord } from '../types';

/** Extracts the theoretical margin for each path step in the train schedule,
 * and marks whether margins are repeated or correspond to a boundary between margin values */
export function getTheoreticalMargins(train: Pick<Train, 'margins' | 'path'>) {
  const { margins } = train;
  if (!margins) {
    return undefined;
  }
  const theoreticalMargins: TheoreticalMarginsRecord = {};
  let marginIndex = 0;
  train.path.forEach((step, index) => {
    let isBoundary = index === 0;
    if (step.id === train.margins?.boundaries[marginIndex]) {
      marginIndex += 1;
      isBoundary = true;
    }
    theoreticalMargins[step.id] = {
      theoreticalMargin: margins.values[marginIndex],
      isBoundary,
    };
  });
  return theoreticalMargins;
}

/** Compute all margins to display for a given train schedule path step */
function computeMargins(
  theoreticalMargins: TheoreticalMarginsRecord | undefined,
  train: Pick<Train, 'path' | 'margins'>,
  scheduleByAt: Record<string, ScheduleEntry>,
  pathStepIndex: number,
  pathItemTimes: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'] | undefined // in ms
) {
  const { path, margins } = train;
  const pathStepId = path[pathStepIndex].id;
  const schedule = scheduleByAt[pathStepId];
  const stepTheoreticalMarginInfo = theoreticalMargins?.[pathStepId];
  if (
    !margins ||
    pathStepIndex === train.path.length - 1 ||
    !stepTheoreticalMarginInfo ||
    !((schedule && schedule.arrival) || stepTheoreticalMarginInfo.isBoundary)
  ) {
    return {
      theoreticalMargin: undefined,
      theoreticalMarginSeconds: undefined,
      calculatedMargin: undefined,
      diffMargins: undefined,
    };
  }

  const { theoreticalMargin, isBoundary } = stepTheoreticalMarginInfo;

  if (!pathItemTimes) {
    return {
      theoreticalMargin: formatDigitsAndUnit(theoreticalMargin),
      isTheoreticalMarginBoundary: isBoundary,
      calculatedMargin: undefined,
      diffMargins: undefined,
    };
  }

  // find the next pathStep where constraints are defined
  let nextIndex = path.length - 1;

  for (let index = pathStepIndex + 1; index < path.length; index += 1) {
    const curStepId = path[index].id;
    const curStepSchedule = scheduleByAt[curStepId];
    if (theoreticalMargins[curStepId]?.isBoundary || (curStepSchedule && curStepSchedule.arrival)) {
      nextIndex = index;
      break;
    }
  }

  // durations to go from the last pathStep with theoretical margin to the next pathStep
  // base = no margin
  // provisional = margins
  // final = margins + requested arrival times
  const { base, provisional, final } = pathItemTimes;
  const baseDuration = ms2sec(base[nextIndex] - base[pathStepIndex]);
  const provisionalDuration = ms2sec(provisional[nextIndex] - provisional[pathStepIndex]);
  const finalDuration = ms2sec(final[nextIndex] - final[pathStepIndex]);

  // how much longer it took (s) with the margin than without
  const provisionalLostTime = Math.round(provisionalDuration - baseDuration);
  const finalLostTime = Math.round(finalDuration - baseDuration);

  return {
    theoreticalMargin: formatDigitsAndUnit(theoreticalMargin),
    isTheoreticalMarginBoundary: isBoundary,
    theoreticalMarginSeconds: `${provisionalLostTime} s`,
    calculatedMargin: `${finalLostTime} s`,
    diffMargins: `${finalLostTime - provisionalLostTime} s`,
  };
}

export default computeMargins;
