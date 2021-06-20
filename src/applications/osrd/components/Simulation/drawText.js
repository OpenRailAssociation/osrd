const drawText = (
  chart, groupID, dataSimulation,
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone.append('text')
    .attr('class', 'curve-label')
    .attr('x', chart.x(dataSimulation.startBlockOccupancy[0].time))
    .attr('y', chart.y(dataSimulation.startBlockOccupancy[0].value) + 15)
    .text(dataSimulation.name);
};

export default drawText;
