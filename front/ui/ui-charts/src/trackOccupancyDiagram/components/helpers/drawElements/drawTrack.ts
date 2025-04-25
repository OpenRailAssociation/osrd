import { sum } from 'lodash';

import { TRACK_HEIGHT_CONTAINER, COLORS, TICKS_PATTERN } from '../../consts';
import { getTickPattern } from '../../utils';

const { WHITE_100, WHITE_50, GREY_20, RAIL_TICK } = COLORS;

const drawRails = ({
  xStart,
  yStart,
  width,
  stroke = GREY_20,
  ctx,
}: {
  xStart: number;
  yStart: number;
  width: number;
  stroke?: string;
  ctx: CanvasRenderingContext2D;
}) => {
  ctx.fillStyle = WHITE_100;
  ctx.fillRect(xStart, yStart, width, 9);

  ctx.fillStyle = WHITE_50;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(xStart, yStart, width, 8);
  ctx.fill();
  ctx.stroke();
};

const drawTick = ({
  ctx,
  xStart,
  yStart,
  ticks,
  stroke,
}: {
  ctx: CanvasRenderingContext2D;
  xStart: number;
  yStart: number;
  ticks: number[];
  stroke: string;
}) => {
  const sumTicks = sum(ticks) / 2;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.setLineDash(ticks);
  ctx.moveTo(xStart, yStart - sumTicks);
  ctx.lineTo(xStart, yStart + sumTicks);
  ctx.stroke();
};

type DrawTrackProps = {
  ctx: CanvasRenderingContext2D;
  width: number;
  getTimePixel: (time: number) => number;
  labelMarks: Record<number, { level: number; rangeIndex: number }>;
};

export const drawTrack = ({ ctx, width, getTimePixel, labelMarks }: DrawTrackProps) => {
  ctx.fillStyle = WHITE_50;

  ctx.save();

  drawRails({ xStart: -1, yStart: TRACK_HEIGHT_CONTAINER / 2 - 4, width: width + 1, ctx });

  for (const t in labelMarks) {
    const date = new Date(+t);
    const minutes = date.getMinutes().toString().padStart(2, '0');

    const tickPattern = getTickPattern(minutes);

    drawTick({
      ctx,
      xStart: getTimePixel(+t),
      yStart: TRACK_HEIGHT_CONTAINER / 2,
      ticks: TICKS_PATTERN[tickPattern],
      stroke: RAIL_TICK,
    });
  }

  ctx.restore();
};
