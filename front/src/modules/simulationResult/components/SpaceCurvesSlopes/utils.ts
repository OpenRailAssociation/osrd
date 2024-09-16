import * as d3 from 'd3';

import type { PositionData } from 'applications/operationalStudies/types';
import drawCurve from 'modules/simulationResult/components/ChartHelpers/drawCurve';
import type { SpaceCurvesSlopesData } from 'modules/simulationResult/types';
import type {
  Chart,
  GradientPosition,
  HeightPosition,
  RadiusPosition,
  SpeedSpaceChart,
} from 'reducers/osrdsimulation/types';

export const drawAxisTitle = (chart: Chart, slopes?: SpaceCurvesSlopesData['slopesHistogram']) => {
  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', 'rotate(-90)')
    .attr('x', -10)
    .attr('y', 20)
    .text('m/km');

  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', 'rotate(0)')
    .attr('x', chart.width - 10)
    .attr('y', chart.height - 10)
    .text('m');

  if (slopes) {
    chart.drawZone
      .append('text')
      .attr('class', 'axis-unit')
      .attr('text-anchor', 'end')
      .attr('transform', 'rotate(-90)')
      .attr('x', -30)
      .attr('y', chart.width - 10)
      .text('m');
  }
};

export const drawSpaceCurvesSlopesChartCurve = <
  T extends PositionData<'gradient'> | PositionData<'radius'> | HeightPosition,
>(
  chartLocal: SpeedSpaceChart,
  classes: string,
  data: T[],
  interpolation: 'curveLinear' | 'curveMonotoneX',
  yAxisValue: 'gradient' | 'radius' | 'height',
  curveName: string
) => {
  drawCurve(
    chartLocal,
    classes,
    data,
    'curvesSlopesChart',
    interpolation,
    ['position', yAxisValue],
    curveName
  );
};

const calculateReferentialHeight = (data: number[]) => {
  const maxRef = d3.max(data);
  const minRef = d3.min(data);
  let refHeight = 0;
  if (maxRef !== undefined && minRef !== undefined) {
    refHeight = maxRef - minRef;
  }
  return refHeight;
};

export const createCurveCurve = (
  curves: PositionData<'radius'>[],
  speeds: number[]
): RadiusPosition[] => {
  const referentialHeight = calculateReferentialHeight(speeds);
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

/**
 * Create the altitude curve based from the slopes data
 */
export const createSlopeCurve = (
  slopes: GradientPosition[] | PositionData<'gradient'>[],
  gradients: number[]
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
  const referentialHeight = calculateReferentialHeight(gradients);
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
