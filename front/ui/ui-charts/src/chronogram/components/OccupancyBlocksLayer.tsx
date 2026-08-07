import { useCallback, useContext } from 'react';

import { FONT_SANS } from '../../common/consts';
import { TimeChartCanvasContext } from '../../common/context';
import {
  BLACK_100,
  GREY_30,
  GREY_50,
  GREY_90,
  RED_100,
  WHITE_100,
} from '../../common/helpers/colors';
import { useDraw } from '../../common/hooks/useCanvas';
import type { TimeChartContextType, DrawingFunction } from '../../common/types';
import { LEVEL_CROSSING_ITEM_HEIGHT, CHRONOGRAM_HEADER_HEIGHT } from '../consts';
import { ChronogramContext } from '../lib/context';
import type { OccupancyBlock } from '../lib/types';
import { formatDuration } from '../utils/format';

const BLOCK_HEIGHT = 10;
const PADDING_TOP = 18;
const STRIPE_SPACING = 24;
const STRIPE_WIDTH = 8;
const TRACKS_INTERVALS = 3;
const CLOSING_TIME_Y_OFFSET = 5;
const TRAIN_NAME_Y_OFFSET = 14;

const drawTrackLines = (
  ctx: CanvasRenderingContext2D,
  width: number,
  bandTop: number,
  bandBottom: number
) => {
  const lineYs = [
    bandTop,
    bandTop + BLOCK_HEIGHT / TRACKS_INTERVALS,
    bandTop + (2 * BLOCK_HEIGHT) / TRACKS_INTERVALS,
    bandBottom,
  ];

  ctx.strokeStyle = GREY_30;
  ctx.lineWidth = 1;

  lineYs.forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });
};

const drawStripedBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number) => {
  ctx.save();

  ctx.beginPath();
  ctx.rect(x, y, width, BLOCK_HEIGHT);
  ctx.clip();

  ctx.fillStyle = WHITE_100;
  ctx.fillRect(x, y, width, BLOCK_HEIGHT);

  ctx.strokeStyle = RED_100;
  ctx.lineWidth = STRIPE_WIDTH;

  for (let offset = STRIPE_WIDTH / 2; offset < width + BLOCK_HEIGHT; offset += STRIPE_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y + BLOCK_HEIGHT + 2);
    ctx.lineTo(x + offset + BLOCK_HEIGHT, y - 2);
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = GREY_90;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, BLOCK_HEIGHT);
};

/** Draws a black block to indicate insufficient time between two occupancy blocks */
const drawGapBlock = (
  ctx: CanvasRenderingContext2D,
  bandTop: number,
  gapStartX: number,
  gapEndX: number
) => {
  const gapWidth = gapEndX - gapStartX;

  if (gapWidth > 0) {
    ctx.fillStyle = BLACK_100;
    ctx.fillRect(gapStartX - 0.5, bandTop - 0.5, gapWidth + 1, BLOCK_HEIGHT + 1);
  }
};

/** Draws text around an occupancy block */
const drawBlockText = ({
  ctx,
  x,
  y,
  text,
  color,
  maxWidth,
}: {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  text: string;
  color?: string;
  maxWidth?: number;
}) => {
  ctx.save();
  ctx.font = `12px ${FONT_SANS}`;
  if (color) ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
};

const drawBlocks = ({
  ctx,
  blocks,
  getTimePixel,
  bandTop,
  bandBottom,
}: {
  ctx: CanvasRenderingContext2D;
  blocks: OccupancyBlock[];
  getTimePixel: (time: number) => number;
  bandTop: number;
  bandBottom: number;
}) => {
  let previousBlockEndX: number | undefined;

  for (const block of blocks) {
    const blockStartX = getTimePixel(block.startTime);
    const blockEndX = getTimePixel(block.endTime);
    const blockWidth = blockEndX - blockStartX;
    const blockCenterX = blockStartX + blockWidth / 2;
    if (blockWidth <= 0) continue;

    if (previousBlockEndX !== undefined) {
      drawGapBlock(ctx, bandTop, previousBlockEndX, blockStartX);
    }

    drawBlockText({
      ctx,
      x: blockCenterX,
      y: bandTop - CLOSING_TIME_Y_OFFSET,
      text: formatDuration(block.startTime, block.endTime),
      maxWidth: blockWidth,
    });
    drawStripedBlock(ctx, blockStartX, bandTop, blockWidth);

    drawBlockText({
      ctx,
      x: blockCenterX,
      y: bandBottom + TRAIN_NAME_Y_OFFSET,
      text: block.trainNames.join('; '),
      color: GREY_50,
    });

    previousBlockEndX = blockEndX;
  }
};

export const OccupancyBlocksLayer = () => {
  const { levelCrossingsOccupancies, yPixelOffset } = useContext(ChronogramContext);
  const drawOccupancyBlocksLayer = useCallback<DrawingFunction<TimeChartContextType>>(
    (ctx, { getTimePixel }) => {
      const { width } = ctx.canvas.getBoundingClientRect();

      let startY = PADDING_TOP + CHRONOGRAM_HEADER_HEIGHT - yPixelOffset;

      for (const levelCrossing of levelCrossingsOccupancies) {
        const bandTop = startY;
        const bandBottom = startY + BLOCK_HEIGHT;

        drawTrackLines(ctx, width, bandTop, bandBottom);

        for (const blocks of levelCrossing) {
          if (!blocks.length) continue;

          drawBlocks({ ctx, blocks, getTimePixel, bandTop, bandBottom });
        }

        startY += LEVEL_CROSSING_ITEM_HEIGHT;
      }
    },
    [levelCrossingsOccupancies, yPixelOffset]
  );

  useDraw(TimeChartCanvasContext, 'overlay', drawOccupancyBlocksLayer);

  return null;
};
