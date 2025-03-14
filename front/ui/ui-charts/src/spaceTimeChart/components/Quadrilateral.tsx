import { useCallback } from 'react';

import { useDraw } from '../hooks/useCanvas';
import { type DataPoint, type DrawingFunction } from '../lib/types';

export type QuadrilateralProps = {
  vertices: [DataPoint, DataPoint, DataPoint, DataPoint];
  style: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
  };
};

/**
 * Draws a quadrilateral in the space time chart
 * Position correspond to each point of the quadrilateral
 *
 *      vertices[0]   ________ vertices[1]
 *                  /        /
 *     vertices[3] /________/ vertices[2]
 *
 */
export const Quadrilateral = ({ vertices, style }: QuadrilateralProps) => {
  const drawRegion = useCallback<DrawingFunction>(
    (ctx, { getSpacePixel, getTimePixel }) => {
      ctx.save();

      ctx.fillStyle = style.backgroundColor ?? 'lightblue';
      ctx.strokeStyle = style.borderColor ?? 'lightblue';
      ctx.lineWidth = style.borderWidth ?? 1;

      ctx.beginPath();
      vertices.forEach((dataPoint) => {
        ctx.lineTo(getTimePixel(dataPoint.time), getSpacePixel(dataPoint.position));
      });
      ctx.closePath();

      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
    [vertices, style]
  );
  useDraw('background', drawRegion);

  return null;
};
