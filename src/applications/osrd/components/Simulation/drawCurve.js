import * as d3 from 'd3';

const drawCurve = (
  chart, classes, dataSimulation, groupID, interpolation,
  keyValues, name, rotate, isSelected = true,
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone.append('path')
    .attr('class', `line zoomable ${classes}`)
    .datum(dataSimulation[name])
    .attr('fill', 'none')
    .attr('stroke-width', 1)
    .attr('d', d3.line()
      .x((d) => chart.x(rotate ? d[keyValues[1]] : d[keyValues[0]]))
      .y((d) => chart.y(rotate ? d[keyValues[0]] : d[keyValues[1]]))
      .curve(d3[interpolation]));

  if (isSelected) {
    drawZone.append('circle')
      .attr('class', `pointer ${classes}`)
      .attr('id', `pointer-${name}`)
      .attr('transform', 'translate(-0.5,0)')
      .attr('r', 3)
      .style('opacity', 0);
  }
};

export default drawCurve;
