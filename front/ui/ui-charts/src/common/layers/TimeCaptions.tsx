import { useCallback } from 'react';

import { AMBIENT_COLORS } from '@osrd-project/ui-core';

import { HOUR, MINUTE } from '../../common/consts';
import { TimeChartCanvasContext } from '../../common/context';
import { BLACK_ALPHA_10 } from '../../common/helpers/colors';
import { computeVisibleTimeMarkers, getCrispLineCoordinate } from '../../common/helpers/time';
import { useDraw } from '../../common/hooks/useCanvas';
import type { DrawingFunction, TimeChartContextType } from '../../common/types';

const MARGIN = 100;
export const TOP_CAPTION_HEIGHT = 24;

const MINUTE_OPTIONS: Intl.DateTimeFormatOptions = {
  minute: '2-digit',
  hour12: false,
};

const HOUR_OPTIONS_SHORT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  hour12: false,
};

const HOUR_OPTIONS_LONG: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const MINUTES_FORMATTER = (t: number) => {
  const minutes = new Date(t).toLocaleTimeString(undefined, MINUTE_OPTIONS);
  return `:${minutes}`;
};

const HOURS_FORMATTER = (t: number, pixelsPerMinute: number) =>
  new Date(t).toLocaleTimeString(
    undefined,
    pixelsPerMinute > 1 ? HOUR_OPTIONS_LONG : HOUR_OPTIONS_SHORT
  );

// Signed integer hour count relative to time origin 0, used for the hourly
// pattern mode (e.g. hourly timetables): …, -2, -1, 0, 1, 2, …
const HOURLY_HOURS_FORMATTER = (t: number) => `${Math.round(t / HOUR)}`;

const DATES_FORMATER = (t: number) => new Date(t).toLocaleDateString(undefined, DATE_OPTIONS);

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

const HOURLY_RANGES_FORMATER = RANGES_FORMATER.map((f) =>
  f === HOURS_FORMATTER ? HOURLY_HOURS_FORMATTER : f
);

export const TimeCaptions = () => {
  const drawingFunction = useCallback<DrawingFunction<TimeChartContextType>>(
    (
      ctx,
      {
        timeScale,
        timeOrigin,
        timePixelOffset,
        getTimePixel,
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
        captionSize = 40,
        swapAxis = false,
        hideTimeCaptions = false,
        hideDates = false,
        hourlyTimetableDuration,
        showTicks = false,
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

      const rangesFormatter = hourlyTimetableDuration ? HOURLY_RANGES_FORMATER : RANGES_FORMATER;

      let labelMarks = computeVisibleTimeMarkers(
        minT,
        maxT,
        timeRanges,
        labelLevels,
        (level: number, i: number) => ({
          level,
          styles: timeCaptionsStyles[level],
          formatter: rangesFormatter[i],
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
        ctx.fillStyle = AMBIENT_COLORS.ambientB5;
        ctx.fillRect(0, 0, width, TOP_CAPTION_HEIGHT);
        ctx.fillStyle = background;
        ctx.fillRect(0, spaceAxisSize, timeAxisSize, captionSize);
      } else {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, captionSize, timeAxisSize);
      }

      // Render time captions:
      labelMarks.forEach(({ styles, formatter, time }) => {
        const text = formatter(time, pixelsPerMinute);

        ctx.save();
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
        ctx.restore();
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
        if (!swapAxis) {
          ctx.strokeStyle = BLACK_ALPHA_10;
          ctx.beginPath();
          const yTop = getCrispLineCoordinate(TOP_CAPTION_HEIGHT, ctx.lineWidth);
          ctx.moveTo(0, yTop);
          ctx.lineTo(timeAxisSize, yTop);
          ctx.stroke();
        }
      }
    },
    []
  );

  useDraw(TimeChartCanvasContext, 'captions', drawingFunction);

  return null;
};
