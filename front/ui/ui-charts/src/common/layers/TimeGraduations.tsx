import { useCallback, useContext } from 'react';

import { MINUTE } from '../../common/consts';
import { MouseContext, TimeChartCanvasContext } from '../../common/context';
import { computeVisibleTimeMarkers, getCrispLineCoordinate } from '../../common/helpers/time';
import type { TimeChartContextType, DrawingFunction } from '../../common/types';
import { BLACK_25, GREY_50 } from '../helpers/colors';
import { useDraw } from '../hooks/useCanvas';

const TimeGraduations = () => {
  const mouseContext = useContext(MouseContext);
  const mouseX = mouseContext?.position.x;
  const isHover = mouseContext?.isHover ?? false;
  const drawingFunction = useCallback<DrawingFunction<TimeChartContextType>>(
    (
      ctx,
      {
        timeScale,
        timeOrigin,
        timePixelOffset,
        yPixelOffset,
        getTimePixel,
        getTime,
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
        ctx.globalAlpha = styles.opacity ?? 1;
        ctx.setLineDash(styles.dashArray ?? []);
        if (styles.dashArray) {
          ctx.lineDashOffset = -yPixelOffset;
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

      if (!swapAxis && isHover && !isNaN(mouseX)) {
        const crispX = getCrispLineCoordinate(mouseX, 1);
        const timeValue = getTime(crispX);
        const timeLabel = new Date(timeValue).toLocaleTimeString();

        ctx.globalAlpha = 1;

        // Vertical line:
        ctx.strokeStyle = BLACK_25;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(crispX, 0);
        ctx.lineTo(crispX, spaceAxisSize);
        ctx.stroke();

        // Label
        const padding = 4;
        const fontSize = 12;
        const fontWeight = '400';
        const fontFamily = 'IBM Plex Sans, sans-regular';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const textWidth = ctx.measureText(timeLabel).width;

        const labelX = Math.min(
          Math.max(crispX - textWidth / 2 - padding, 0),
          width - textWidth - padding * 2
        );

        const labelY = spaceAxisSize - 50;

        // Label background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(labelX, labelY - fontSize - 2, textWidth + padding * 2, fontSize + 4);

        // Text
        ctx.fillStyle = GREY_50;
        ctx.fillText(timeLabel, labelX + padding, labelY);
      }

      // Reset
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
    },
    [mouseX, isHover]
  );

  useDraw(TimeChartCanvasContext, 'graduations', drawingFunction);

  return null;
};

export default TimeGraduations;
