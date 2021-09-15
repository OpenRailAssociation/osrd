const drawText = (
  chart, groupID, dataSimulation,
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone.append('text')
    .attr('class', 'curve-label')
    .attr('x', chart.x(dataSimulation.routeBeginOccupancy[0].time))
    .attr('y', chart.y(dataSimulation.routeBeginOccupancy[0].position) + 15)
    .text(dataSimulation.name);
};

export default drawText;
