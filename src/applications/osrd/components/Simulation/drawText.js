const drawText = (
  chart, groupID, dataSimulation, direction,
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone.append('text')
    .attr('class', 'curve-label')
    .attr('x', direction
      ? chart.x(dataSimulation.routeBeginOccupancy[0].time)
      : chart.x(dataSimulation.routeEndOccupancy[0].time) + 20)
    .attr('y', direction
      ? chart.y(dataSimulation.routeBeginOccupancy[0].position) + 12
      : chart.y(dataSimulation.routeEndOccupancy[0].position))
    .text(dataSimulation.name);
};

export default drawText;
