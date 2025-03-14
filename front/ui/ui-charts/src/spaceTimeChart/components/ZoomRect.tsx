import { useCallback } from 'react';

import { useDraw } from '../hooks/useCanvas';
import { type DrawingFunction } from '../lib/types';
import { fillRect, type CanvasRect } from '../utils/canvas';

/**
 * radius 1 black dot with radius 3 white region around it
 */
function squareDot(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.fillRect(cx - 1, cy - 1, 3, 3);
  ctx.fill();

  ctx.fillStyle = 'black';
  ctx.fillRect(cx, cy, 1, 1);
  ctx.fill();
  ctx.restore();
}

const LINE_WIDTH = 1;
const SPACING = 4;

export const ZoomRect = (rect: CanvasRect) => {
  const drawZoomRect = useCallback<DrawingFunction>(
    (ctx, context) => {
      ctx.save();
      ctx.fillStyle = '#0000000D'; /* black5 */
      const { width, height } = fillRect(ctx, rect, context);
      if (width && height) {
        ctx.lineWidth = LINE_WIDTH;

        for (let i = 0; Math.abs(i) < Math.abs(width); i += SPACING * Math.sign(width)) {
          squareDot(ctx, i, 0);
          squareDot(ctx, i, 0 + height);
        }
        for (let i = 0; Math.abs(i) < Math.abs(height); i += SPACING * Math.sign(height)) {
          squareDot(ctx, 0, i);
          squareDot(ctx, 0 + width, i);
        }
      }
      ctx.restore();
    },
    [rect]
  );
  useDraw('background', drawZoomRect);

  return null;
};
