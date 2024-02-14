import { Chart, ConsolidatedRouteAspect } from 'reducers/osrdsimulation/types';
import { buildStripe } from './ChartHelpers';

/**
 * Draw rect for SpaceTimeChart
 */
const drawRect = (
  chart: Chart,
  classes: string,
  dataSimulation: ConsolidatedRouteAspect,
  groupID: string,
  rotate: boolean,
  id: string | null = null
) => {
  if (dataSimulation.time_end === null || dataSimulation.time_start === null) {
    return;
  }
  const width = rotate
    ? chart.x(dataSimulation.position_end) - chart.x(dataSimulation.position_start)
    : chart.x(dataSimulation.time_end) - chart.x(dataSimulation.time_start);

  const height = rotate
    ? chart.y(dataSimulation.time_end) - chart.y(dataSimulation.time_start)
    : chart.y(dataSimulation.position_end) - chart.y(dataSimulation.position_start);

  const isStripe = dataSimulation.blinking;
  if (isStripe) {
    buildStripe(chart.drawZone.select(`#${groupID}`), { id: id!, color: dataSimulation.color });
  }

  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone
    .append('rect')
    .attr('id', id)
    .attr('class', `rect zoomable ${classes}`)
    .datum(dataSimulation)
    .attr('fill', isStripe ? `url(#${id})` : dataSimulation.color)
    .attr('stroke-width', 1)
    .attr('stroke', isStripe ? `url(#${id})` : dataSimulation.color)
    .attr('x', chart.x(rotate ? dataSimulation.position_start : dataSimulation.time_start))
    .attr(
      'y',
      chart.y(rotate ? dataSimulation.time_start : dataSimulation.position_start) - height * -1
    )
    .attr('width', width)
    .attr('height', height * -1);
};

export default drawRect;
