import { useCallback } from 'react';

import { hexToRgb, indexToColor } from '../../common/helpers/colors';
import { useDraw, usePicking } from '../../common/hooks/useCanvas';
import type { DrawingFunction, PickingDrawingFunction, PickingElement } from '../../common/types';
import { SpaceTimeChartCanvasContext } from '../lib/context';
import type { SpaceTimeChartContextType } from '../lib/types';
import { drawAliasedRect } from '../utils/canvas';

export type Conflict = {
  timeStart: number;
  timeEnd: number;
  spaceStart: number;
  spaceEnd: number;
};

export const getConflictRect = (
  conflict: Conflict,
  getTimePixel: (time: number) => number,
  getSpacePixel: (space: number) => number
) => {
  const xStart = getTimePixel(conflict.timeStart);
  const xEnd = getTimePixel(conflict.timeEnd);
  const yStart = getSpacePixel(conflict.spaceStart);
  const yEnd = getSpacePixel(conflict.spaceEnd);
  return {
    x: Math.min(xStart, xEnd),
    y: Math.min(yStart, yEnd),
    width: Math.abs(xEnd - xStart),
    height: Math.abs(yEnd - yStart),
  };
};

export type ConflictPickingElement = PickingElement & {
  type: 'conflict';
  conflictIndex: number;
};

export function isConflictPickingElement(
  element: PickingElement
): element is ConflictPickingElement {
  return element.type === 'conflict';
}

export type ConflictLayerProps = {
  conflicts: Conflict[];
};

const BORDER_SIZE = 4;
const BORDERS = [
  { opacity: 0.33, color: '#d91c1c', size: 2 * BORDER_SIZE },
  { opacity: 0.5, color: '#ff6868', size: BORDER_SIZE },
  { opacity: 1, color: '#6b0000', size: 0 },
];

export const ConflictLayer = ({ conflicts }: ConflictLayerProps) => {
  const drawConflictLayer = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { getTimePixel, getSpacePixel }) => {
      const paths = BORDERS.map(() => new Path2D());
      for (const conflict of conflicts) {
        const { x, y, width, height } = getConflictRect(conflict, getTimePixel, getSpacePixel);
        for (let i = 0; i < BORDERS.length; i++) {
          const border = BORDERS[i].size;
          paths[i].rect(x - border, y - border, width + 2 * border, height + 2 * border);
        }
      }

      for (let i = 0; i < BORDERS.length; i++) {
        ctx.fillStyle = BORDERS[i].color;
        ctx.globalAlpha = BORDERS[i].opacity;
        ctx.fill(paths[i]);
      }
    },
    [conflicts]
  );

  useDraw(SpaceTimeChartCanvasContext, 'paths', drawConflictLayer);

  const drawPicking = useCallback<PickingDrawingFunction<SpaceTimeChartContextType>>(
    (imageData, { registerPickingElement, getTimePixel, getSpacePixel }, scalingRatio) => {
      for (const [conflictIndex, conflict] of conflicts.entries()) {
        const { x, y, width, height } = getConflictRect(conflict, getTimePixel, getSpacePixel);
        const border = BORDERS[0].size;

        const pickingElement: ConflictPickingElement = { type: 'conflict', conflictIndex };
        const index = registerPickingElement(pickingElement);
        const color = hexToRgb(indexToColor(index));

        drawAliasedRect(
          imageData,
          { x: x - border, y: y - border },
          width + 2 * border,
          height + 2 * border,
          color,
          scalingRatio
        );
      }
    },
    [conflicts]
  );

  usePicking(SpaceTimeChartCanvasContext, 'paths', drawPicking);

  return null;
};
