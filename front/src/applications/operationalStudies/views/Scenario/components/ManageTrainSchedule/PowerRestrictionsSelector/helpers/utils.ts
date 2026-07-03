import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { mToMm } from 'utils/physics';

import createPathStep from './createPathStep';

/** Get pathStep located at the given position on path (in meters), if it exists. */
export const getPathStep = (pathSteps: PathStep[], positionInM: number) =>
  pathSteps.find((step) => step.positionOnPath === mToMm(positionInM));

export const getOrCreatePathStepAtPosition = (
  positionOnPathInM: number,
  pathSteps: PathStep[],
  tracksLengthCumulativeSums: number[],
  pathProperties: ManageTrainSchedulePathProperties
) => {
  const pathStep = getPathStep(pathSteps, positionOnPathInM);
  if (pathStep) {
    return pathStep;
  }
  return createPathStep(positionOnPathInM, tracksLengthCumulativeSums, pathProperties, pathSteps);
};

export const extractPathStepsFromRange = (
  range: IntervalItem,
  pathSteps: PathStep[],
  tracksLengthCumulativeSums: number[],
  pathProperties: ManageTrainSchedulePathProperties
) => {
  const from = getOrCreatePathStepAtPosition(
    range.begin,
    pathSteps,
    tracksLengthCumulativeSums,
    pathProperties
  );
  const to = getOrCreatePathStepAtPosition(
    range.end,
    pathSteps,
    tracksLengthCumulativeSums,
    pathProperties
  );
  return { from, to };
};
