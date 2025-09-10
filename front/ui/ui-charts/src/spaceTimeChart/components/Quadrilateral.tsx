import { useCallback } from 'react';

import { useDraw, usePicking } from '../hooks/useCanvas';
import type {
  DataPoint,
  DrawingFunction,
  PickingDrawingFunction,
  PickingElement,
  Point,
} from '../lib/types';
import { drawAliasedQuadrilateral } from '../utils/canvas';
import { hexToRgb, indexToColor } from '../utils/colors';

export type QuadrilaterPickingElement = PickingElement & {
  type: 'quadrilateral';
  id: string;
};

export function isQuadrilaterPickingElement(
  element: PickingElement
): element is QuadrilaterPickingElement {
  return element.type === 'quadrilateral';
}

export type QuadrilateralProps = {
  id: string;
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
export const Quadrilateral = ({ id, vertices, style }: QuadrilateralProps) => {
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

  const drawPicking = useCallback<PickingDrawingFunction>(
    (imageData, { registerPickingElement, getTimePixel, getSpacePixel }, scalingRatio) => {
      const points = vertices.map(
        (vertice): Point => ({
          x: getTimePixel(vertice.time),
          y: getSpacePixel(vertice.position),
        })
      ) as [Point, Point, Point, Point];

      const pickingElement: QuadrilaterPickingElement = { type: 'quadrilateral', id };
      const index = registerPickingElement(pickingElement);
      const color = hexToRgb(indexToColor(index));

      drawAliasedQuadrilateral(imageData, points, color, scalingRatio);
    },
    [id, vertices]
  );
  usePicking('paths', drawPicking);

  return null;
};
