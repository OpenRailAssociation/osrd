import * as d3 from 'd3';
import {
  GradientPosition,
  HeightPosition,
  PositionSpeedTime,
  RadiusPosition,
} from 'reducers/osrdsimulation/types';

const calculateReferentialHeight = (
  referential: PositionSpeedTime[],
  nameOfReferential: keyof PositionSpeedTime
) => {
  const maxRef = d3.max(referential.map((step) => step[nameOfReferential]));
  const minRef = d3.min(referential.map((step) => step[nameOfReferential]));
  let refHeight = 0;
  if (maxRef !== undefined && minRef !== undefined) {
    refHeight = maxRef - minRef;
  }
  return refHeight;
};

export const createCurveCurve = (
  curves: RadiusPosition[],
  referential: PositionSpeedTime[],
  nameOfReferential: keyof PositionSpeedTime
): RadiusPosition[] => {
  const referentialHeight = calculateReferentialHeight(referential, nameOfReferential);
  const maxRadius = d3.max(curves.map((step) => step.radius));
  const minRadius = d3.min(curves.map((step) => step.radius));
  let dataHeight = 0;
  if (maxRadius !== undefined && minRadius !== undefined) {
    dataHeight = maxRadius - minRadius;
  }
  return curves.map((step) => ({
    ...step,
    radius: step.radius > 0 ? (step.radius * referentialHeight) / dataHeight : 0,
  }));
};

export const createSlopeCurve = (
  slopes: GradientPosition[],
  referential: PositionSpeedTime[],
  nameOfReferential: keyof PositionSpeedTime
): HeightPosition[] => {
  const slopesCurve: HeightPosition[] = [];
  slopes.forEach((step, idx) => {
    if (idx % 2 === 0 && slopes[idx + 1]) {
      if (idx === 0) {
        slopesCurve.push({ height: 0, position: step.position });
      } else {
        const distance = step.position - slopesCurve[slopesCurve.length - 1].position;
        const height =
          (distance * slopes[idx - 2].gradient) / 1000 + slopesCurve[slopesCurve.length - 1].height;
        slopesCurve.push({ height, position: step.position });
      }
    }
  });
  const referentialHeight = calculateReferentialHeight(referential, nameOfReferential);
  const maxRadius = d3.max(slopesCurve.map((step) => step.height));
  const minRadius = d3.min(slopesCurve.map((step) => step.height));
  let dataHeight = 0;
  if (maxRadius !== undefined && minRadius !== undefined) {
    dataHeight = maxRadius - minRadius;
  }
  return slopesCurve.map((step) => ({
    ...step,
    height: (step.height * referentialHeight) / dataHeight,
  }));
};
