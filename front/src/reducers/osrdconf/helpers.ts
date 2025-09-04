import { feature, point } from '@turf/helpers';
import { compact, last, pick } from 'lodash';
import { v4 as uuidV4 } from 'uuid';

import { calculateDistanceAlongTrack } from 'applications/editor/tools/utils';
import type { MapPathProperties } from 'applications/operationalStudies/types';
import { pathStepMatchesOp } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/timetableItem/types';
import { addElementAtIndex } from 'utils/array';

import type { OperationalStudiesConfState, PathStep } from './types';

export const insertViaFromMap = (
  pathSteps: OperationalStudiesConfState['pathSteps'],
  // newVia comes from a map click either on a track section or an operational point
  newVia: PathStep,
  pathProperties: MapPathProperties
): OperationalStudiesConfState['pathSteps'] => {
  // If one of these is missing, via is not valid (it hasn't been added via click on map) and we return the same array
  if (!newVia.coordinates) return pathSteps;

  const origin = pathSteps[0];
  const destination = last(pathSteps);

  const { location: newLocation } = newVia;
  const newStep = {
    id: newVia.id,
    coordinates: newVia.coordinates,
    location:
      'track' in newLocation
        ? {
            track: newLocation.track,
            offset: newLocation.offset,
          }
        : {
            ...newLocation,
            track_reference: newLocation.track_reference,
          },
  };

  let newViaIndex = -1;

  if (origin && destination && pathSteps.length > 2) {
    // If origin and destination have already been selected and there is at least a via,
    // we project the new via on the current path and add it at the most relevant index
    const newViaPoint = point(newStep.coordinates);
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
      'kp',
      'arrival',
      'locked',
      'deleted',
      'receptionSignal',
      'theoreticalMargin',
      'stopFor',
    ]),
    id: uuidV4(),
    location: op.uic
      ? { uic: op.uic, secondary_code: op.ch }
      : {
          track: op.track,
          offset: op.offsetOnTrack,
        },
  };

  const stepIndex = cleanPathSteps.findIndex((step) => pathStepMatchesOp(step, op));
  if (stepIndex >= 0) {
    // Because of import issues, there can be multiple ops with same position on path
    // To avoid updating the wrong one, we need to find the one that matches the payload
    newVia = {
      ...newVia,
      id: cleanPathSteps[stepIndex].id,
      location: {
        ...newVia.location,
        track_reference:
          'track_reference' in cleanPathSteps[stepIndex].location
            ? cleanPathSteps[stepIndex].location.track_reference
            : undefined,
      },
    }; // We don't need to change the id of the updated via
    statePathSteps[stepIndex] = newVia;
  } else {
    // Because of import issues, there can be multiple ops at position 0
    // To avoid inserting a new via before the origin we need to check if the index is 0
    const index = cleanPathSteps.findIndex((step) => step.positionOnPath! >= op.positionOnPath);
    statePathSteps.splice(index || 1, 0, newVia);
  }
}
