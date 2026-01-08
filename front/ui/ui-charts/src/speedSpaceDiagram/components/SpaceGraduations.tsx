import { useCallback } from 'react';

import { useDraw, type DrawingFunction } from '../../common';
import { SpeedSpaceDiagramCanvasContext } from '../context';
import type { SpeedSpaceDiagramContextType } from '../types';

const MARGIN_LEFT = 48; // px, space for speed graduations
const MARGIN_BOTTOM = 52.5; // px
const MARGIN_RIGHT = 12;
const PADDING_HORIZONTAL = 8;

const getOpacityFromBorder = (distanceFromBorder: number, textWidth: number) => Math.max(
        Math.min(distanceFromBorder / (textWidth * 2) - 0.1, 1),
        0
      )

const SpaceGraduations = () => {
  const drawingFunction = useCallback<DrawingFunction<SpeedSpaceDiagramContextType>>(
    (ctx, store) => {

      const { width, height, spaceScale: maxPosition } = store;


      // ctx.translate(MARGIN_LEFT, 0);

      ctx.strokeStyle = 'rgb(121, 118, 113)';
      ctx.lineWidth = 0.5;
      ctx.font = 'normal 12px IBM Plex Sans';
      ctx.fillStyle = 'rgb(182, 179, 175)';

      const ratioX = 1; // no zoom for the moment
      const windowLength = maxPosition / ratioX;

      // Define the tick scale and the principle tick frequency given the window length
      let tickScale: number;
      let principleTickFrequency: number;
      if (windowLength >= 200) {
        tickScale = Math.floor(windowLength / 200) * 5;
        principleTickFrequency = 2;
      } else if (windowLength >= 50) {
        tickScale = 2;
        principleTickFrequency = 5;
      } else if (windowLength >= 20) {
        tickScale = 1;
        principleTickFrequency = 5;
      } else {
        tickScale = 0.1;
        principleTickFrequency = 5;
      }

      // `ratioRoundPositions` is the ratio of the canva width that would contain ticks.
      // Without using this value, ticks would be spread out along the X axis and would not fall on integer positions.
      const nbTicks = Math.floor(maxPosition / tickScale);
      const lastTickPosition = nbTicks * tickScale;
      const ratioRoundPositions = lastTickPosition / maxPosition;

      const innerCanvasWidth = width - PADDING_HORIZONTAL * 2 - MARGIN_LEFT - MARGIN_RIGHT;
      const ticksOffset = (innerCanvasWidth * ratioRoundPositions * ratioX) / nbTicks;

      const Y_OFFSET = height - MARGIN_BOTTOM;
      const X_OFFSET = MARGIN_LEFT + PADDING_HORIZONTAL;

      ctx.beginPath();

      for (let i = 0; i <= nbTicks; i++) {
        const positionX = X_OFFSET + ticksOffset * i;

        // Draw principle ticks given the frequency
        const tickSize = i % principleTickFrequency === 0 ? 8 : 4;

        ctx.moveTo(positionX, Y_OFFSET);
        ctx.lineTo(positionX, Y_OFFSET + tickSize);

        // Draw position text every 2 principle ticks
        if (i % (principleTickFrequency * 2) === 0) {
          ctx.textAlign = 'center';
          const textPosition = (tickScale * i).toFixed(0);
          const textWidth = ctx.measureText(textPosition).width;

          // Reduce progressively opacity for text when text is near the cursor or borders
          const leftBorderOpacity = i !== 0 ? getOpacityFromBorder(X_OFFSET - positionX, textWidth) : 1;
          const rightBorderOpacity = getOpacityFromBorder(width - MARGIN_RIGHT - PADDING_HORIZONTAL - positionX, textWidth)
          const opacity = Math.min(leftBorderOpacity, rightBorderOpacity);

          ctx.fillStyle = `rgb(182, 179, 175, ${opacity})`;
          ctx.fillText(textPosition, positionX, Y_OFFSET + 20);
        }
      }

      ctx.closePath();
      ctx.stroke();

      // ctx.restore();

      // prevent overlapping with margins left and right
      // ctx.clearRect(0, 0, MARGIN_LEFT, height);
      // ctx.clearRect(width - MARGIN_RIGHT, 0, width, height);

      // legend for x axis
      ctx.fillStyle = 'rgb(182, 179, 175)';
      ctx.textAlign = 'center';
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.fillText('km', width - MARGIN_RIGHT - PADDING_HORIZONTAL, Y_OFFSET + 20);
      ctx.closePath();
      ctx.stroke();
    },
    []
  );

  useDraw(SpeedSpaceDiagramCanvasContext, 'graduations', drawingFunction);

  return null;
};

export default SpaceGraduations;
