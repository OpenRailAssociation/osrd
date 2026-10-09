import type { DrawFunctionParams } from '../../../types';
import { MARGINS } from '../../const';
import { clearCanvas, maxPositionValue } from '../../utils';
import { ZOOM_CONFIG } from '../../const';

const { MARGIN_LEFT, MARGIN_BOTTOM, CURVE_MARGIN_SIDES } = MARGINS;

export const drawTickX = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { ratioX, leftOffset, cursor } = store;


  clearCanvas(ctx, width, height);
  ctx.save();

  // Draw background
  const positionY = height - MARGIN_BOTTOM;
  const cursorHover = cursor.y !== null && cursor.y > height - MARGIN_BOTTOM;
  const backgroundColor = cursorHover ? 'white' : 'rgb(250, 249, 245)';
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, positionY, width, MARGIN_BOTTOM);

  ctx.translate(leftOffset, 0);

  // Draw ticks and text
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
    ((width - CURVE_MARGIN_SIDES - MARGIN_LEFT ) * ratioRoundPositions * ratioX) /
    nbTicks;

  ctx.beginPath();

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
      let cursorX = Infinity;
      if (cursor.x !== null && cursor.y !== null && cursor.y < height - MARGIN_BOTTOM) {
          cursorX = cursor.x + MARGIN_LEFT - leftOffset;
      } 
      const distanceCursor = Math.abs(cursorX - positionX);
      // The -0.1 is to hide completely the text when it's near enougth the cursor.
      // Clamp the opacity value between 0.0 and 1.0.
      const opacityCursor = Math.max(Math.min(distanceCursor / fadeWidth - 0.1, 1.0), 0.0);

      const distanceRightBorder = Math.abs(
        width - CURVE_MARGIN_SIDES / 2 - leftOffset - positionX
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
  ctx.save();

  // prevent overlapping with slider
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(width - ZOOM_CONFIG.SLIDER_WIDTH - 21, positionY, width, MARGIN_BOTTOM);
  ctx.fillRect(0, positionY, MARGIN_LEFT, MARGIN_BOTTOM);

  // Draw separator line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 0.5;
  ctx.moveTo(0, positionY);
  ctx.lineTo(width, positionY);
  ctx.closePath();
  ctx.stroke();


  if (cursorHover) {
    const unitBoxWidth = 44;
    const unitBoxHeight = 32;
    const unitBoxOffset = 8;
    const unitBoxPostionX = (width - MARGIN_LEFT - CURVE_MARGIN_SIDES - unitBoxHeight) / 2;
    const unitBoxPositionY = height - MARGIN_BOTTOM - unitBoxOffset - unitBoxHeight; 
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.roundRect(unitBoxPostionX, unitBoxPositionY, unitBoxWidth, unitBoxHeight, 4);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.font = 'normal 14px IBM Plex Sans';
    ctx.fillText("km", unitBoxPostionX + unitBoxWidth / 2, unitBoxPositionY + unitBoxHeight / 2 + 4);
  }
  ctx.restore();
};
