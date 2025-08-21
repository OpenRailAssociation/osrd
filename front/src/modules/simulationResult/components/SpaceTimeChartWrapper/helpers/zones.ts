import type { OccupancyZone } from '@osrd-project/ui-charts';

import { type PostTrainScheduleTrackOccupancyApiResponse } from 'common/api/osrdEditoastApi';
import type { TrainScheduleId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import type { TrainSpaceTimeData } from '../../../types';

export type MovableOccupancyZone = Omit<OccupancyZone, 'trainId'> & {
  dbStartTime: number;
  dbEndTime: number;
  trainId: TrainScheduleId;
};

const EPSILON = 1e-5;

function getTimeToPosition(
  paths: { positions: number[]; times: number[] }[]
): (time: number) => number | null {
  return (time: number) => {
    for (const { times, positions } of paths) {
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
  trackId: string,
  {
    duration,
    time_begin,
    train_schedule_id,
  }: PostTrainScheduleTrackOccupancyApiResponse[string][number],
  { name, spaceTimeCurves, departureTime }: TrainSpaceTimeData
): MovableOccupancyZone {
  const trainTimeOrigin = departureTime.getTime();
  const startTime = +new Date(time_begin);
  const endTime = +new Date(time_begin) + Duration.parse(duration).ms;
  const timeToPosition = getTimeToPosition(spaceTimeCurves);

  // Search for arrival and departure directions:
  let startDirection: OccupancyZone['startDirection'];
  let endDirection: OccupancyZone['endDirection'];

  const startPosition = timeToPosition(startTime - trainTimeOrigin);
  const beforeStartPosition = timeToPosition(startTime - trainTimeOrigin - EPSILON);
  if (beforeStartPosition === null || startPosition === null) {
    startDirection = undefined;
  } else if (beforeStartPosition < startPosition) {
    startDirection = 'up';
  } else if (beforeStartPosition > startPosition) {
    startDirection = 'down';
  }

  const endPosition = timeToPosition(endTime - trainTimeOrigin);
  const afterEndPosition = timeToPosition(endTime - trainTimeOrigin + EPSILON);
  if (afterEndPosition === null || endPosition === null) {
    endDirection = undefined;
  } else if (afterEndPosition < endPosition) {
    endDirection = 'up';
  } else if (afterEndPosition > endPosition) {
    endDirection = 'down';
  }

  return {
    trackId,
    trainId: formatEditoastIdToTrainScheduleId(train_schedule_id),
    startTime,
    startDirection,
    endTime,
    endDirection,
    trainName: name,
    dbStartTime: startTime,
    dbEndTime: endTime,
  };
}
