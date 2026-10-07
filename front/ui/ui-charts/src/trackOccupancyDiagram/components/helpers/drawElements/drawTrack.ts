import { sum } from 'lodash';

import {
  SKY_700,
  WHITE_ALPHA_100,
  WHITE_ALPHA_50,
  PRIMARY_5,
  PRIMARY_30,
  GREY_20,
} from '../../../../common/helpers/colors';
import { TRACK_HEIGHT_CONTAINER, TICKS_PATTERN } from '../../../lib/consts';
import { getTickPattern } from '../../utils';

const drawRails = ({
  xStart,
  yStart,
  width,
  fill,
  stroke,
  ctx,
}: {
  xStart: number;
  yStart: number;
  width: number;
  fill: string;
  stroke: string;
  ctx: CanvasRenderingContext2D;
}) => {
  ctx.fillStyle = WHITE_ALPHA_100;
  ctx.fillRect(xStart, yStart, width, 9);

  ctx.fillStyle = fill;
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
  highlighted?: boolean;
};

export const drawTrack = ({
  ctx,
  width,
  getTimePixel,
  labelMarks,
  highlighted,
}: DrawTrackProps) => {
  ctx.fillStyle = WHITE_ALPHA_50;

  ctx.save();

  drawRails({
    ctx,
    xStart: -1,
    yStart: TRACK_HEIGHT_CONTAINER / 2 - 4,
    width: width + 1,
    fill: highlighted ? PRIMARY_5 : WHITE_ALPHA_50,
    stroke: highlighted ? PRIMARY_30 : GREY_20,
  });

  for (const t in labelMarks) {
    const date = new Date(+t);
    const minutes = date.getMinutes().toString().padStart(2, '0');

    const tickPattern = getTickPattern(minutes);

    drawTick({
      ctx,
      xStart: getTimePixel(+t),
      yStart: TRACK_HEIGHT_CONTAINER / 2,
      ticks: TICKS_PATTERN[tickPattern],
      stroke: SKY_700,
    });
  }

  ctx.restore();
};
