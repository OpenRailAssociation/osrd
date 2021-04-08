const drawPoints = (
  chart, color, data, groupID, keyValues, rotate,
) => {
  console.log(data);
  chart.drawZone.append('g')
    .selectAll('conflictsPoints')
    .attr('id', 'conflictsZone')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'conflictsPoints')
    .style('fill', color)
    .attr('stroke', color)
    .attr('r', 2)
    .attr('cx', (d) => chart.x(rotate ? d[keyValues[1]] : d[keyValues[0]]))
    .attr('cy', (d) => chart.y(rotate ? d[keyValues[0]] : d[keyValues[1]]));
};

export default drawPoints;
