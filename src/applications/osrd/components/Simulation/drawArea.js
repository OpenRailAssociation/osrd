import * as d3 from 'd3';
import { updateMustRedraw, updateSelectedTrain } from 'reducers/osrdsimulation';

const drawArea = (
  chart, pattern = 'gray', dataSimulation, dispatch, groupID, interpolation,
  keyValues, name, rotate,
) => { // Pattern could be a color or a pattern defined in svgDefs with syntax 'url(#idOfPAttern)'
  const dataDefinition = rotate
    ? d3.area()
      .y((d) => chart.y(d[keyValues[0]]))
      .x0((d) => chart.x(d.value0))
      .x1((d) => chart.x(d.value1))
      .curve(d3[interpolation])
    : d3.area()
      .x((d) => chart.x(d[keyValues[0]]))
      .y0((d) => chart.y(d.value0))
      .y1((d) => chart.y(d.value1))
      .curve(d3[interpolation]);

  chart.drawZone.select(`#${groupID}`).append('path')
    .on('click', () => {
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
      dispatch(updateMustRedraw(true));
    })
    .attr('class', 'area zoomable')
    .datum(dataSimulation[name])
    // .attr('fill', color)
    .attr('fill', pattern)
    .attr('d', dataDefinition);
};

export default drawArea;
