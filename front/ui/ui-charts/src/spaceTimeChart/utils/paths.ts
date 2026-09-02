import type { DataPoint } from '../../common/types';
import type { Direction, PathData, SpaceToPixel } from '../lib/types';

/**
 * This function takes a path, a point index and looks forward in the points order for the first
 * position variation. It then returns "forward" or "backward" according to that variation.
 *
 * If it does not find any variation for some reason, it returns "still" instead.
 *
 * Finally, if `reversed` is true, then, it searches points in the other direction.
 */
export function getPathDirection(
  { points }: PathData,
  index: number,
  reversed?: boolean
): Direction {
  if (points.length < 2 || !points[index]) return 'still';

  const reference = points[index].position;
  let i = index;
  let point: DataPoint | undefined;
  while ((point = points[i])) {
    if (point.position !== reference) {
      const delta = reversed ? reference - point.position : point.position - reference;
      return delta > 0 ? 'forward' : 'backward';
    }

    i = i + (reversed ? -1 : 1);
  }

  return 'still';
}

/**
 * This function takes a SpaceToPixel function and a position, and checks if the function returns
 * the same pixel for the position, starting from both sides. It then returns one or two pixel
 * positions accordingly.
 */
export function getSpacePixels(
  getSpacePixel: SpaceToPixel,
  position: number
): [number] | [number, number] {
  const spacePixelFromStart = getSpacePixel(position);
  const spacePixelFromEnd = getSpacePixel(position, true);

  return spacePixelFromStart === spacePixelFromEnd
    ? [spacePixelFromStart]
    : [spacePixelFromStart, spacePixelFromEnd];
}

export type StopRange = { position: number; minTime: number; maxTime: number };

/**
 * Groups path points into stop time ranges: one range per maximal run at the
 * same operational-point position. Separate visits to a position stay separate
 * (their halos must not bridge the gap between them).
 */
export function computeStops(points: DataPoint[], stopPositions: Set<number>): StopRange[] {
  const stops: StopRange[] = [];
  let current: StopRange | null = null;
  for (let i = 1; i < points.length; i++) {
    const { position, time } = points[i];
    const isStop = points[i - 1].position === position && stopPositions.has(position);
    if (!isStop) {
      if (current) stops.push(current);
      current = null;
    } else if (current) {
      current.maxTime = time;
    } else {
      current = { position, minTime: points[i - 1].time, maxTime: time };
    }
  }
  if (current) stops.push(current);
  return stops;
}
