import { drawTrack } from './drawTrack';
import type { SpaceTimeChartContextType } from '../../../../spaceTimeChart';
import { HOUR, MINUTE } from '../../../../spaceTimeChart/lib/consts';
import { TRACK_HEIGHT_CONTAINER, CANVAS_PADDING, COLORS, TICKS_PRIORITIES } from '../../consts';
import { type Track } from '../../types';
import { getLabelLevels, getLabelMarks } from '../../utils';

const { HOUR_BACKGROUND_1, HOUR_BACKGROUND_2 } = COLORS;

export const drawTracks = (
  ctx: CanvasRenderingContext2D,
  stcContext: SpaceTimeChartContextType,
  position: number,
  tracks: Track[]
) => {
  const {
    width,
    getSpacePixel,
    getTime,
    getTimePixel,
    timeScale,
    theme: { breakpoints, timeRanges },
  } = stcContext;
  const yStart = getSpacePixel(position);
  const yEnd = getSpacePixel(position, true);
  const height = yEnd - yStart;
  const timeStart = getTime(0);
  const timeEnd = getTime(width);
  const pixelsPerMinute = (1 / timeScale) * MINUTE;

  const labelLevels = getLabelLevels(breakpoints, pixelsPerMinute, TICKS_PRIORITIES);
  const labelMarks = getLabelMarks(timeRanges, timeStart, timeEnd, labelLevels);

  let hours = Math.floor(timeStart / HOUR);
  const hourEnd = timeEnd / HOUR;
  while (hours < hourEnd) {
    const x = getTimePixel(hours * HOUR);
    const w = getTimePixel((hours + 1) * HOUR) - x;
    ctx.fillStyle = hours % 2 ? HOUR_BACKGROUND_1 : HOUR_BACKGROUND_2;
    ctx.fillRect(x, yStart, w, height);
    hours++;
  }

  ctx.save();
  ctx.translate(0, yStart);
  tracks?.forEach((_, index) => {
    const trackTranslate = index === 0 ? CANVAS_PADDING : TRACK_HEIGHT_CONTAINER;
    ctx.translate(0, trackTranslate);
    drawTrack({
      ctx,
      width,
      getTimePixel,
      labelMarks,
    });
  });
  ctx.restore();
};
