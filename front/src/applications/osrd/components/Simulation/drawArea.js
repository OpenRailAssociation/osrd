import * as d3 from 'd3';

const drawArea = (
  chart, classes, dataSimulation, groupID,
  interpolation, keyValues, rotate,
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
    .attr('class', `area zoomable ${classes}`)
    .datum(dataSimulation)
    .attr('d', dataDefinition);
};

export default drawArea;
