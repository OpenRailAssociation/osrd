import type { DrawFunctionParams, EtcsBrakingCurveType, LayerData } from '../../../types';
import {
  BASE_SPEED_COLOR,
  BASE_SPEED_FILL_ALPHA,
  ECO_SPEED_COLOR,
  SPEEDS_LINEWIDTH,
  MARGINS,
  WHITE,
  ETCS_COLOR_DICTIONARY,
  ETCS_LINEWIDTH,
} from '../../const';
import {
  clearCanvas,
  getActiveEtcsBrakingCurveTypes,
  getActiveEtcsBrakingTypes,
  maxPositionValue,
  maxSpeedValue,
} from '../../utils';

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
  const { speeds, ecoSpeeds, etcsBrakingCurves, ratioX, leftOffset } = store;

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

  // Curves must be drawn twice, once for the fill and once for the stroke.
  // The stroke must not draw the last two points. They're only present to close the shape but are not part of the curve.
  ctx.lineWidth = SPEEDS_LINEWIDTH;

  // Fill speed curve.
  ctx.beginPath();
  ctx.fillStyle = BASE_SPEED_COLOR.alpha(BASE_SPEED_FILL_ALPHA).hex();
  curvePoints.forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.fill();
  // Stroke speed curve.
  ctx.beginPath();
  ctx.strokeStyle = BASE_SPEED_COLOR.hex();
  curvePoints.slice(0, curvePoints.length - 2).forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill eco speed curve.
  ctx.beginPath();
  ctx.fillStyle = WHITE.hex();
  ctx.globalCompositeOperation = 'destination-out';
  ecoCurvePoints.forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.fill();
  // Stroke eco speed curve.
  ctx.beginPath();
  ctx.strokeStyle = ECO_SPEED_COLOR.hex();
  ctx.globalCompositeOperation = 'source-over';
  ecoCurvePoints.slice(0, ecoCurvePoints.length - 2).forEach(({ x, y }) => {
    ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Stroke etcs curves.
  if (etcsBrakingCurves) {
    const strokeEtcsCurve = (
      etcsBrakingCurveType: EtcsBrakingCurveType,
      etcsCurve: LayerData<number>[]
    ) => {
      const etcsCurvePoints = computeCurvePoints(
        { width, height },
        { maxSpeed, maxPosition, ratioX },
        etcsCurve
      );
      ctx.beginPath();
      ctx.lineWidth = ETCS_LINEWIDTH;
      ctx.strokeStyle = ETCS_COLOR_DICTIONARY[etcsBrakingCurveType].hex();
      etcsCurvePoints.slice(0, etcsCurvePoints.length - 2).forEach(({ x, y }) => {
        ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    const activeEtcsBrakingTypes = getActiveEtcsBrakingTypes(store.etcsLayersDisplay);
    const activeEtcsBrakingCurveTypes = getActiveEtcsBrakingCurveTypes(store.etcsLayersDisplay);
    activeEtcsBrakingTypes.forEach((brakingType) => {
      const etcsCurves = etcsBrakingCurves[brakingType];
      etcsCurves.forEach((etcsCurve) => {
        activeEtcsBrakingCurveTypes.forEach((curveType) => {
          strokeEtcsCurve(curveType, etcsCurve[curveType]);
        });
      });
    });
  }

  ctx.restore();
};
