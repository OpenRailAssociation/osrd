const drawText = (
  chart, groupID, dataSimulation, direction,
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone.append('text')
    .attr('class', 'curve-label')
    .attr('x', direction
      ? chart.x(dataSimulation.headPosition[0][0].time)
      : chart.x(dataSimulation.headPosition[0][0].time))
    .attr('y', direction
      ? chart.y(dataSimulation.headPosition[0][0].position) + 15
      : chart.y(dataSimulation.headPosition[0][0].position) - 5)
    .text(dataSimulation.name);
};

export default drawText;
