import * as d3 from 'd3';
import { isEmpty } from 'lodash';
import { Chart } from 'reducers/osrdsimulation/types';
import { AreaBlock } from '../SpeedSpaceChart/prepareData';

/**
 * Draw area for the SpeedSpaceChart or the SpaceCurvesSlopesChart
 */
const drawArea = (
  chart: Chart,
  classes: string,
  dataSimulation: AreaBlock[],
  groupID: string,
  interpolation: 'curveMonotoneX' | 'curveLinear',
  rotate: boolean
) => {
  const dataDefinition = rotate
    ? d3
        .area<AreaBlock>()
        .y((d) => chart.y(d.position))
        .x0((d) => chart.x(d.value0))
        .x1((d) => chart.x(!isEmpty(d.value1) ? d.value1[0] : 0))
        .curve(d3[interpolation])
    : d3
        .area<AreaBlock>()
        .x((d) => chart.x(d.position))
        .y0((d) => chart.y(d.value0))
        .y1(() => chart.y(0))
        .curve(d3[interpolation]);

  chart.drawZone
    .select(`#${groupID}`)
    .append('path')
    .attr('class', `area zoomable ${classes}`)
    .datum(dataSimulation)
    .attr('d', dataDefinition);
};

export default drawArea;
