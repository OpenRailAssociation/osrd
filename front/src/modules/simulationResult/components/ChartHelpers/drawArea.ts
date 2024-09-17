import * as d3 from 'd3';

import type { Chart } from 'reducers/simulationResults/types';

import type { AreaBlock } from '../SpeedSpaceChart/types';

// TODO: remove this when spaceCurvesSlopes chart will be deleted
/**
 * Draw area for the SpaceCurvesSlopesChart
 */
const drawArea = (
  chart: Chart,
  classes: string,
  dataSimulation: AreaBlock[],
  groupID: string,
  interpolation: 'curveMonotoneX' | 'curveLinear'
) => {
  const dataDefinition = d3
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
