import { useContext, useMemo } from 'react';

import { SpaceTimeChartContext } from '../lib/context';

/**
 * Returns the pixel x-positions of all interval boundaries visible in the viewport.
 * Positions are spaced `duration` ms apart, anchored at `origin`.
 */
export const useIntervalPositions = (duration: number, origin = 0): number[] => {
  const { timeScale, timeOrigin, timePixelOffset, getTimePixel, width, swapAxis } =
    useContext(SpaceTimeChartContext);

  return useMemo(() => {
    if (!duration || duration <= 0 || swapAxis) return [];
    const minT = timeOrigin - timeScale * timePixelOffset;
    const maxT = minT + timeScale * width;
    const firstIndex = Math.floor((minT - origin) / duration);
    const lastIndex = Math.ceil((maxT - origin) / duration);
    const result: number[] = [];
    for (let index = firstIndex; index <= lastIndex; index++) {
      result.push(getTimePixel(origin + index * duration));
    }
    return result;
  }, [duration, origin, timeScale, timeOrigin, timePixelOffset, getTimePixel, width, swapAxis]);
};
