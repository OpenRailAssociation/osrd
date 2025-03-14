import { useCallback } from 'react';

import { useDraw } from '../hooks/useCanvas';
import { MINUTE } from '../lib/consts';
import { type DrawingFunction } from '../lib/types';
import { computeVisibleTimeMarkers, getCrispLineCoordinate } from '../utils/canvas';

const TimeGraduations = () => {
  const drawingFunction = useCallback<DrawingFunction>(
    (
      ctx,
      {
        timeScale,
        timeOrigin,
        timePixelOffset,
        spacePixelOffset,
        getTimePixel,
        swapAxis,
        width,
        height,
        theme: { breakpoints, timeRanges, timeGraduationsStyles, timeGraduationsPriorities },
      }
    ) => {
      const timeAxisSize = !swapAxis ? width : height;
      const spaceAxisSize = !swapAxis ? height : width;
      const minT = timeOrigin - timeScale * timePixelOffset;
      const maxT = minT + timeScale * timeAxisSize;

      // Find which styles to apply, relatively to the timescale (i.e. horizontal zoom level):
      const pixelsPerMinute = (1 / timeScale) * MINUTE;
      let gridlinesLevels: number[] = [];

      breakpoints.some((breakpoint, i) => {
        if (pixelsPerMinute < breakpoint) {
          gridlinesLevels = timeGraduationsPriorities[i];
          return true;
        }
        return false;
      });

      const gridMarks = computeVisibleTimeMarkers(minT, maxT, timeRanges, gridlinesLevels);

      // Render grid lines:
      gridMarks.forEach(({ time, level }) => {
        const styles = timeGraduationsStyles[level];

        ctx.strokeStyle = styles.color;
        ctx.lineWidth = styles.width;
        ctx.globalAlpha = styles.opacity || 1;
        ctx.setLineDash(styles.dashArray || []);
        if (styles.dashArray) {
          ctx.lineDashOffset = -spacePixelOffset;
        }

        const timePixel = getCrispLineCoordinate(getTimePixel(time), ctx.lineWidth);
        ctx.beginPath();
        if (!swapAxis) {
          ctx.moveTo(timePixel, 0);
          ctx.lineTo(timePixel, spaceAxisSize);
        } else {
          ctx.moveTo(0, timePixel);
          ctx.lineTo(spaceAxisSize, timePixel);
        }
        ctx.stroke();
      });

      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
    },
    []
  );

  useDraw('graduations', drawingFunction);

  return null;
};

export default TimeGraduations;
