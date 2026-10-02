import chroma from 'chroma-js';

import type { DrawFunctionParams } from '../../../types';
import { MARGINS } from '../../consts';
import { FONT_SANS_REGULAR } from '../../../../common/consts';
import { BLACK_ALPHA_100, GREY_50 } from '../../../../common/helpers/colors';
import {
  clearCanvas,
  positionToPosX,
  maxPositionValue,
  getDisplayedStops,
  getSnappedStop,
} from '../../utils';

const { MARGIN_LEFT } = MARGINS;

const STEP_HEIGHT = 6;
const STEP_WIDTH = 1;
const STEP_RADIUS = 1.0;
const FADE_RADIUS = 100;

export const drawSteps = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { stops, ratioX, leftOffset, cursor } = store;
  if (stops.length === 0) {
    return;
  }

  clearCanvas(ctx, width, height);

  const maxPosition = maxPositionValue(store.speeds);
  const cursorX = (cursor.x && cursor.y && cursor.y < height && cursor.x > MARGIN_LEFT && cursor.x < width + MARGIN_LEFT) ? cursor.x : null;

  const filteredStops = getDisplayedStops(stops, ratioX, width, maxPosition);

  ctx.save();
  ctx.translate(leftOffset, 0);

  // Step rectangles
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  ctx.fillStyle = GREY_50;
  ctx.strokeStyle = GREY_50;

  const snappedStop = cursorX ? getSnappedStop(cursorX, width, store) : null;

  filteredStops.forEach(({ position }) => {
    if (snappedStop && position.start === snappedStop.position.start) {
      return;
    }
    const posX = positionToPosX(position.start, maxPosition, width, ratioX);

    ctx.beginPath();
    ctx.roundRect(
      posX - STEP_WIDTH / 2,
      height - STEP_HEIGHT - 1,
      STEP_WIDTH,
      STEP_HEIGHT,
      [STEP_RADIUS, STEP_RADIUS, 0, 0]
    );
    ctx.fill();
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();

  // Text and lines
  ctx.strokeStyle = 'rgba(33, 112, 185, 0.25)';
  ctx.lineWidth = 1;
  const reticlePositionX = cursorX ? cursorX - MARGIN_LEFT : Infinity;

  getDisplayedStops(filteredStops, ratioX, width, maxPosition, 25).forEach(({ position, value }) => {

    const posX = positionToPosX(position.start, maxPosition, width, ratioX, leftOffset);

    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(posX, 0);
    ctx.lineTo(posX, height);
    ctx.stroke();

    if (snappedStop && position.start === snappedStop.position.start) {
      return;
    }

    ctx.save();
    // Calculate the original x and y positions before rotation
    const posY = height - STEP_HEIGHT - 8;

    // Apply the translation and rotation
    ctx.translate(posX, posY);
    ctx.rotate((-40 * Math.PI) / 180); // -40 degrees in radians

    // Check if the current step is within the 4 previous or 4 next steps
    const alpha = Math.max(0.2, Math.min(1, 1.5 - Math.abs(reticlePositionX - posX) / FADE_RADIUS));
    ctx.fillStyle = chroma(BLACK_ALPHA_100).alpha(alpha).hex();

    ctx.font = FONT_SANS_REGULAR;
    ctx.textAlign = 'left';

    // Draw the text at the origin, since the context is already transformed
    ctx.fillText(value!.name, 0, 0);
    ctx.restore();
  });
};
