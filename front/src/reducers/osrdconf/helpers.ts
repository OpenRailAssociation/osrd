import { feature, point } from '@turf/helpers';
import { compact, last, pick } from 'lodash';
import nextId from 'react-id-generator';

import { calculateDistanceAlongTrack } from 'applications/editor/tools/utils';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { pathStepMatchesOp } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { addElementAtIndex, replaceElementAtIndex } from 'utils/array';

import type { OsrdConfState, PathStep } from './types';

export const insertViaFromMap = (
  pathSteps: OsrdConfState['pathSteps'],
  newVia: PathStep,
  pathProperties: ManageTrainSchedulePathProperties
): OsrdConfState['pathSteps'] => {
  // If one of these is missing, via is not valid (it hasn't been added via click on map) and we return the same array
  if (!('track' in newVia) || !newVia.coordinates) return pathSteps;

  const origin = pathSteps[0];
  const destination = last(pathSteps);
  const newStep = {
    track: newVia.track,
    offset: newVia.offset,
    id: newVia.id,
    coordinates: newVia.coordinates,
  };

  let newViaIndex = -1;
  // If origin and destination have already been selected and there is at least a via,
  // we project the new via on the current path and add it at the most relevant index
  if (origin && destination && pathSteps.length > 2) {
    const newViaPoint = point(newVia.coordinates);
    const positionOnPath = calculateDistanceAlongTrack(
      feature(pathProperties.geometry, { length: pathProperties.length }),
      newViaPoint.geometry,
      'millimeters'
    );

    newViaIndex = pathSteps.findIndex(
      (pathStep) => pathStep?.positionOnPath && pathStep.positionOnPath >= positionOnPath
    );
  }

  return addElementAtIndex(pathSteps, newViaIndex, newStep);
};

export const updatePathStepAtIndex = (
  pathSteps: OsrdConfState['pathSteps'],
  index: number,
  updates: Partial<PathStep> | null,
  replaceCompletely: boolean = false
) => {
  if (replaceCompletely) {
    return replaceElementAtIndex(pathSteps, index, updates as PathStep);
  }
  const element = pathSteps[index];
  if (element) {
    const updatedElement = { ...element, ...updates };
    return replaceElementAtIndex(pathSteps, index, updatedElement);
  }
  return pathSteps;
};

export const updateOriginPathStep = (
  pathSteps: OsrdConfState['pathSteps'],
  origin: Partial<PathStep> | null,
  replaceCompletely: boolean = false
) => updatePathStepAtIndex(pathSteps, 0, origin, replaceCompletely);

export const updateDestinationPathStep = (
  pathSteps: OsrdConfState['pathSteps'],
  destination: Partial<PathStep> | null,
  replaceCompletely: boolean = false
) => updatePathStepAtIndex(pathSteps, pathSteps.length - 1, destination, replaceCompletely);

/**
 * Modifies the array statePathSteps in place in the reducer
 */
export function upsertPathStep(statePathSteps: (PathStep | null)[], op: SuggestedOP) {
  // We know that, at this point, origin and destination are defined because pathfinding has been done
  const cleanPathSteps = compact(statePathSteps);

  let newVia: PathStep = {
    ...pick(op, [
      'coordinates',
      'positionOnPath',
      'name',
      'ch',
      'kp',
      'stopFor',
      'arrival',
      'locked',
      'deleted',
      'receptionSignal',
      'theoreticalMargin',
    ]),
    id: nextId(),
    ...(op.uic
      ? { uic: op.uic }
      : {
          track: op.track,
          offset: op.offsetOnTrack,
        }),
  };

  const stepIndex = cleanPathSteps.findIndex((step) => pathStepMatchesOp(step, op));
  if (stepIndex >= 0) {
    // Because of import issues, there can be multiple ops with same position on path
    // To avoid updating the wrong one, we need to find the one that matches the payload
    newVia = { ...newVia, id: cleanPathSteps[stepIndex].id }; // We don't need to change the id of the updated via
    statePathSteps[stepIndex] = newVia;
  } else {
    // Because of import issues, there can be multiple ops at position 0
    // To avoid inserting a new via before the origin we need to check if the index is 0
    const index = cleanPathSteps.findIndex((step) => step.positionOnPath! >= op.positionOnPath);
    statePathSteps.splice(index || 1, 0, newVia);
  }
}
