import { useCallback } from 'react';

import { useDraw } from '../hooks/useCanvas';
import { HOUR, MINUTE } from '../lib/consts';
import { type DrawingFunction } from '../lib/types';
import { computeVisibleTimeMarkers, getCrispLineCoordinate } from '../utils/canvas';
import { WHITE_ALPHA_75 } from '../utils/colors';

const MARGIN = 100;
const MINUTES_FORMATTER = (t: number) => `:${new Date(t).getMinutes().toString().padStart(2, '0')}`;
const HOURS_FORMATTER = (t: number, pixelsPerMinute: number) => {
  const date = new Date(t);
  if (pixelsPerMinute > 1) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } else {
    return date.getHours().toString().padStart(2, '0');
  }
};
const DATES_FORMATER = (t: number) => {
  const date = new Date(t);
  return [
    date.getDate().toString().padStart(2, '0'),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getFullYear().toString(),
  ].join('/');
};

const RANGES_FORMATER: ((t: number, pixelsPerMinute: number) => string)[] = [
  () => '',
  () => '',
  MINUTES_FORMATTER,
  MINUTES_FORMATTER,
  MINUTES_FORMATTER,
  MINUTES_FORMATTER,
  HOURS_FORMATTER,
  HOURS_FORMATTER,
  HOURS_FORMATTER,
  HOURS_FORMATTER,
  HOURS_FORMATTER,
];

export const TimeCaptions = () => {
  const drawingFunction = useCallback<DrawingFunction>(
    (
      ctx,
      {
        timeScale,
        timeOrigin,
        timePixelOffset,
        getTimePixel,
        swapAxis,
        width,
        height,
        theme: {
          background,
          breakpoints,
          timeRanges,
          timeCaptionsPriorities,
          timeCaptionsStyles,
          timeGraduationsStyles,
          dateCaptionsStyle,
        },
        captionSize,
        hideTimeCaptions,
        hideDates,
        showTicks,
      }
    ) => {
      if (hideTimeCaptions) return;

      const timeAxisSize = !swapAxis ? width : height;
      const spaceAxisSize = (!swapAxis ? height : width) - captionSize;

      // Add some margin, so that captions of times right outside the stage are still visible:
      const minT = timeOrigin - timeScale * (timePixelOffset + MARGIN);
      const maxT = minT + timeScale * (width + MARGIN * 2);

      // Find which styles to apply, relatively to the timescale (i.e. horizontal zoom level):
      const pixelsPerMinute = (1 / timeScale) * MINUTE;
      let labelLevels: number[] = [];

      breakpoints.some((breakpoint, i) => {
        if (pixelsPerMinute < breakpoint) {
          labelLevels = timeCaptionsPriorities[i];
          return true;
        }
        return false;
      });

      let labelMarks = computeVisibleTimeMarkers(
        minT,
        maxT,
        timeRanges,
        labelLevels,
        (level: number, i: number) => ({
          level,
          styles: timeCaptionsStyles[level],
          formatter: RANGES_FORMATER[i],
        })
      );
      if (!hideDates)
        labelMarks = labelMarks.concat(
          computeVisibleTimeMarkers(minT, maxT, [24 * HOUR], [1], (level: number) => ({
            level,
            styles: dateCaptionsStyle,
            formatter: DATES_FORMATER,
          }))
        );
      // Render caption background:
      ctx.fillStyle = background;
      if (!swapAxis) {
        ctx.fillStyle = WHITE_ALPHA_75;
        ctx.fillRect(0, 0, width, 24);
        ctx.fillStyle = background;
        ctx.fillRect(0, spaceAxisSize, timeAxisSize, captionSize);
      } else {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, captionSize, timeAxisSize);
      }

      // Render time captions:
      labelMarks.forEach(({ styles, formatter, time }) => {
        const text = formatter(time, pixelsPerMinute);

        ctx.textAlign = styles.textAlign || 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = styles.color;
        ctx.lineWidth = 5;
        ctx.strokeStyle = background;
        ctx.lineCap = 'butt';
        ctx.font = `${styles.fontWeight || 'normal'} ${styles.font}`;
        const timePixel = getCrispLineCoordinate(getTimePixel(time), ctx.lineWidth);

        if (!swapAxis) {
          ctx.beginPath();
          ctx.strokeStyle = timeCaptionsStyles[1].color;
          ctx.lineWidth = 1;
          let tickHeight = 4;
          const mod = time % (60 * 60 * 1000);
          if (mod === 0) {
            tickHeight = 8;
          } else if (mod % (30 * 60 * 1000) === 0) {
            tickHeight = 6;
          }

          ctx.moveTo(timePixel, spaceAxisSize);
          ctx.lineTo(timePixel, spaceAxisSize + tickHeight);
          ctx.moveTo(timePixel, 0);
          ctx.lineTo(timePixel, tickHeight);
          ctx.stroke();

          ctx.fillStyle = timeCaptionsStyles[1].color;
          ctx.fillText(text, timePixel, styles.topOffset || 0);
          ctx.fillText(text, timePixel, spaceAxisSize + (styles.topOffset || 0));
        } else {
          ctx.save();
          ctx.translate(captionSize - (styles.topOffset || 0), timePixel);
          ctx.rotate(Math.PI / 2);
          ctx.strokeText(text, 0, 0);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      });

      // Render caption top border:
      ctx.strokeStyle = timeGraduationsStyles[1].color;
      ctx.lineWidth = timeGraduationsStyles[1].width;
      if (!showTicks) {
        ctx.beginPath();
        if (!swapAxis) {
          const y = getCrispLineCoordinate(spaceAxisSize, ctx.lineWidth);
          ctx.moveTo(0, y);
          ctx.lineTo(timeAxisSize, y);
        } else {
          const x = getCrispLineCoordinate(captionSize, ctx.lineWidth);
          ctx.moveTo(x, 0);
          ctx.lineTo(x, timeAxisSize);
        }
        ctx.stroke();
      }
    },
    []
  );

  useDraw('captions', drawingFunction);

  return null;
};
