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

//TODO: In rendering this generic, ETCS code was removed. Don't forget to draw ETCS curves.
export const drawCurve = ({ ctx, store, layerData, canvasOptions }: DrawFunctionParams) => {
  const { width, height } = canvasOptions!;
  const { ratioX, leftOffset } = store;
  const maxSpeed = maxSpeedValue(store);
  const maxPosition = maxPositionValue(store.speeds);
  const curvePoints = computeCurvePoints(
    { width, height },
    { maxSpeed, maxPosition, ratioX },
    layerData! as LayerData<number>[]
  );

  clearCanvas(ctx, width, height);
  ctx.save();
  ctx.translate(leftOffset, 0);

  // Fill under the curve.
  if (canvasOptions!.fillOptions) {
    ctx.beginPath();
    ctx.fillStyle = canvasOptions!.fillOptions.fillStyle;
    ctx.globalCompositeOperation = canvasOptions!.fillOptions.globalCompositeOperation;
    curvePoints!.forEach(({ x, y }) => {
      ctx.lineTo(x, y);
    });
    ctx.fill();
  }

  // Stroke the curve.
  // The stroke must not draw the last two points. They're only present to close the shape but are not part of the curve.
  ctx.beginPath();
  ctx.lineWidth = canvasOptions!.strokeOptions.linewidth;
  ctx.strokeStyle = canvasOptions!.strokeOptions!.strokeStyle;
  ctx.globalCompositeOperation = canvasOptions!.strokeOptions!.globalCompositeOperation;
  curvePoints!.slice(0, layerData!.length - 2).forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.restore();
};
