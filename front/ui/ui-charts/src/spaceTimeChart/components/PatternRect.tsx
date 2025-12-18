import { useCallback } from 'react';

import { useDraw } from '../../common/hooks/useCanvas';
import type { DrawingFunction } from '../../common/types';
import { SpaceTimeChartCanvasContext } from '../lib/context';
import type { SpaceTimeChartContextType } from '../lib/types';
import { fillRect, type CanvasRect } from '../utils/canvas';

export type PatternRectProps = CanvasRect & {
  imageElement: HTMLImageElement;
};

/**
 * draws a repeating pattern in the space time chart
 */
export const PatternRect = ({ imageElement, ...rect }: PatternRectProps) => {
  const drawPatternRect = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
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
  useDraw(SpaceTimeChartCanvasContext, 'background', drawPatternRect);

  return null;
};
