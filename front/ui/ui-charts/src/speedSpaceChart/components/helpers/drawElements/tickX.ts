import type { DrawFunctionParams } from '../../../types';
import { MARGINS } from '../../const';
import { clearCanvas, maxPositionValue } from '../../utils';

const { MARGIN_LEFT, MARGIN_RIGHT, MARGIN_BOTTOM, CURVE_MARGIN_SIDES } = MARGINS;

export const drawTickX = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { ratioX, leftOffset, cursor } = store;

  clearCanvas(ctx, width, height);

  ctx.save();
  ctx.translate(leftOffset, 0);

  ctx.strokeStyle = 'rgb(121, 118, 113)';
  ctx.lineWidth = 0.5;
  ctx.font = 'normal 12px IBM Plex Sans';
  ctx.fillStyle = 'rgb(182, 179, 175)';

  const maxPosition = maxPositionValue(store.speeds);
  const windowLength = maxPosition / store.ratioX;

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

  // `ratioRoundPositions` is the ratio of the canva width that will contains ticks.
  // Without using this value, ticks will be spread out along the X axis and will not fall on integer positions.
  const nbTicks = Math.floor(maxPosition / tickScale);
  const maxTickPosition = nbTicks * tickScale;
  const ratioRoundPositions = maxTickPosition / maxPosition;
  const ticksOffset =
    ((width - CURVE_MARGIN_SIDES - MARGIN_LEFT - MARGIN_RIGHT) * ratioRoundPositions * ratioX) /
    nbTicks;

  ctx.beginPath();
  const positionY = height - MARGIN_BOTTOM;

  for (let i = 0; i <= nbTicks; i++) {
    const positionX = MARGIN_LEFT + CURVE_MARGIN_SIDES / 2 + ticksOffset * i;

    // Draw principle ticks given the frequency
    const tickSize =
      i % principleTickFrequency === 0 ? CURVE_MARGIN_SIDES * 0.66 : CURVE_MARGIN_SIDES * 0.33;

    ctx.moveTo(positionX, positionY);
    ctx.lineTo(positionX, height - MARGIN_BOTTOM + tickSize);

    // Draw position text every 2 principle ticks
    if (i % (principleTickFrequency * 2) === 0) {
      ctx.textAlign = 'center';
      const textPosition = (tickScale * i).toFixed(0);
      const textWidth = ctx.measureText(textPosition).width;
      const fadeWidth = textWidth * 2;

      // Reduce progressively opacity for text when text is near the cursor or borders
      const cursorX = cursor.x ? cursor.x + MARGIN_LEFT - leftOffset : Infinity;
      const distanceCursor = Math.abs(cursorX - positionX);
      // The -0.1 is to hide completely the text when it's near enougth the cursor.
      // Clamp the opacity value between 0.0 and 1.0.
      const opacityCursor = Math.max(Math.min(distanceCursor / fadeWidth - 0.1, 1.0), 0.0);

      const distanceRightBorder = Math.abs(
        width - MARGIN_RIGHT - CURVE_MARGIN_SIDES / 2 - leftOffset - positionX
      );
      const opacityRightBorder = Math.max(
        Math.min(distanceRightBorder / fadeWidth - 0.1, 1.0),
        0.0
      );

      const distanceLeftBorder = Math.abs(
        MARGIN_LEFT + CURVE_MARGIN_SIDES / 2 - leftOffset - positionX
      );
      let opacityLeftBorder = Math.max(Math.min(distanceLeftBorder / fadeWidth - 0.1, 1.0), 0.0);
      // Special case for 0 (the first tick). We don't want to hide it when it's near the left border.
      if (i === 0) {
        opacityLeftBorder = 1.0;
      }

      // Merge opacities
      const opacity = Math.min(opacityCursor, opacityRightBorder, opacityLeftBorder);

      ctx.fillStyle = `rgb(182, 179, 175, ${opacity})`;
      ctx.fillText(textPosition, positionX, positionY + CURVE_MARGIN_SIDES * 1.33);
    }
  }

  ctx.closePath();
  ctx.stroke();

  ctx.restore();

  // prevent overlapping with margins left and right
  ctx.clearRect(0, 0, MARGIN_LEFT, height);
  ctx.clearRect(width - MARGIN_RIGHT, 0, width, height);

  // text for x axis
  ctx.fillStyle = 'rgb(182, 179, 175)';
  ctx.textAlign = 'center';
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.fillText(
    'km',
    width - MARGIN_RIGHT - CURVE_MARGIN_SIDES / 2,
    positionY + CURVE_MARGIN_SIDES * 1.33
  );
  ctx.closePath();
  ctx.stroke();
};
