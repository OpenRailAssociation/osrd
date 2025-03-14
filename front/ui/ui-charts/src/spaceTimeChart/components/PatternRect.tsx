import { useCallback } from 'react';

import { useDraw } from '../hooks/useCanvas';
import { type DrawingFunction } from '../lib/types';
import { fillRect, type CanvasRect } from '../utils/canvas';

export type PatternRectProps = CanvasRect & {
  imageElement: HTMLImageElement;
};

/**
 * draws a repeating pattern in the space time chart
 */
export const PatternRect = ({ imageElement, ...rect }: PatternRectProps) => {
  const drawPatternRect = useCallback<DrawingFunction>(
    (ctx, context) => {
      const pattern = ctx.createPattern(imageElement, 'repeat');
      if (pattern) {
        ctx.save();
        ctx.fillStyle = pattern;
        fillRect(ctx, rect, context);
        ctx.restore();
      }
    },
    [imageElement, rect]
  );
  useDraw('background', drawPatternRect);

  return null;
};
