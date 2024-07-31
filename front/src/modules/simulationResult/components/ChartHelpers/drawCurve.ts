import * as d3 from 'd3';

import type { ChartAxes } from 'modules/simulationResult/consts';
import type { Chart, ConsolidatedPosition } from 'reducers/osrdsimulation/types';
import type { ArrayElement } from 'utils/types';

import { getAxis } from './ChartHelpers';
import type { GevPreparedData } from '../SpeedSpaceChart/types';

// TODO: remove this when spaceCurvesSlopes chart will be deleted
const drawCurve = <
  T extends ArrayElement<GevPreparedData[keyof GevPreparedData]> | ConsolidatedPosition,
>(
  chart: Chart,
  classes: string,
  dataSimulation: T[],
  groupID: string,
  interpolation: string,
  keyValues: ChartAxes,
  name: string,
  rotate = false,
  isSelected = true
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);

  const xAxis = getAxis(keyValues, 'x', rotate);
  const yAxis = getAxis(keyValues, 'y', rotate);

  const onY2Axis = yAxis === 'height' && chart.y2;

  type Key = keyof T;

  drawZone
    .append('path')
    .attr('class', `line zoomable ${onY2Axis && 'additional-y'} ${classes}`)
    .datum(dataSimulation)
    .attr('fill', 'none')
    .attr('stroke-width', 1)
    .attr(
      'd',
      d3
        .line<T>()
        .x((d) => chart.x(d[xAxis as keyof T] as number))
        .y((d) =>
          onY2Axis && chart.y2
            ? chart.y2(d[yAxis as keyof T] as number)
            : chart.y(d[yAxis as Key] as number)
        )
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
