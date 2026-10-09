import type { DrawFunctionParams } from '../../../types';
import { MARGINS } from '../../const';
import { clearCanvas, maxSpeedValue } from '../../utils';

const { MARGIN_LEFT, MARGIN_TOP, MARGIN_BOTTOM, CURVE_MARGIN_TOP } = MARGINS;
const TICK_WIDTH = 6;
const TEXT_POSITION_X = MARGIN_LEFT - TICK_WIDTH - 6;

export const drawAxisY = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const maxSpeed = maxSpeedValue(store);
  const { cursor } = store;

  clearCanvas(ctx, width, height);

  // Draw background
  const cursorHover = cursor.x !== null && cursor.y !== null && cursor.x < MARGIN_LEFT && cursor.y < height - MARGIN_BOTTOM;
  ctx.fillStyle = cursorHover ? 'white' : 'rgb(247, 246, 238)';
  ctx.fillRect(0, 0, MARGIN_LEFT, height);

  // Draw separator line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 0.5;
  ctx.moveTo(MARGIN_LEFT, 0);
  ctx.lineTo(MARGIN_LEFT, height);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = 'rgb(121, 118, 113)';
  ctx.lineWidth = 0.5;
  ctx.font = 'normal 12px IBM Plex Sans';
  ctx.fillStyle = 'rgb(182, 178, 175)';

  // Define the tick scale depending on the max speed
  let tickScale = 5;
  if (maxSpeed > 250) {
    tickScale = 30;
  } else if (maxSpeed > 130) {
    tickScale = 20;
  } else if (maxSpeed > 60) {
    tickScale = 10;
  }

  const nbTicks = Math.ceil(maxSpeed / tickScale);
  const maxTickSpeed = nbTicks * tickScale;
  const ratioRoundPositions = maxTickSpeed / maxSpeed;
  const ticksOffset =
    ((height - MARGIN_BOTTOM - MARGIN_TOP - CURVE_MARGIN_TOP) * ratioRoundPositions) / nbTicks;

  // Draw ticks with text
  ctx.beginPath();
  for (let i = 1; i <= nbTicks; i++) {
    const positionY = height - MARGIN_BOTTOM - ticksOffset * i;
    ctx.moveTo(MARGIN_LEFT - TICK_WIDTH, positionY);
    ctx.lineTo(MARGIN_LEFT, positionY);
    ctx.textAlign = 'right';
    const text = (i * tickScale).toString();
    const textPositionY = positionY + 4;

    ctx.fillStyle = `rgb(182, 178, 175 )`;
    ctx.fillText(text, TEXT_POSITION_X, textPositionY);
  }
  ctx.stroke();

  // Draw major lines
  ctx.strokeStyle = 'rgba(33, 112, 185, 0.6)';
  ctx.beginPath();
  ctx.lineWidth = 0.5;
  for (let i = 3; i <= nbTicks; i += 3) {
    const positionY = height - MARGIN_BOTTOM - ticksOffset * i;
    ctx.moveTo(MARGIN_LEFT, positionY);
    ctx.lineTo(width, positionY);
  }
  ctx.stroke();

  // Draw minor lines
  ctx.strokeStyle = 'rgba(33, 112, 185, 0.25)';
  ctx.beginPath();
  for (let i = 1; i <= nbTicks; i++) {
    if (i % 3 === 0) {
      continue;
    }
    const positionY = height - MARGIN_BOTTOM - ticksOffset * i;
    ctx.moveTo(MARGIN_LEFT, positionY);
    ctx.lineTo(width, positionY);
  }
  ctx.stroke();
};
