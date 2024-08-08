import { feature, point } from '@turf/helpers';
import { last } from 'lodash';

import { calculateDistanceAlongTrack } from 'applications/editor/tools/utils';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { addElementAtIndex } from 'utils/array';
import { formatIsoDate } from 'utils/date';
import { sec2time, time2sec } from 'utils/timeManipulation';

import type { OsrdConfState, PathStep } from './types';

/** 2 hours in ms */
const ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE = 7200;

const computeNewOriginUpperBoundDate = (
  newOriginTime: string,
  newOriginUpperBoundTime: string,
  originDate: string | undefined,
  originUpperBoundDate: string | undefined
) => {
  if (newOriginUpperBoundTime < newOriginTime) {
    const newOriginDate = originDate ? new Date(originDate) : new Date();
    newOriginDate.setDate(newOriginDate.getDate() + 1);
    return formatIsoDate(newOriginDate);
  }
  if (originDate !== originUpperBoundDate) {
    return originDate;
  }
  return null;
};

/**
 * Given current origin dates and times and a new origin time or new origin upper bound time,
 * compute the new origin times and the new origin upper bound date while keeping the same time difference.
 *
 * See tests for more examples.
 */
export const computeLinkedOriginTimes = (
  originDate: string | undefined,
  originTime: string | undefined,
  originUpperBoundDate: string | undefined,
  originUpperBoundTime: string | undefined,
  newOriginTime: string | undefined,
  newOriginUpperBoundTime: string | undefined = undefined
) => {
  let computedOriginTime: string | undefined;
  let computedOriginUpperBoundTime: string | undefined;

  if (newOriginTime && newOriginUpperBoundTime)
    throw new Error('Both newOriginTime and newOriginUpperBoundTime are provided');

  const difference =
    originTime && originUpperBoundTime
      ? time2sec(originUpperBoundTime) - time2sec(originTime)
      : ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE;

  if (newOriginTime) {
    const newOriginTimeSeconds = time2sec(newOriginTime);
    computedOriginTime = newOriginTime;
    computedOriginUpperBoundTime = sec2time(newOriginTimeSeconds + difference);
  } else if (newOriginUpperBoundTime) {
    const newOriginUpperBoundTimeSeconds = time2sec(newOriginUpperBoundTime);
    computedOriginTime = sec2time(newOriginUpperBoundTimeSeconds - difference);
    computedOriginUpperBoundTime = newOriginUpperBoundTime;
  } else {
    throw new Error('One of newOriginTime or newOriginUpperBoundTime must be provided');
  }

  return {
    newOriginTime: computedOriginTime,
    newOriginUpperBoundTime: computedOriginUpperBoundTime,
    newOriginUpperBoundDate: computeNewOriginUpperBoundDate(
      computedOriginTime,
      computedOriginUpperBoundTime,
      originDate,
      originUpperBoundDate
    ),
  };
};

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
