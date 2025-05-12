import { drawTrack } from './drawTrack';
import type { SpaceTimeChartContextType } from '../../../../spaceTimeChart';
import { GREY_50, HOUR, MINUTE } from '../../../../spaceTimeChart/lib/consts';
import { TRACK_HEIGHT_CONTAINER, CANVAS_PADDING, COLORS, TICKS_PRIORITIES } from '../../consts';
import { type Track } from '../../types';
import { getLabelLevels, getLabelMarks } from '../../utils';

const { HOUR_BACKGROUND_1, HOUR_BACKGROUND_2 } = COLORS;

export const drawTracks = (
  ctx: CanvasRenderingContext2D,
  stcContext: SpaceTimeChartContextType,
  {
    position,
    tracks,
    drawBorders,
    topPadding = 0,
  }: {
    position: number;
    tracks: Track[];
    drawBorders: boolean;
    topPadding: number;
  }
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
  const flatStepHeight = yEnd - yStart;
  const timeStart = getTime(0);
  const timeEnd = getTime(width);
  const pixelsPerMinute = (1 / timeScale) * MINUTE;

  const labelLevels = getLabelLevels(breakpoints, pixelsPerMinute, TICKS_PRIORITIES);
  const labelMarks = getLabelMarks(timeRanges, timeStart, timeEnd, labelLevels);

  // Draw backgrounds:
  let hours = Math.floor(timeStart / HOUR);
  const hourEnd = timeEnd / HOUR;
  while (hours < hourEnd) {
    const x = getTimePixel(hours * HOUR);
    const w = getTimePixel((hours + 1) * HOUR) - x;
    ctx.fillStyle = hours % 2 ? HOUR_BACKGROUND_1 : HOUR_BACKGROUND_2;
    ctx.fillRect(x, yStart, w, flatStepHeight);
    hours++;
  }

  // Draw actual tracks:
  ctx.save();
  ctx.translate(0, yStart + topPadding);
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

  // Draw borders:
  if (drawBorders) {
    const externalBorderWidth = 1;
    const internalBorderWidth = 2;
    const fullBorderWidth = externalBorderWidth + internalBorderWidth;
    const yStartCrisp = Math.round(yStart);
    const yEndCrisp = Math.round(yEnd);
    ctx.fillStyle = GREY_50;
    ctx.fillRect(0, yStartCrisp, width, externalBorderWidth);
    ctx.fillRect(0, yEndCrisp - externalBorderWidth, width, externalBorderWidth);

    ctx.fillStyle = GREY_50;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, yStartCrisp + externalBorderWidth, width, internalBorderWidth);
    ctx.fillRect(0, yEndCrisp - fullBorderWidth, width, internalBorderWidth);
    ctx.globalAlpha = 1;
  }
};
