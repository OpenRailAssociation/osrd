import chroma from 'chroma-js';

import type { DrawFunctionParams, LayerData } from '../../../types';
import { MARGINS } from '../../const';
import { clearCanvas, maxPositionValue, maxSpeedValue } from '../../utils';

const { CURVE_MARGIN_TOP, CURVE_MARGIN_SIDES } = MARGINS;

const computeCurvePoints = (
  canvasConfig: { width: number; height: number },
  curveConfig: { maxSpeed: number; maxPosition: number; ratioX: number },
  specificSpeeds: LayerData<number>[]
) => {
  const { maxSpeed, maxPosition, ratioX } = curveConfig;
  const { width, height } = canvasConfig;

  const adjustedWidth = width - CURVE_MARGIN_SIDES;
  const halfCurveMarginSides = CURVE_MARGIN_SIDES / 2;
  const adjustedHeight = height - CURVE_MARGIN_TOP;
  const xcoef = (adjustedWidth / maxPosition) * ratioX;
  const points: { x: number; y: number }[] = [];

  specificSpeeds.forEach(({ position, value }) => {
    // normalize speed based on range of values
    const normalizedSpeed = value / maxSpeed;
    const x = position.start * xcoef + halfCurveMarginSides;
    const y = height - normalizedSpeed * adjustedHeight;
    points.push({ x, y });
  });

  // Close the path
  points.push({ x: maxPosition * xcoef + halfCurveMarginSides, y: height });
  points.push({ x: halfCurveMarginSides, y: height });
  return points;
};

export const drawCurve = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { speeds, ecoSpeeds, ratioX, leftOffset } = store;
  const baseSpeedColor = chroma(17, 101, 180);
  const ecoSpeedColor = chroma(7, 69, 128);

  clearCanvas(ctx, width, height);

  ctx.save();
  ctx.translate(leftOffset, 0);

  const maxSpeed = maxSpeedValue(store);
  const maxPosition = maxPositionValue(store.speeds);

  const curvePoints = computeCurvePoints(
    { width, height },
    { maxSpeed, maxPosition, ratioX },
    speeds
  );
  const ecoCurvePoints = computeCurvePoints(
    { width, height },
    { maxSpeed, maxPosition, ratioX },
    ecoSpeeds
  );

  // Curves must be drawn twice one for the fill and one for the stroke
  // The stroke must not draw the last two points. They're only present to close the shape but are not part of the curve.

  ctx.beginPath();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = baseSpeedColor.hex();
  ctx.fillStyle = baseSpeedColor.alpha(0.15).hex();
  curvePoints.forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.fill();

  ctx.beginPath();
  curvePoints.slice(0, curvePoints.length - 2).forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = 'rgba(255, 255, 255)';
  ctx.strokeStyle = ecoSpeedColor.hex();
  ctx.globalCompositeOperation = 'destination-out';
  ecoCurvePoints.forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.fill();

  ctx.beginPath();
  ctx.globalCompositeOperation = 'source-over';
  ecoCurvePoints.slice(0, ecoCurvePoints.length - 2).forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.restore();
};
