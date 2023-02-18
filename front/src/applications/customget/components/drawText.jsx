const drawText = (chart, direction, groupID, isSelected, text, x, y, color = '#333333') => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  console.log(color);
  drawZone
    .append('text')
    .attr('class', `curve-label ${isSelected && 'selected'}`)
    .attr('x', direction ? chart.x(x) : chart.x(x))
    .attr('y', direction ? chart.y(y) + 15 : chart.y(y) - 5)
    .text(text);
  drawZone
    .append('circle')
    .attr('cx', direction ? chart.x(x) - 8 : chart.x(x))
    .attr('cy', direction ? chart.y(y) + 10 : chart.y(y) - 5)
    .attr('r', '5px')
    .style('fill', color);
};

export default drawText;
