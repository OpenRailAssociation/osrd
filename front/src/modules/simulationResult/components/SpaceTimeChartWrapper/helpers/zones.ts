import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import { groupBy } from 'lodash';

import {
  type PacedTrainException,
  type PathItemRelativeLocation,
  type PostTrainSchedulesTrackOccupancyApiResponse,
} from 'common/api/osrdEditoastApi';
import {
  getTimetableRepeatOffsets,
  type TimeRange,
} from 'modules/simulationResult/helpers/getTrainScheduleRepeatOffsets';
import type { TrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { extractTrainScheduleIdFromTrainId, isTrainId } from 'utils/trainId';

import type { BaseTrainProjection, CurveStyleExceptionType } from '../../../types';
import type { LinkableOccupancy } from './computePossibleLinkings';

type DrawableOccupancyZone = Omit<OccupancyZone, 'curveStyle'> & {
  curveStyle?: OccupancyZone['curveStyle'];
  dbStartTime: number;
  dbEndTime: number;
  trainId: TrainId;
  exceptionTypes: CurveStyleExceptionType[];
  pathItemRelativeLocation: PathItemRelativeLocation;
};

/** An occupancy zone, carrying the data needed to compute the linkings of its track as well. */
export type MovableOccupancyZone = DrawableOccupancyZone & LinkableOccupancy;

export type DeployedWaypoint = {
  waypointId: string;
  operationalPointPosition: number;
  operationalPointName?: string;
  zones?: MovableOccupancyZone[];
  possibleLinkings: Map<TrainId, TrainId>;
  tracks?: Track[];
  loading?: boolean;
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
  exception?: PacedTrainException
): DrawableOccupancyZone {
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

  const exceptionTypes: CurveStyleExceptionType[] = [];

  if (exception?.start_time !== undefined) {
    exceptionTypes.push('start_time');
  }
  if (exception?.path_and_schedule !== undefined) {
    exceptionTypes.push('path_and_schedule');
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
    exceptionTypes,
    pathItemRelativeLocation: occupation.path_item_relative_location,
  };
}

/**
 * Repeat occupancy zones across a visible time range for hourly timetables.
 *
 * Each train is repeated on its own period (its paced train time window), just like its
 * curves in the space time chart: a 1h paced train gets twice as many occurrences as a 2h
 * one. Zones of trains without a period (unique trains) are left as they are.
 */
export const repeatOccupancyZonesInRange = (
  occupancyZones: (OccupancyZone & MovableOccupancyZone)[],
  periods: Map<TrainScheduleId, Duration>,
  range: TimeRange
): (OccupancyZone & MovableOccupancyZone)[] => {
  const zonesByTrainScheduleId = groupBy(occupancyZones, (zone) =>
    extractTrainScheduleIdFromTrainId(zone.trainId)
  );

  const repeatedOccupancyZones: (OccupancyZone & MovableOccupancyZone)[] = [];
  for (const [trainScheduleId, zones] of Object.entries(zonesByTrainScheduleId)) {
    const period = periods.get(trainScheduleId as TrainScheduleId);
    if (!period) {
      repeatedOccupancyZones.push(...zones);
      continue;
    }

    // Note, occupancy zones are relative to their train's start time, so we need
    // to *not* subtract the zone's own startTime here
    const maxItemDuration = new Duration({
      milliseconds: Math.max(...zones.map((zone) => zone.endTime)),
    });

    const repeatOffsets = getTimetableRepeatOffsets({
      period,
      maxItemDuration,
      range,
    });

    for (const offset of repeatOffsets) {
      for (const zone of zones) {
        repeatedOccupancyZones.push({
          ...zone,
          startTime: zone.startTime + offset.ms,
          endTime: zone.endTime + offset.ms,
          dbStartTime: zone.dbStartTime + offset.ms,
          dbEndTime: zone.dbEndTime + offset.ms,
        });
      }
    }
  }

  return repeatedOccupancyZones;
};
