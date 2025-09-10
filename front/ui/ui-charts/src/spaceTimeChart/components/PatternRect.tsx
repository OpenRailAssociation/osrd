import { useCallback } from 'react';

import type { DrawingFunction } from '../../common/types';
import { useDraw } from '../../common/useCanvas';
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
