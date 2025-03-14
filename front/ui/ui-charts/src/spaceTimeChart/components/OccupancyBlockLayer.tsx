import { useCallback } from 'react';

import { useDraw } from '../hooks/useCanvas';
import { type DrawingFunction } from '../lib/types';

export type OccupancyBlock = {
  timeStart: number;
  timeEnd: number;
  spaceStart: number;
  spaceEnd: number;
  color: string;
  blinking?: boolean;
};

export type OccupancyBlockLayerProps = {
  occupancyBlocks: OccupancyBlock[];
};

const getFillStyle = (ctx: CanvasRenderingContext2D, color: string, isBlinking?: boolean) => {
  if (isBlinking) {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 8;
    patternCanvas.height = 8;
    const pctx = patternCanvas.getContext('2d')!;
    pctx.clearRect(0, 0, 8, 8);
    pctx.strokeStyle = color;
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(0, 8);
    pctx.lineTo(8, 0);
    pctx.stroke();
    return ctx.createPattern(patternCanvas, 'repeat')!;
  }
  return color;
};

export const OccupancyBlockLayer = ({ occupancyBlocks }: OccupancyBlockLayerProps) => {
  const drawOccupancyBlockLayer = useCallback<DrawingFunction>(
    (ctx, { getTimePixel, getSpacePixel }) => {
      for (const occupancyBlock of occupancyBlocks) {
        const x = getTimePixel(occupancyBlock.timeStart);
        const y = getSpacePixel(occupancyBlock.spaceStart);
        const width = getTimePixel(occupancyBlock.timeEnd) - x;
        const height = getSpacePixel(occupancyBlock.spaceEnd) - y;

        ctx.fillStyle = getFillStyle(ctx, occupancyBlock.color, occupancyBlock.blinking);
        ctx.fillRect(x, y, width, height);
      }
    },
    [occupancyBlocks]
  );

  useDraw('background', drawOccupancyBlockLayer);

  return null;
};
