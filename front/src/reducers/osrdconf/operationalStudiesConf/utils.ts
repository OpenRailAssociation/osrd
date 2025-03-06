import type { PowerRestriction } from 'applications/operationalStudies/types';
import { addElementAtIndex } from 'utils/array';

import type { PathStep } from '../types';

/**
 * Check if a pathStep can be removed.
 *
 * It cannot be removed if it is used in at least one power restriction range, if it is locked or has an arrival time,
 * a stop duration or a margin.
 */
export const canRemovePathStep = (
  pathStep: PathStep,
  powerRestrictionRanges: PowerRestriction[]
) => {
  const pathStepIsUsed = powerRestrictionRanges.some(
    (restriction) => restriction.from === pathStep.id || restriction.to === pathStep.id
  );
  return (
    !pathStepIsUsed &&
    !pathStep.locked &&
    !pathStep.arrival &&
    !pathStep.stopFor &&
    !pathStep.theoreticalMargin
  );
};

/** Remove some restrictions and update the first and second restrictions with the new path step */
export const updateRestrictions = (
  restrictions: PowerRestriction[],
  restrictionsToRemove: PowerRestriction[],
  firstRestriction?: PowerRestriction,
  secondRestriction?: PowerRestriction,
  newPathStepId?: string
) => {
  const newPowerRestrictions: PowerRestriction[] = [];

  restrictions.forEach((restriction) => {
    // remove the restriction if it is in the list of restrictions to remove
    for (const restrictionToRemove of restrictionsToRemove) {
      if (
        restriction.from === restrictionToRemove.from &&
        restriction.to === restrictionToRemove.to
      ) {
        return;
      }
    }

    let newRestriction = restriction;
    // update the restriction if it is the first or second restriction
    if (newPathStepId) {
      if (restriction.to === firstRestriction?.to) {
        newRestriction = { ...restriction, to: newPathStepId };
      } else if (restriction.from === secondRestriction?.from) {
        newRestriction = { ...restriction, from: newPathStepId };
      }
    }
    newPowerRestrictions.push(newRestriction);
  });

  return newPowerRestrictions;
};

export const isRangeCovered = (
  pathSteps: PathStep[],
  powerRestrictionRange: PowerRestriction,
  positionMin: number,
  positionMax: number
): boolean => {
  const pathStepFrom = pathSteps.find((pathStep) => pathStep.id === powerRestrictionRange.from);
  const pathStepTo = pathSteps.find((pathStep) => pathStep.id === powerRestrictionRange.to);

  if (pathStepFrom?.positionOnPath === undefined || pathStepTo?.positionOnPath === undefined) {
    throw new Error('Path step has no position on path');
  }

  return positionMin < pathStepFrom.positionOnPath && pathStepTo.positionOnPath < positionMax;
};

export const addPathStep = (pathSteps: PathStep[], newPathStep: PathStep): PathStep[] => {
  const newPathStepExists = pathSteps.some((pathStep) => pathStep.id === newPathStep.id);
  if (!newPathStepExists) {
    const index = pathSteps.findIndex(
      (step) => step.positionOnPath && step.positionOnPath > newPathStep.positionOnPath!
    );
    return addElementAtIndex(pathSteps, index, newPathStep);
  }

  return pathSteps;
};

/** Remove the unused path steps */
export const cleanPathSteps = (
  pathSteps: PathStep[],
  powerRestrictions: PowerRestriction[]
): PathStep[] =>
  pathSteps.reduce((acc, pathStep, index) => {
    if (index === 0 || index === pathSteps.length - 1 || !pathStep.isFromPowerRestriction) {
      acc.push(pathStep);
      return acc;
    }

    if (canRemovePathStep(pathStep, powerRestrictions)) {
      return acc;
    }

    acc.push(pathStep);
    return acc;
  }, [] as PathStep[]);
