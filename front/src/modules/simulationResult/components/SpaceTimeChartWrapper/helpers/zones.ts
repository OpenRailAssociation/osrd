import type { OccupancyZone } from '@osrd-project/ui-charts';

import {
  type PostTrainSchedulesTrackOccupancyApiResponse,
  type TrainScheduleException,
} from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { isTrainId } from 'utils/trainId';

import type { BaseTrainProjection } from '../../../types';

export type MovableOccupancyZone = OccupancyZone & {
  dbStartTime: number;
  dbEndTime: number;
  trainId: TrainId;
  isStartTimeException?: boolean;
};

export type OccupancyZoneReference = {
  waypointId: string;
  trainId: TrainId;
};

const EPSILON = 1e-5;

export function formatOccupancyZonePathId(ref: OccupancyZoneReference): string {
  return JSON.stringify(ref);
}

export function parseOccupancyZonePathId(pathId: string): OccupancyZoneReference {
  let ref: unknown;
  try {
    ref = JSON.parse(pathId);
  } catch (err) {
    throw new Error('Malformed occupancy zone path ID: invalid JSON', { cause: err });
  }
  if (
    !ref ||
    typeof ref !== 'object' ||
    !('waypointId' in ref) ||
    typeof ref.waypointId !== 'string' ||
    !('trainId' in ref) ||
    typeof ref.trainId !== 'string' ||
    !isTrainId(ref.trainId)
  ) {
    throw new Error('Malformed occupancy zone path ID: invalid fields');
  }
  return ref as OccupancyZoneReference;
}

/**
 * Given a train projection, return a function to get the position (in mm since the departure
 * of the start position) of the train at a given time (in ms since the departure of the train).
 */
function getTimeToPosition(
  projectionParts: { positions: number[]; times: number[] }[]
): (time: number) => number | null {
  return (time: number) => {
    for (const { times, positions } of projectionParts) {
      // Check if time is within this path's bounds
      if (time < times[0] || time > times[times.length - 1]) continue;

      // Binary search for the right interval
      let left = 0;
      let right = times.length - 1;
      while (left < right - 1) {
        const mid = Math.floor((left + right) / 2);
        if (times[mid] <= time) left = mid;
        else right = mid;
      }

      // If exact match, return position directly
      if (times[left] === time) return positions[left];
      if (times[right] === time) return positions[right];

      // Linear interpolation
      const t = (time - times[left]) / (times[right] - times[left]);
      return positions[left] + t * (positions[right] - positions[left]);
    }

    return null; // Time not found in any path
  };
}
export function getMovableOccupancyZone(
  waypointId: string,
  trackId: string,
  trainId: TrainId,
  occupation: PostTrainSchedulesTrackOccupancyApiResponse[number]['trains'][number],
  spaceTimeCurves: BaseTrainProjection['spaceTimeCurves'],
  trainName: string,
  departureTime: Date,
  exception?: TrainScheduleException
): MovableOccupancyZone {
  const trainStartTime = departureTime.getTime();
  const occupationStartTime = occupation.time_begin;
  const occupationEndTime = occupationStartTime + Duration.parse(occupation.duration).ms;
  const timeToPosition = getTimeToPosition(spaceTimeCurves);

  // Search for arrival and departure directions:
  let startDirection: OccupancyZone['startDirection'];
  let endDirection: OccupancyZone['endDirection'];

  const startPosition = timeToPosition(occupationStartTime - trainStartTime);
  const beforeStartPosition = timeToPosition(occupationStartTime - trainStartTime - EPSILON);
  if (beforeStartPosition === null || startPosition === null) {
    startDirection = undefined;
  } else if (beforeStartPosition < startPosition) {
    startDirection = 'up';
  } else if (beforeStartPosition > startPosition) {
    startDirection = 'down';
  }

  const endPosition = timeToPosition(occupationEndTime - trainStartTime);
  const afterEndPosition = timeToPosition(occupationEndTime - trainStartTime + EPSILON);
  if (afterEndPosition === null || endPosition === null) {
    endDirection = undefined;
  } else if (afterEndPosition < endPosition) {
    endDirection = 'up';
  } else if (afterEndPosition > endPosition) {
    endDirection = 'down';
  }

  return {
    trackId,
    pathId: formatOccupancyZonePathId({ waypointId, trainId }),
    trainId,
    startTime: occupationStartTime,
    startDirection,
    endTime: occupationEndTime,
    endDirection,
    trainName,
    dbStartTime: occupationStartTime,
    dbEndTime: occupationEndTime,
    isStartTimeException: exception?.change_groups.start_time !== undefined,
  };
}
