import type { PositionData } from 'applications/operationalStudies/types';
import drawCurve from 'modules/simulationResult/components/ChartHelpers/drawCurve';
import type { SpaceCurvesSlopesDataV2 } from 'modules/simulationResult/types';
import type { Chart, HeightPosition, SpeedSpaceChart, Train } from 'reducers/osrdsimulation/types';

export const drawAxisTitle = (
  chart: Chart,
  slopes?: SpaceCurvesSlopesDataV2['slopesHistogram'] | Train['slopes']
) => {
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
      .attr('transform', 'rotate(0)')
      .attr('x', chart.width - 10)
      .attr('y', 30)
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
