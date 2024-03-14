// import distance from '@turf/distance';
import { lineString, point } from '@turf/helpers';
import length from '@turf/length';

import type { PointOnMap } from 'applications/operationalStudies/consts';
import { formatIsoDate } from 'utils/date';
import { nearestPointOnLine } from 'utils/geometry';
import { sec2time, time2sec } from 'utils/timeManipulation';

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
// eslint-disable-next-line import/prefer-default-export
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

export const insertVia = (
  vias: PointOnMap[],
  origin: PointOnMap,
  destination: PointOnMap,
  newVia: PointOnMap
): PointOnMap[] => {
  const updatedVias = [...vias];
  const fullRouteCoordinates = [
    origin.coordinates!,
    ...vias.map((v) => v.coordinates!),
    destination.coordinates!,
  ];
  const newViaPoint = point(newVia.coordinates!);

  const nearestPointOnPath = nearestPointOnLine(lineString(fullRouteCoordinates), newViaPoint);

  const insertIndex = fullRouteCoordinates.findIndex((_, index) => {
    if (index === 0) return false;
    if (index === fullRouteCoordinates.length - 1) return true;
    // Makes the function imperfect as insert might fail in a curvy path
    const segmentToPoint = lineString(fullRouteCoordinates.slice(0, index + 1));
    return nearestPointOnPath.properties.location! <= length(segmentToPoint);
  });

  const adjustedIndex = Math.max(0, insertIndex - 1);
  updatedVias.splice(adjustedIndex, 0, newVia);
  return updatedVias;
};
