import * as d3 from 'd3';
import { Chart, ConsolidatedPosition } from 'reducers/osrdsimulation/types';
import { ArrayElement, ArrayElementKeys } from 'utils/types';
import { GevPreparedata } from '../SpeedSpaceChart/prepareData';

const drawCurve = <
  T extends ArrayElement<GevPreparedata[keyof GevPreparedata]> | ConsolidatedPosition
>(
  chart: Chart,
  classes: string,
  dataSimulation: T[],
  groupID: string,
  interpolation: string,
  keyValues: ArrayElementKeys<T[]>[],
  name: string,
  rotate: boolean,
  isSelected = true
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);

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
        .x((d) => chart.x((rotate ? d[keyValues[1]] : d[keyValues[0]]) as number))
        .y((d) => chart.y((rotate ? d[keyValues[0]] : d[keyValues[1]]) as number))
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
