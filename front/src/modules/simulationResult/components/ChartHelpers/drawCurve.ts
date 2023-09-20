import * as d3 from 'd3';
import { Chart, ConsolidatedPosition } from 'reducers/osrdsimulation/types';
import { ArrayElement } from 'utils/types';
import { ChartAxes } from '../simulationResultsConsts';
import { GevPreparedData } from '../SpeedSpaceChart/prepareData';
import { getAxis } from './ChartHelpers';

const drawCurve = <
  T extends ArrayElement<GevPreparedData[keyof GevPreparedData]> | ConsolidatedPosition
>(
  chart: Chart,
  classes: string,
  dataSimulation: T[],
  groupID: string,
  interpolation: string,
  keyValues: ChartAxes,
  name: string,
  rotate: boolean,
  isSelected = true
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);

  const xAxis = getAxis(keyValues, 'x', rotate);
  const yAxis = getAxis(keyValues, 'y', rotate);

  type Key = keyof T;

  drawZone
    .append('path')
    .attr('class', `line zoomable ${classes}`)
    .datum(dataSimulation)
    .attr('fill', 'none')
    .attr('stroke-width', 1)
    .attr(
      'd',
      d3
        .line<T>()
        .x((d) => chart.x(d[xAxis as Key] as number))
        .y((d) => chart.y(d[yAxis as Key] as number))
        .curve(d3[interpolation as keyof d3.CurveFactory])
    );

  if (isSelected) {
    drawZone
      .append('circle')
      .attr('class', `pointer ${classes}`)
      .attr('id', `pointer-${name}`)
      .attr('transform', 'translate(-0.5,0)')
      .attr('r', 3)
      .style('opacity', 0);
  }
};

export default drawCurve;
