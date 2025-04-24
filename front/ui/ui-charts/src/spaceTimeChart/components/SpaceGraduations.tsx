import { useCallback } from 'react';

import { useDraw } from '../hooks/useCanvas';
import { type DrawingFunction } from '../lib/types';
import { getCrispLineCoordinate } from '../utils/canvas';
import { getSpacePixels } from '../utils/paths';

const SpaceGraduations = () => {
  const drawingFunction = useCallback<DrawingFunction>(
    (
      ctx,
      {
        timePixelOffset,
        getSpacePixel,
        operationalPoints,
        flatSteps,
        swapAxis,
        width,
        height,
        theme: { spaceGraduationsStyles },
      }
    ) => {
      const axisSize = !swapAxis ? width : height;

      // Draw operational point lines:
      operationalPoints.forEach((point) => {
        if (flatSteps.has(point.position)) return;

        const styles = spaceGraduationsStyles[point.importanceLevel || 0];
        if (!styles) return;

        ctx.strokeStyle = styles.color;
        ctx.lineWidth = styles.width;
        ctx.globalAlpha = styles.opacity || 1;
        if (styles.dashArray) {
          ctx.setLineDash(styles.dashArray || []);
          ctx.lineDashOffset = -timePixelOffset;
        }

        // Detect flat steps, and draw two graduations if any (one on each side of the step):
        getSpacePixels(getSpacePixel, point.position).forEach((rawPixel) => {
          const spacePixel = getCrispLineCoordinate(rawPixel, ctx.lineWidth);

          ctx.beginPath();
          if (!swapAxis) {
            ctx.moveTo(0, spacePixel);
            ctx.lineTo(axisSize, spacePixel);
          } else {
            ctx.moveTo(spacePixel, 0);
            ctx.lineTo(spacePixel, axisSize);
          }
          ctx.stroke();
        });
      });

      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
    },
    []
  );

  useDraw('graduations', drawingFunction);

  return null;
};

export default SpaceGraduations;
